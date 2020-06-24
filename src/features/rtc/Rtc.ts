interface RtcState {
  peerConnection?: RTCPeerConnection;
}

let state: RtcState = {
  peerConnection: undefined
};

export const createPeerConnection = (
  iceConfig: RTCIceServer[]
): RTCPeerConnection => {
  state.peerConnection = new RTCPeerConnection({
    bundlePolicy: "max-compat",
    rtcpMuxPolicy: "negotiate",
    iceServers: iceConfig
  });

  state.peerConnection.onicegatheringstatechange = event => {
    console.log("onicegatheringstatechange", event);
  };
  state.peerConnection.oniceconnectionstatechange = event => {
    console.log("oniceconnectionstatechange", event);
  };
  state.peerConnection.onsignalingstatechange = event => {
    console.log("onsignalingstatechange", event);
  };

  return state.peerConnection;
};

export const getUserMedia = () => {};

export const createOffer = () => {};

export const setLocalDescription = () => {};

export const sendCandidate = () => {};

export const handleAnswer = () => {};

export const setRemoteDescription = () => {};
