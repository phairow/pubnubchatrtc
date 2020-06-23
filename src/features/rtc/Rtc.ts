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

  return state.peerConnection;
};

export const getUserMedia = () => {};

export const createOffer = () => {};

export const setLocalDescription = () => {};

export const sendCandidate = () => {};

export const handleAnswer = () => {};

export const setRemoteDescription = () => {};
