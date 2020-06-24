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
import { createPeerConnection } from "../Rtc";
import { usePubNub } from "pubnub-react";
import Pubnub from "pubnub";

const ICE_CONFIG = RtcSettings.rtcIceConfig;
const DIALING_TIMEOUT_SECONDS = RtcSettings.rtcDialingTimeoutSeconds;

// TODO: figure out how to handle peer connections in a clean way
let peerConnection: RTCPeerConnection;

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
  const [audio, setAudio] = useState(true);
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
    if (message.message.candidate && message.message.candidate.candidate) {
      // we got an ice candidate from a peer
      console.log("candidate received from peer", message.message.candidate);
      try {
        // let iceCandidate = new RTCIceCandidate(message.message.candidate);
        await peerConnection.addIceCandidate(message.message.candidate);
      } catch (e) {
        console.log("condidate: error setting ice candidate: ", e);
      }
    }

    if (message.message.offer && message.message.offer.type === "offer") {
      // we got an ice offer from a peer

      initPeerConnection();

      console.log("offer received from peer", message.message.offer);
      try {
        await peerConnection.setRemoteDescription(message.message.offer);
      } catch (e) {
        console.log("offer: error setting remote desc: ", e);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio,
        video
      });

      console.log("offer: adding tracks");

      stream
        .getTracks()
        .forEach(track => peerConnection.addTrack(track, stream));

      const answer = await peerConnection.createAnswer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      });

      try {
        await peerConnection.setLocalDescription(answer);
      } catch (e) {
        console.log("offer: error setting local desc: ", e);
      }

      // send answer
      console.log(
        "offer: answer sent to peer",
        peerConnection.localDescription
      );
      pubnub.publish({
        channel: currentCall.peerUserId,
        message: {
          answer: peerConnection.localDescription
        }
      });
    }

    if (message.message.answer && message.message.answer.type === "answer") {
      // we got an ice answer from a peer
      console.log("answer: answer received from peer", message.message.answer);

      try {
        await peerConnection.setRemoteDescription(message.message.answer);
      } catch (e) {
        console.log("answer: error setting remote desc: ", e);
      }
    }
  };

  const initPeerConnection = () => {
    peerConnection = createPeerConnection(ICE_CONFIG);

    // send ice candidates to peer
    peerConnection.onicecandidate = event => {
      console.log("candidate sent to peer");
      pubnub.publish({
        channel: currentCall.peerUserId,
        message: {
          candidate: event.candidate
        }
      });
    };

    peerConnection.ontrack = e => {
      console.log("on track received");
      if (
        (document.querySelector("#remotevideo") as any).srcObject !==
        e.streams[0]
      ) {
        (document.querySelector("#remotevideo") as any).srcObject =
          e.streams[0];
      }
    };

    peerConnection.onconnectionstatechange = async e => {
      console.log("onconnectionstatechange", peerConnection.connectionState);
    };

    peerConnection.onnegotiationneeded = async () => {
      console.log("negotiation: on negotiation needed");
      const offer = await peerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      });

      console.log("negotiation: attempting local offer", offer);

      try {
        await peerConnection.setLocalDescription(offer);
      } catch (e) {
        console.log("negotiation: error setting local desc: ", e);
      }

      console.log("negotiation: sending local offer to peer");
      pubnub.publish({
        channel: currentCall.peerUserId,
        message: {
          offer: peerConnection.localDescription
        }
      });
    };
  };

  const disableVideo = () => {
    (document.querySelector("#myvideo") as any).srcObject &&
      (document.querySelector("#myvideo") as any).srcObject
        .getTracks()
        .forEach((track: MediaStreamTrack) => {
          track.stop();
        });
    (document.querySelector("#myvideo") as any).srcObject = undefined;
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
    let stream = await navigator.mediaDevices.getUserMedia({
      ...mediaConstraints,
      audio: false
    });

    (document.querySelector("#myvideo") as any).srcObject = stream;
  };

  const enableAudio = async (mediaConstraints: MediaStreamConstraints) => {};

  const updateMedia = (mediaConstraints: MediaStreamConstraints) => {
    if (mediaConstraints.video) {
      enableVideo(mediaConstraints);
    } else if (mediaConstraints.audio) {
      enableAudio(mediaConstraints);
    } else {
      disableMedia();
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

  const answerCall = () => {
    console.log("answer call");
    setAnswered(true);
    updateMedia({ audio, video });

    dispatch(
      callAccepted(lastCallMessage.sender.id, lastCallMessage.startTime)
    );
    dispatch(callConnected(RtcCallState.INCOMING_CALL_CONNECTED));

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
      setDialed(true);
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
      initPeerConnection();
      setPeerAnswered(true);
      updateMedia({ audio, video });
      dispatch(callConnected(RtcCallState.OUTGOING_CALL_CONNECTED));

      const offer = await peerConnection.createOffer({
        offerToReceiveVideo: true,
        offerToReceiveAudio: true
      });

      console.log("accepted: attempting local offer", offer);

      try {
        await peerConnection.setLocalDescription(offer);
      } catch (e) {
        console.log("accepted: error setting local desc: ", e);
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        audio,
        video
      });

      console.log("offer: adding tracks");

      stream
        .getTracks()
        .forEach(track => peerConnection.addTrack(track, stream));

      console.log("accepted: sending local offer to peer");
      pubnub.publish({
        channel: currentCall.peerUserId,
        message: {
          offer: peerConnection.localDescription
        }
      });
    };

    const callEnded = async (callState: RtcCallState, endTime: number) => {
      console.log("peer ended");
      setDialed(false);
      dispatch(callCompleted(callState, endTime));
      closeMedia();
      peerConnection && peerConnection.close();
      peerConnection = new RTCPeerConnection();
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
    disableMedia();
    dispatch(rtcViewHidden());
    setDialed(false);
    setAnswered(false);
    setPeerAnswered(false);
    setVideo(true);
    setAudio(true);
  };

  const endCall = () => {
    console.log("end call");
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

  return (
    <Wrapper displayed={views.Rtc}>
      <Header>
        <Title>Call</Title>
        <CloseButton
          onClick={() => {
            closeMedia();
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
