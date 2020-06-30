import React, { useContext, useState, useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import { CrossIcon } from "foundations/components/icons/CrossIcon";
import {
  Wrapper,
  VideoWrapper,
  Header,
  Body,
  Title,
  CloseButton
} from "./RtcDisplay.style";
import { ThemeContext } from "styled-components";
import { getViewStates } from "../../layout/Selectors";
import { rtcViewHidden, rtcViewDisplayed } from "../../layout/LayoutActions";
import {
  callCompleted,
  incomingCallReceived,
  incomingCallAccepted,
  outgoingCallAccepted,
  getCurrentCall,
  getLastIncomingCall
} from "../RtcModel";
import { RtcCallState } from "../RtcCallState.enum";
import { getMessagesById } from "../../messages/messageModel";
import { getUsersById } from "../../users/userModel";
import { createSelector } from "reselect";
import { getLoggedInUserId } from "../../authentication/authenticationModel";
import {
  connectMedia,
  createIceOffer,
  createIceAnswer,
  createPeerConnection,
  disconnectMedia,
  setRemoteDescription,
  addIceCandidate,
  setIceCandidateHandler,
  setNegotiationNeededHandler,
  setTrackHandler,
  sendMedia
} from "../RtcConnection";
import { signaling } from "../RtcSignaling";
import { usePubNub } from "pubnub-react";

export const getLastCallMessage = createSelector(
  [getMessagesById, getLoggedInUserId, getUsersById],
  (messages, userId, users): any => {
    let userMessages = messages[userId]
      ? Object.values(messages[userId])
          .filter(message => message.channel === userId)
          .map((message): any => {
            return {
              ...message.message,
              timetoken: String(message.timetoken),
              sender:
                users[message.message.senderId] ||
                (message.message.senderId
                  ? {
                      id: message.message.senderId,
                      name: message.message.senderId
                    }
                  : {
                      id: "unknown",
                      name: "unknown"
                    })
            };
          })
      : [];

    return userMessages.length > 0
      ? userMessages[userMessages.length - 1]
      : undefined;
  }
);

const RtcDisplay = () => {
  const pubnub = usePubNub();
  const dispatch = useDispatch();
  const [video, setVideo] = useState(true);
  const [audio, setAudio] = useState(false);
  const [dialed, setDialed] = useState(false);
  const [peerAnswered, setPeerAnswered] = useState(false);
  const [incoming, setIncoming] = useState(false);
  const [answered, setAnswered] = useState(false);
  const currentCall = useSelector(getCurrentCall);
  const lastIncomingCall = useSelector(getLastIncomingCall);
  const lastCallMessage = useSelector(getLastCallMessage);
  const views = useSelector(getViewStates);
  const myId = useSelector(getLoggedInUserId);
  const theme = useContext(ThemeContext);

  const answerCall = async () => {
    console.log("answer call");
    setAnswered(true);

    // prompt user for camera access
    const mediaStream = await connectMedia({ audio, video });

    if (video) {
      (document.querySelector("#myvideo") as any).srcObject = mediaStream;
    }

    // update local store with accepted call information
    dispatch(
      incomingCallAccepted(lastCallMessage.sender.id, lastCallMessage.startTime)
    );

    await createPeerConnection();

    console.log("answer: sending answer to peer", lastCallMessage.sender.id);

    signaling.callAccept(
      myId,
      lastCallMessage.sender.id,
      lastCallMessage.startTime
    );
  };

  const endCall = async () => {
    console.log("end call");

    console.log("end call: sending", currentCall.peerUserId);

    // update local store with completed call information
    dispatch(
      callCompleted(
        currentCall.peerUserId,
        currentCall.startTime,
        new Date().getTime()
      )
    );

    await signaling.callEnd(
      myId,
      lastCallMessage.sender.id,
      lastCallMessage.startTime
    );

    closeMedia();
  };

  const onCallIncoming = async (callerId: string, startTime: number) => {
    console.log("incoming call: receiving call from peer");
    setIncoming(true);

    // update local store with receiving call information
    dispatch(incomingCallReceived(callerId, startTime));

    // ensure the rtc view is displayed
    dispatch(rtcViewDisplayed());
  };

  const onCallAccepted = async (callerId: string, startTime: number) => {
    console.log("accepted: outgoing call accepted by peer");
    setPeerAnswered(true);

    // update local store with call accepted status
    dispatch(outgoingCallAccepted(callerId, startTime));

    await createPeerConnection();

    await sendMedia();

    const offer = await createIceOffer();

    if (offer) {
      await signaling.iceOffer(
        myId,
        currentCall.peerUserId,
        currentCall.startTime,
        offer
      );
    } else {
      console.log("accepted: unable to create ice offer");
    }
  };

  const onCallEnded = async (callerId: string, startTime: number) => {
    console.log("ended: outgoing call ended by peer");

    // update local store with completed call information
    dispatch(
      callCompleted(
        currentCall.peerUserId,
        currentCall.startTime,
        new Date().getTime()
      )
    );

    closeMedia();
  };

  const onIceCandidate = async (
    callerId: string,
    startTime: number,
    candidate: RTCIceCandidate | null
  ) => {
    if (
      currentCall.peerUserId === callerId &&
      currentCall.startTime === startTime
    ) {
      if (candidate !== null) {
        addIceCandidate(candidate);
      }
    }
  };

  const onIceOffer = async (
    callerId: string,
    startTime: number,
    offer: RTCSessionDescription
  ) => {
    if (
      currentCall.peerUserId === callerId &&
      currentCall.startTime === startTime
    ) {
      setRemoteDescription(offer);

      await sendMedia();

      const answer = await createIceAnswer();

      if (answer) {
        if (answer) {
          await signaling.iceAnswer(
            myId,
            currentCall.peerUserId,
            currentCall.startTime,
            answer
          );
        } else {
          console.log("onIceOffer: unable to signal ice answer");
        }
      } else {
        console.log("onIceOffer: unable to create ice answer");
      }
    }
  };

  const onIceAnswer = async (
    callerId: string,
    startTime: number,
    answer: RTCSessionDescription
  ) => {
    if (
      currentCall.peerUserId === callerId &&
      currentCall.startTime === startTime
    ) {
      setRemoteDescription(answer);
    }
  };

  /**
   * New outgoing call
   */
  useEffect(() => {
    const callPeer = async () => {
      console.log("call peer: calling", currentCall.peerUserId);
      setDialed(true);

      // prompt current user for camera access
      const mediaStream = await connectMedia({ audio, video });

      if (video) {
        (document.querySelector("#myvideo") as any).srcObject = mediaStream;
      }

      // send calling signal to peer
      await signaling.callInit(
        myId,
        currentCall.peerUserId,
        currentCall.startTime
      );
    };

    if (
      !dialed &&
      !incoming &&
      currentCall.callState === RtcCallState.INITIATED
    ) {
      callPeer();
    }
  }, [dialed, incoming, currentCall, lastCallMessage, audio, video, myId]);

  /**
   * Initialize signaling
   */
  useEffect(() => {
    signaling.init(pubnub, dispatch);
  }, [pubnub, dispatch]);

  const disableAudio = () => {
    setAudio(false);
  };

  const disableVideo = async () => {
    (document.querySelector("#myvideo") as any).srcObject &&
      (document.querySelector("#myvideo") as any).srcObject
        .getTracks()
        .forEach((track: MediaStreamTrack) => {
          track.stop();
        });
    (document.querySelector("#myvideo") as any).srcObject = undefined;

    setVideo(false);
  };

  const disableLocalMedia = () => {
    disableVideo();
    disableAudio();
  };

  const disableRemoteVideo = async () => {
    (document.querySelector("#remotevideo") as any).srcObject &&
      (document.querySelector("#remotevideo") as any).srcObject
        .getTracks()
        .forEach((track: MediaStreamTrack) => {
          track.stop();
        });
    (document.querySelector("#remotevideo") as any).srcObject = undefined;
  };

  const disableRemoteAudio = async () => {
    (document.querySelector("#remoteaudio") as any).srcObject &&
      (document.querySelector("#remoteaudio") as any).srcObject
        .getTracks()
        .forEach((track: MediaStreamTrack) => {
          track.stop();
        });
    (document.querySelector("#remoteaudio") as any).srcObject = undefined;
  };

  const disableRemoteMedia = () => {
    disableRemoteVideo();
    disableRemoteAudio();
  };

  const enableVideo = async (mediaConstraints: MediaStreamConstraints) => {
    let stream = await connectMedia({ audio, video: true });

    (document.querySelector("#myvideo") as any).srcObject = stream;
    setVideo(true);
  };

  const enableAudio = async (mediaConstraints: MediaStreamConstraints) => {
    setAudio(true);
  };

  const updateMedia = async (mediaConstraints: MediaStreamConstraints) => {
    if (mediaConstraints.video) {
      await enableVideo(mediaConstraints);
    } else if (mediaConstraints.audio) {
      await enableAudio(mediaConstraints);
    } else {
      await disableLocalMedia();
    }
  };

  const toggleVideo = () => {
    updateMedia({ audio, video: !video });
    setVideo(!video);
  };

  const toggleAudio = () => {
    updateMedia({ audio: !audio, video });
    setAudio(!audio);
  };

  const closeMedia = () => {
    dispatch(rtcViewHidden());
    setDialed(false);
    setAnswered(false);
    setIncoming(false);
    setVideo(true);
    setAudio(false);
    disableLocalMedia();
    disableRemoteMedia();
    disconnectMedia();
  };

  const isDialing = () => {
    return currentCall.callState === RtcCallState.INITIATED;
  };

  const isIncomingCall = () => {
    return (
      !isDialing() &&
      currentCall.callState !== RtcCallState.CONNECTED &&
      lastIncomingCall.callState === RtcCallState.RECEIVING
    );
  };

  const isCallCompleted = () => {
    return (
      lastIncomingCall.callState !== RtcCallState.RECEIVING &&
      currentCall.callState === RtcCallState.COMPLETED
    );
  };

  const closeCall = () => {
    if (currentCall.callState === RtcCallState.INITIATED) {
      dispatch(
        callCompleted(
          currentCall.peerUserId,
          currentCall.startTime,
          new Date().getTime()
        )
      );
    }
    endCall();
    closeMedia();
  };

  const getStateDisplayString = () => {
    return currentCall.callState.replace("_", " ").toLowerCase();
  };

  signaling.setHandlers(
    onCallIncoming,
    onCallAccepted,
    onCallEnded,
    onIceCandidate,
    onIceOffer,
    onIceAnswer
  );

  setIceCandidateHandler((candidate: RTCIceCandidate | null) => {
    console.log("ice candidate handler peer: ", currentCall.peerUserId);
    if (candidate !== null) {
      signaling.iceCandidate(
        myId,
        currentCall.peerUserId,
        currentCall.startTime,
        candidate
      );
    }
  });

  setNegotiationNeededHandler(async (event: Event) => {
    console.log("negotiation needed: creating new offer");
    const offer = await createIceOffer();

    if (offer) {
      await signaling.iceOffer(
        myId,
        currentCall.peerUserId,
        currentCall.startTime,
        offer
      );
    } else {
      console.log("negotiation needed: unable to create ice offer");
    }
  });

  setTrackHandler((e: RTCTrackEvent) => {
    const remoteVideo = document.querySelector("#remotevideo") as any;
    e.track.onunmute = () => {
      if (remoteVideo.srcObject) {
        return;
      }
      (document.querySelector("#remotevideo") as any).srcObject = e.streams[0];
    };
  });

  return (
    <Wrapper displayed={views.Rtc}>
      <Header>
        <Title>Call</Title>
        <CloseButton
          onClick={() => {
            closeCall();
          }}
        >
          <CrossIcon color={theme.colors.normalText} title="close" />
        </CloseButton>
      </Header>
      <Body>
        <button onClick={toggleVideo}>Video ({video ? "on" : "off"})</button>
        <button onClick={toggleAudio}>Audio ({audio ? "on" : "off"})</button>
        {currentCall.callState === RtcCallState.CONNECTED && (
          <button onClick={endCall}>Connected (click to end call)</button>
        )}
        <VideoWrapper>
          <div>{getStateDisplayString()}</div>
          {isDialing() && <div>Dialing ...</div>}
          {isIncomingCall() && (
            <div>
              Receiving Call ...
              <button onClick={answerCall}>Answer</button>
            </div>
          )}
          {isCallCompleted() && <div>Call Completed</div>}
          <div>RemoteVideo</div>
          <video id="remotevideo" autoPlay={true} playsInline={true}></video>
          <audio id="remoteaudio" autoPlay={true}></audio>
          <div>LocalVideo</div>
          <video
            style={{ width: "25%" }}
            id="myvideo"
            autoPlay={true}
            playsInline={true}
          ></video>
        </VideoWrapper>
      </Body>
    </Wrapper>
  );
};

export { RtcDisplay };
