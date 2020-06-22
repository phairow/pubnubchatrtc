import React, { useContext, useState } from "react";
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
import { rtcViewHidden } from "../../layout/LayoutActions";

const RtcDisplay = () => {
  const [video, setVideo] = useState(false);
  const [audio, setAudio] = useState(false);
  const dispatch = useDispatch();
  const views = useSelector(getViewStates);
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

  const toggleVideo = () => {
    updateMedia({ audio, video: !video });
    setVideo(!video);
  };

  const toggleAudio = () => {
    updateMedia({ audio: !audio, video });
    setAudio(!audio);
  };

  let myPeerConnection = new RTCPeerConnection({
    iceServers: [
      {
        urls: "stun:68.183.24.218:3478"
      }
      // {
      //   urls: "stun:stun.l.google.com:19302"
      // },
    ]
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

  return (
    <Wrapper displayed={views.Rtc}>
      <Header>
        <Title>Call</Title>
        <CloseButton
          onClick={() => {
            disableMedia();
            dispatch(rtcViewHidden());
          }}
        >
          <CrossIcon color={theme.colors.normalText} title="close" />
        </CloseButton>
      </Header>
      <Body>
        <button onClick={toggleVideo}>Video ({video ? "on" : "off"})</button>
        <button onClick={toggleAudio}>Audio ({audio ? "on" : "off"})</button>
        <VideoWrapper>
          <video id="myvideo" autoPlay={true} playsInline={true}></video>
          <audio id="myaudio" autoPlay={true}></audio>
        </VideoWrapper>
      </Body>
    </Wrapper>
  );
};

export { RtcDisplay };
