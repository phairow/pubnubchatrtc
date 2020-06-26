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
  getCurrentCall,
  callSignalReceived,
  callCompleted,
  getLastIncommingCall,
  callAccepted
} from "../RtcModel";
import { RtcCallState } from "../RtcCallState";
import { sendMessage as sendPubnubMessage } from "pubnub-redux";
import { MessageType, getMessagesById } from "../../messages/messageModel";
import { getUsersById } from "../../users/userModel";
import { createSelector } from "reselect";
import { getLoggedInUserId } from "../../authentication/authenticationModel";
import { callConnected } from "../RtcModel";
import RtcSettings from "config/rtcSettings.json";
import { createPeerConnection, getUserMedia } from "../Rtc";
import { usePubNub } from "pubnub-react";
import Pubnub from "pubnub";

const ICE_CONFIG = RtcSettings.rtcIceConfig;
const DIALING_TIMEOUT_SECONDS = RtcSettings.rtcDialingTimeoutSeconds;

interface LocalState {
  peerConnection: RTCPeerConnection;
  inboundStream: any;
  negotingOffer: boolean;
  userMediaStream?: MediaStream;
}

const state: LocalState = {
  peerConnection: new RTCPeerConnection(),
  inboundStream: undefined,
  negotingOffer: false,
  userMediaStream: undefined
};

// TODO: figure out how to handle peer connections in a clean way

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

let pubnubIceListener: Pubnub.ListenerParameters = {};

const RtcDisplay = () => {
  const pubnub = usePubNub();
  const [video, setVideo] = useState(true);
  const [audio, setAudio] = useState(false);
  const [dialed, setDialed] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [peerAnswered, setPeerAnswered] = useState(false);
  const dispatch = useDispatch();
  const currentCall = useSelector(getCurrentCall);
  const lastIncommingCall = useSelector(getLastIncommingCall);
  const lastCallMessage = useSelector(getLastCallMessage);
  const views = useSelector(getViewStates);
  const myId = useSelector(getLoggedInUserId);
  const theme = useContext(ThemeContext);

  pubnub.removeListener(pubnubIceListener);
  pubnub.addListener(pubnubIceListener);

  pubnubIceListener.message = async message => {
    if (
      state.peerConnection &&
      state.peerConnection.connectionState !== "closed" &&
      message.message.candidate
    ) {
      // we got an ice candidate from a peer
      console.log("candidate received from peer", message.message.candidate);

      try {
        // let iceCandidate = new RTCIceCandidate(message.message.candidate);
        await state.peerConnection.addIceCandidate(message.message.candidate);
      } catch (e) {
        console.log("candidate: error setting ice candidate: ", e);
      }
    }

    if (message.message.offer && message.message.offer.type === "offer") {
      // we got an ice offer from a peer

      if (
        state.negotingOffer ||
        state.peerConnection.signalingState !== "stable"
      ) {
        // exit if already negotiating offer or unstable
        return;
      }

      console.log("offer received from peer", message.message.offer);

      try {
        await state.peerConnection.setRemoteDescription(message.message.offer);
      } catch (e) {
        console.log("offer: error setting remote desc: ", e);
      }

      await connectMedia();
      await updateMedia({ audio, video });

      const answer = await state.peerConnection.createAnswer();

      try {
        await state.peerConnection.setLocalDescription(answer);
      } catch (e) {
        console.log("offer: error setting local desc: ", e);
      }

      console.log(
        "offer: sending answer ",
        state.peerConnection.localDescription
      );

      pubnub.publish({
        channel: currentCall.peerUserId,
        message: {
          answer: state.peerConnection.localDescription
        }
      });
    }

    if (message.message.answer && message.message.answer.type === "answer") {
      // we got an ice answer from a peer
      console.log("answer: answer received from peer", message.message.answer);

      if (
        state.negotingOffer ||
        state.peerConnection.signalingState !== "stable"
      ) {
        // exit if already negotiating offer or unstable
        return;
      }

      try {
        await state.peerConnection.setRemoteDescription(message.message.answer);
      } catch (e) {
        console.log("answer: error setting remote desc: ", e);
      }
    }
  };

  const connectMedia = async () => {
    if (!state.userMediaStream) {
      setVideo(true);
      state.userMediaStream = await navigator.mediaDevices.getUserMedia({
        audio,
        video: true
      });

      console.log("connect media: adding tracks");

      state.userMediaStream.getTracks().forEach(track => {
        if (state.userMediaStream) {
          state.peerConnection.addTrack(track, state.userMediaStream);
        }
      });
    }

    return state?.userMediaStream.clone();
  };

  const initPeerConnection = async () => {
    state.peerConnection = createPeerConnection(ICE_CONFIG);
    state.inboundStream = undefined;

    // send ice candidates to peer
    state.peerConnection.onicecandidate = async e => {
      if (e.candidate) {
        console.log("candidate sent to peer");

        console.log("candidate: sending candidate ", e);
        console.log(
          "candidate: ice candidate length ",
          e.candidate && e.candidate.candidate && e.candidate.candidate.length
        );

        try {
          await pubnub.publish({
            channel: currentCall.peerUserId,
            message: {
              candidate: e.candidate
            }
          });
        } catch (e) {
          console.log("error sending ice candidate to peer", e);
        }
      }
    };

    state.peerConnection.ontrack = e => {
      if (e.streams && e.streams[0]) {
        (document.querySelector("#remotevideo") as any).srcObject =
          e.streams[0];
      } else {
        if (!state.inboundStream) {
          state.inboundStream = new MediaStream();
          (document.querySelector("#remotevideo") as any).srcObject =
            state.inboundStream;
        }
        state.inboundStream.addTrack(e.track);
      }
    };

    state.peerConnection.onconnectionstatechange = async e => {
      console.log(
        "onconnectionstatechange",
        state.peerConnection.connectionState
      );
    };

    state.peerConnection.onnegotiationneeded = async () => {
      console.log("negotiation: on negotiation needed");

      try {
        state.negotingOffer = true;

        await connectMedia();
        await updateMedia({ audio, video });

        const offer = await state.peerConnection.createOffer();

        console.log("negotiation: attempting local offer", offer);

        try {
          await state.peerConnection.setLocalDescription(offer);
        } catch (e) {
          console.log("negotiation: error setting local desc: ", e);
        }

        console.log(
          "negotiation: sending offer",
          state.peerConnection.localDescription
        );

        console.log("negotiation: sending local offer to peer");

        try {
          await pubnub.publish({
            channel: currentCall.peerUserId,
            message: {
              offer: state.peerConnection.localDescription
            }
          });
        } catch (e) {
          console.log("error sending offer from negotiation needed", e);
        }
      } catch (e) {
        console.log("error in negotiation needed", e);
      } finally {
        state.negotingOffer = false;
      }
    };
  };

  const disableVideo = async () => {
    (document.querySelector("#myvideo") as any).srcObject &&
      (document.querySelector("#myvideo") as any).srcObject
        .getTracks()
        .forEach((track: MediaStreamTrack) => {
          track.stop();
        });
    (document.querySelector("#myvideo") as any).srcObject = undefined;

    (document.querySelector("#remotevideo") as any).srcObject &&
      (document.querySelector("#remotevideo") as any).srcObject
        .getTracks()
        .forEach((track: MediaStreamTrack) => {
          track.stop();
        });
    (document.querySelector("#remotevideo") as any).srcObject = undefined;
    setVideo(false);
  };

  const disableAudio = () => {
    setAudio(false);
  };

  const disableMedia = () => {
    disableVideo();
    disableAudio();
  };

  const enableVideo = async (mediaConstraints: MediaStreamConstraints) => {
    let stream = await connectMedia();

    (document.querySelector("#myvideo") as any).srcObject = stream;
  };

  const enableAudio = async (mediaConstraints: MediaStreamConstraints) => {};

  const updateMedia = async (mediaConstraints: MediaStreamConstraints) => {
    if (mediaConstraints.video) {
      await enableVideo(mediaConstraints);
    } else if (mediaConstraints.audio) {
      await enableAudio(mediaConstraints);
    } else {
      await disableMedia();
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

  const answerCall = async () => {
    console.log("answer call");

    await updateMedia({ audio, video });

    dispatch(
      callAccepted(lastCallMessage.sender.id, lastCallMessage.startTime)
    );

    dispatch(callConnected(RtcCallState.INCOMING_CALL_CONNECTED));

    await initPeerConnection();

    console.log("answer: sending answer", lastCallMessage.sender.id);

    dispatch(
      sendPubnubMessage({
        channel: lastCallMessage.sender.id,
        message: {
          type: MessageType.Rtc,
          callState: RtcCallState.OUTGOING_CALL_CONNECTED,
          startTime: lastCallMessage.startTime,
          senderId: myId
        }
      })
    );
  };

  useEffect(() => {
    const callUser = async () => {
      console.log("calling " + currentCall.peerUserId);

      await connectMedia();
      await updateMedia({ audio, video });

      setDialed(true);

      console.log("calluser: calling", currentCall.peerUserId);

      dispatch(
        sendPubnubMessage({
          channel: currentCall.peerUserId,
          message: {
            type: MessageType.Rtc,
            callState: RtcCallState.DIALING,
            startTime: currentCall.startTime,
            senderId: myId
          }
        })
      );
    };

    const incomingCall = async () => {
      console.log("receiving");
      dispatch(
        callSignalReceived(lastCallMessage.sender.id, lastCallMessage.startTime)
      );
      dispatch(rtcViewDisplayed());
    };

    const outgoingCallAccepted = async () => {
      console.log("accepted: outgoing call accepted");
      setPeerAnswered(true);
      dispatch(callConnected(RtcCallState.OUTGOING_CALL_CONNECTED));

      initPeerConnection();

      await connectMedia();

      const offer = await state.peerConnection.createOffer();

      console.log("accepted: attempting local offer", offer);

      try {
        await state.peerConnection.setLocalDescription(offer);
      } catch (e) {
        console.log("accepted: error setting local desc: ", e);
      }

      console.log(
        "accepted: offer length",
        state.peerConnection.localDescription?.toJSON().length
      );

      console.log(
        "accepted: sending offer ",
        state.peerConnection.localDescription
      );

      console.log("accepted: sending local offer to peer");

      pubnub.publish({
        channel: currentCall.peerUserId,
        message: {
          offer: state.peerConnection.localDescription
        }
      });
    };

    const callEnded = async (callState: RtcCallState, endTime: number) => {
      console.log("peer ended");
      setDialed(false);
      dispatch(callCompleted(callState, endTime));
      closeMedia();
      state.peerConnection && state.peerConnection.close();
    };

    // console.log('---');
    // console.log('current user', myId);
    // console.log('peer user', currentCall.peerUserId);
    // console.log('starttime', currentCall.startTime);
    // console.log('last incomming call: ', lastIncommingCall.startTime);
    // console.log('last call message: ', lastCallMessage && lastCallMessage.startTime);
    // console.log('dialed', dialed)
    // console.log('peerAnswered', peerAnswered)
    // console.log(lastCallMessage)
    // console.log(currentCall)
    // console.log('---');

    if (!dialed && currentCall.callState === RtcCallState.DIALING) {
      // if calling
      callUser();
    } else if (
      lastCallMessage &&
      (lastIncommingCall.callState === RtcCallState.NONE ||
        lastIncommingCall.startTime !== lastCallMessage.startTime) && // must be new call
      lastCallMessage.type === MessageType.Rtc &&
      lastCallMessage.callState === RtcCallState.DIALING
    ) {
      // if receiving call
      incomingCall();
    } else if (
      dialed &&
      !peerAnswered &&
      lastCallMessage &&
      lastCallMessage.startTime === currentCall.startTime &&
      lastCallMessage.type === MessageType.Rtc &&
      lastCallMessage.callState === RtcCallState.OUTGOING_CALL_CONNECTED
    ) {
      // if peer accepted call
      outgoingCallAccepted();
    } else if (
      (currentCall.callState === RtcCallState.OUTGOING_CALL_CONNECTED ||
        currentCall.callState === RtcCallState.INCOMING_CALL_CONNECTED) &&
      lastCallMessage &&
      lastCallMessage.startTime === currentCall.startTime &&
      lastCallMessage.type === MessageType.Rtc &&
      (lastCallMessage.callState === RtcCallState.OUTGOING_CALL_COMPLETED ||
        lastCallMessage.callState === RtcCallState.INCOMING_CALL_COMPLETED)
    ) {
      // if peer ended call
      callEnded(lastCallMessage.callState, new Date().getTime());
    }
  });

  const closeMedia = () => {
    dispatch(rtcViewHidden());
    setDialed(false);
    setAnswered(false);
    setPeerAnswered(false);
    setVideo(true);
    setAudio(false);
    state.inboundStream = undefined;
    state.negotingOffer = false;
    if (state.userMediaStream) {
      state.userMediaStream.getTracks()[0].stop();
      state.userMediaStream = undefined;
    }
    disableMedia();
  };

  const endCall = () => {
    console.log("end call");

    console.log("end call: sending end", currentCall.peerUserId);

    dispatch(
      sendPubnubMessage({
        channel: currentCall.peerUserId,
        message: {
          type: MessageType.Rtc,
          callState: dialed
            ? RtcCallState.INCOMING_CALL_COMPLETED
            : RtcCallState.OUTGOING_CALL_COMPLETED,
          startTime: currentCall.startTime,
          senderId: myId
        }
      })
    );

    dispatch(
      callCompleted(
        dialed
          ? RtcCallState.OUTGOING_CALL_COMPLETED
          : RtcCallState.INCOMING_CALL_COMPLETED,
        new Date().getTime()
      )
    );

    closeMedia();
  };

  const isDialing = () => {
    return currentCall.callState === RtcCallState.DIALING;
  };

  const isIncommingCall = () => {
    return (
      !isDialing() &&
      currentCall.callState !== RtcCallState.OUTGOING_CALL_CONNECTED &&
      currentCall.callState !== RtcCallState.INCOMING_CALL_CONNECTED &&
      lastIncommingCall.callState === RtcCallState.RECEIVING_CALL
    );
  };

  const isCallCompleted = () => {
    return (
      lastIncommingCall.callState !== RtcCallState.RECEIVING_CALL &&
      (currentCall.callState === RtcCallState.OUTGOING_CALL_COMPLETED ||
        currentCall.callState === RtcCallState.INCOMING_CALL_COMPLETED)
    );
  };

  const closeCall = () => {
    if (currentCall.callState === RtcCallState.DIALING) {
      dispatch(
        callCompleted(RtcCallState.CALL_NOT_ANSWERED, new Date().getTime())
      );
    }
    closeMedia();
  };

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
        {(currentCall.callState === RtcCallState.OUTGOING_CALL_CONNECTED ||
          currentCall.callState === RtcCallState.INCOMING_CALL_CONNECTED) && (
          <button onClick={endCall}>Connected (click to end call)</button>
        )}
        <VideoWrapper>
          {isDialing() && <div>Dialing ...</div>}
          {isIncommingCall() && (
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
