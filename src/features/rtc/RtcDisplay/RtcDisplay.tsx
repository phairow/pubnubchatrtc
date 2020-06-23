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
import { getPeerUserId, getCallState, userCalling } from "../RtcModel";
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
  const [video, setVideo] = useState(false);
  const [audio, setAudio] = useState(false);
  const [dialed, setDialed] = useState(false);
  const dispatch = useDispatch();
  const peerUserId = useSelector(getPeerUserId);
  const callState = useSelector(getCallState);
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
          callState: RtcCallState.OUTGOING_CALL_CONNECTED,
          senderId: myId
        }
      })
    );

    dispatch(callConnected(RtcCallState.INCOMMING_CALL_CONNECTED));
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
    let offer: object = {};

    if (!dialed && callState === RtcCallState.DIALING) {
      let myPeerConnection = new RTCPeerConnection({
        iceServers: ICE_CONFIG
      });

      myPeerConnection
        .createOffer()
        .then(function(o) {
          offer = o;
          console.log("offercreated", offer);
          return myPeerConnection.setLocalDescription(offer);
        })
        .then(function() {
          console.log(myPeerConnection.localDescription);
        })
        .catch(e => console.log("error in offer", e));

      navigator.mediaDevices.getUserMedia({ video: true }).then(stream => {
        stream
          .getTracks()
          .forEach(track => myPeerConnection.addTrack(track, stream));
      });
      dispatch(
        sendPubnubMessage({
          channel: peerUserId,
          message: {
            type: MessageType.Rtc,
            callState: RtcCallState.DIALING,
            peerDescription: offer,
            senderId: myId
          }
        })
      );
      setDialed(true);
    }

    if (lastCallMessage) {
      if (
        callState !== RtcCallState.INCOMMING_CALL_CONNECTED &&
        callState !== RtcCallState.OUTGOING_CALL_CONNECTED
      ) {
        if (
          lastCallMessage.type === MessageType.Rtc &&
          lastCallMessage.callState === RtcCallState.DIALING
        ) {
          dispatch(userCalling(lastCallMessage.sender.id));
          dispatch(rtcViewDisplayed());

          let myPeerConnection = new RTCPeerConnection({
            iceServers: ICE_CONFIG
          });

          if (lastCallMessage.peerDescription) {
            myPeerConnection
              .createOffer()
              .then(function(o) {
                offer = o;
                console.log("offercreated", offer);
                let desc = new RTCSessionDescription(
                  lastCallMessage.peerDescription.sdp
                );
                myPeerConnection.setRemoteDescription(
                  new RTCSessionDescription(desc)
                );

                myPeerConnection.ontrack = event => {
                  // don't set srcObject again if it is already set.
                  if ((document.querySelector("#myvideo") as any).srcObject)
                    return;
                  (document.querySelector("#myvideo") as any).srcObject =
                    event.streams[0];
                };
                myPeerConnection.setLocalDescription(offer);
              })
              .then(function() {
                console.log(myPeerConnection.localDescription);
              })
              .catch(e => console.log("error in offer", e));
          }
        } else if (
          lastCallMessage.type === MessageType.Rtc &&
          lastCallMessage.callState === RtcCallState.OUTGOING_CALL_CONNECTED
        ) {
          setDialed(false); // we are done dialing
          dispatch(callConnected(RtcCallState.OUTGOING_CALL_CONNECTED));
        }
      }

      if (
        lastCallMessage.type === MessageType.Rtc &&
        lastCallMessage.callState === RtcCallState.OUTGOING_CALL_COMPLETED
      ) {
        dispatch(callConnected(RtcCallState.OUTGOING_CALL_COMPLETED));
      }
    }
  }, [lastCallMessage, callState, dialed, dispatch, myId, peerUserId]);

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
          callState: RtcCallState.OUTGOING_CALL_COMPLETED,
          senderId: myId
        }
      })
    );

    if (callState === RtcCallState.OUTGOING_CALL_CONNECTED) {
      dispatch(callConnected(RtcCallState.OUTGOING_CALL_COMPLETED));
    }

    if (callState === RtcCallState.INCOMMING_CALL_CONNECTED) {
      dispatch(callConnected(RtcCallState.INCOMMING_CALL_CONNECTED));
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
        {(callState === RtcCallState.OUTGOING_CALL_CONNECTED ||
          callState === RtcCallState.INCOMMING_CALL_CONNECTED) && (
          <button onClick={endCall}>Connected (click to end call)</button>
        )}
        <VideoWrapper>
          {callState === RtcCallState.DIALING && <div>Dialing ...</div>}
          {callState === RtcCallState.RECEIVING_CALL && (
            <div>
              Receiving Call ...
              <button onClick={answerCall}>Answer</button>
            </div>
          )}
          {(callState === RtcCallState.OUTGOING_CALL_COMPLETED ||
            callState === RtcCallState.INCOMMING_CALL_COMPLETED) && (
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
