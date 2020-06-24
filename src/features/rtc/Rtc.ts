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
    iceServers: iceConfig
  });

  state.peerConnection.onicegatheringstatechange = event => {
    console.log("onicegatheringstatechange", event);
  };
  state.peerConnection.oniceconnectionstatechange = event => {
    console.log("oniceconnectionstatechange", event);
  };
  state.peerConnection.onicecandidateerror = event => {
    console.log("onicecandidateerror", event);
  };
  state.peerConnection.onconnectionstatechange = event => {
    console.log("onconnectionstatechange", event);
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
