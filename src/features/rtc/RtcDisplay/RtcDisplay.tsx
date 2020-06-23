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

const ICE_CONFIG = RtcSettings.rtcIceConfig;
const DIALING_TIMEOUT_SECONDS = RtcSettings.rtcDialingTimeoutSeconds;

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
  // const [peerConnection, setPeerConnection] = useState(new RTCPeerConnection({
  //   iceServers: ICE_CONFIG
  // }));
  const [video, setVideo] = useState(false);
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
    (document.querySelector("#myaudio") as any).srcObject &&
      (document.querySelector("#myaudio") as any).srcObject
        .getTracks()
        .forEach((track: MediaStreamTrack) => {
          track.stop();
        });
    (document.querySelector("#myaudio") as any).srcObject = undefined;
    setAudio(false);
  };

  const disableMedia = () => {
    disableVideo();
    disableAudio();
  };

  const enableVideo = async (mediaConstraints: MediaStreamConstraints) => {
    let stream = await navigator.mediaDevices.getUserMedia(mediaConstraints);

    disableAudio();
    (document.querySelector("#myvideo") as any).srcObject = stream;
  };

  const enableAudio = async (mediaConstraints: MediaStreamConstraints) => {
    let stream = navigator.mediaDevices.getUserMedia(mediaConstraints);

    disableVideo();
    (document.querySelector("#myaudio") as any).srcObject = stream;
  };

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
      console.log("outgoing call accepted");
      setPeerAnswered(true);
      dispatch(callConnected(RtcCallState.OUTGOING_CALL_CONNECTED));
    };

    const callEnded = async (callState: RtcCallState, endTime: number) => {
      console.log("peer ended");
      setDialed(false);
      dispatch(callCompleted(callState, endTime));
      closeMedia();
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
          <video id="myvideo" autoPlay={true} playsInline={true}></video>
          <audio id="myaudio" autoPlay={true}></audio>
        </VideoWrapper>
      </Body>
    </Wrapper>
  );
};

export { RtcDisplay };
