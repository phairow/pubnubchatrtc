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
  CallState,
  getPeerUserId,
  getCallState,
  userCalling
} from "../RtcModel";
import { sendMessage as sendPubnubMessage } from "pubnub-redux";
import { MessageType, getMessagesById } from "../../messages/messageModel";
import { getUsersById } from "../../users/userModel";
import { createSelector } from "reselect";
import { getLoggedInUserId } from "../../authentication/authenticationModel";
import { callConnected } from "../RtcModel";

let dialingTimeoutSeconds = 3;

let iceServers = [
  {
    urls: "stun:68.183.24.218:3478"
  },
  {
    urls: "stun:stun.l.google.com:19302"
  }
];

export const getCallMessages = createSelector(
  [getMessagesById, getLoggedInUserId, getUsersById],
  (messages, userId, users): any => {
    return messages[userId]
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
  }
);

const RtcDisplay = () => {
  const [video, setVideo] = useState(false);
  const [audio, setAudio] = useState(false);
  const [dialed, setDialed] = useState(false);
  const dispatch = useDispatch();
  const peerUserId = useSelector(getPeerUserId);
  const callState = useSelector(getCallState);
  const callMessages = useSelector(getCallMessages);
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

  const enableVideo = (mediaConstraints: MediaStreamConstraints) => {
    navigator.mediaDevices.getUserMedia(mediaConstraints).then(stream => {
      disableAudio();
      (document.querySelector("#myvideo") as any).srcObject = stream;
    });
  };

  const enableAudio = (mediaConstraints: MediaStreamConstraints) => {
    navigator.mediaDevices.getUserMedia(mediaConstraints).then(stream => {
      disableVideo();
      (document.querySelector("#myaudio") as any).srcObject = stream;
    });
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

  const answerCall = () => {
    dispatch(
      sendPubnubMessage({
        channel: peerUserId,
        message: {
          type: MessageType.Rtc,
          callState: CallState.OUTGOING_CALL_CONNECTED,
          senderId: myId
        }
      })
    );

    dispatch(callConnected(CallState.INCOMMING_CALL_CONNECTED));
  };

  const toggleVideo = () => {
    updateMedia({ audio, video: !video });
    setVideo(!video);
  };

  const toggleAudio = () => {
    updateMedia({ audio: !audio, video });
    setAudio(!audio);
  };

  useEffect(() => {
    if (!dialed && callState === CallState.DIALING) {
      let myPeerConnection = new RTCPeerConnection({
        iceServers
      });

      myPeerConnection
        .createOffer()
        .then(function(offer) {
          console.log("offercreated", offer);
          return myPeerConnection.setLocalDescription(offer);
        })
        .then(function() {
          console.log(myPeerConnection.localDescription);
        })
        .catch(e => console.log("error in offer", e));

      dispatch(
        sendPubnubMessage({
          channel: peerUserId,
          message: {
            type: MessageType.Rtc,
            callState: CallState.DIALING,
            senderId: myId
          }
        })
      );
      setDialed(true);
    }

    if (callMessages && callMessages[callMessages.length - 1]) {
      const message = callMessages[callMessages.length - 1];

      if (
        callState !== CallState.INCOMMING_CALL_CONNECTED &&
        callState !== CallState.OUTGOING_CALL_CONNECTED
      ) {
        if (
          message.type === MessageType.Rtc &&
          message.callState === CallState.DIALING
        ) {
          dispatch(userCalling(message.sender.id));
          dispatch(rtcViewDisplayed());
        } else if (
          message.type === MessageType.Rtc &&
          message.callState === CallState.OUTGOING_CALL_CONNECTED
        ) {
          setDialed(false); // we are done dialing
          dispatch(callConnected(CallState.OUTGOING_CALL_CONNECTED));
        }
      }

      if (
        message.type === MessageType.Rtc &&
        message.callState === CallState.OUTGOING_CALL_COMPLETED
      ) {
        dispatch(callConnected(CallState.OUTGOING_CALL_COMPLETED));
      }
    }
  }, [callMessages, callState, dialed, dispatch, myId, peerUserId]);

  const closeMedia = () => {
    disableMedia();
    dispatch(rtcViewHidden());
    setDialed(false);
  };

  const endCall = () => {
    dispatch(
      sendPubnubMessage({
        channel: peerUserId,
        message: {
          type: MessageType.Rtc,
          callState: CallState.OUTGOING_CALL_COMPLETED,
          senderId: myId
        }
      })
    );

    if (callState === CallState.OUTGOING_CALL_CONNECTED) {
      dispatch(callConnected(CallState.OUTGOING_CALL_COMPLETED));
    }

    if (callState === CallState.INCOMMING_CALL_CONNECTED) {
      dispatch(callConnected(CallState.INCOMMING_CALL_CONNECTED));
    }

    closeMedia();
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
        {(callState === CallState.OUTGOING_CALL_CONNECTED ||
          callState === CallState.INCOMMING_CALL_CONNECTED) && (
          <button onClick={endCall}>Connected (click to end call)</button>
        )}
        <VideoWrapper>
          {callState === CallState.DIALING && <div>Dialing ...</div>}
          {callState === CallState.RECEIVING_CALL && (
            <div>
              Receiving Call ...
              <button onClick={answerCall}>Answer</button>
            </div>
          )}
          {(callState === CallState.OUTGOING_CALL_COMPLETED ||
            callState === CallState.INCOMMING_CALL_COMPLETED) && (
            <div>Call Completed</div>
          )}
          <video id="myvideo" autoPlay={true} playsInline={true}></video>
          <audio id="myaudio" autoPlay={true}></audio>
        </VideoWrapper>
      </Body>
    </Wrapper>
  );
};

export { RtcDisplay };
