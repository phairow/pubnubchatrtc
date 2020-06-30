import RtcSettings from "config/rtcSettings.json";

const ICE_CONFIG = RtcSettings.rtcIceConfig;
const DIALING_TIMEOUT_SECONDS = RtcSettings.rtcDialingTimeoutSeconds;

interface RtcState {
  peerConnection: RTCPeerConnection;
  userMediaStream?: MediaStream;
  inboundStream?: MediaStream;
  negotingOffer: boolean;
  iceCandidateHandler: (candidate: RTCIceCandidate | null) => void;
}

let state: RtcState = {
  peerConnection: new RTCPeerConnection(),
  userMediaStream: undefined,
  inboundStream: undefined,
  negotingOffer: false,
  iceCandidateHandler: (candidate: RTCIceCandidate | null) => {
    console.log("default ice candidate handler");
  }
};

export const createPeerConnection = async () => {
  console.log("create peer connection");

  state.negotingOffer = false;
  state.inboundStream = undefined;

  if (state.peerConnection.connectionState !== "closed") {
    try {
      console.log("create peer connection: closing previous peer connection");
      state.peerConnection.close();
    } catch (e) {
      console.log("error closing peer connection: ", e);
    }
  }

  console.log("create peer connection: creating new peer connection");
  state.peerConnection = new RTCPeerConnection({
    iceServers: ICE_CONFIG
  });

  state.peerConnection.onicecandidate = event => {
    return state.iceCandidateHandler(event.candidate);
  };

  state.peerConnection.onconnectionstatechange = event => {
    console.log(
      "onconnectionstatechange - connectionState: ",
      state.peerConnection.connectionState
    );
  };
  state.peerConnection.onicegatheringstatechange = event => {
    console.log(
      "onicegatheringstatechange - iceGatheringState: ",
      state.peerConnection.iceGatheringState
    );
  };
  state.peerConnection.oniceconnectionstatechange = event => {
    console.log(
      "oniceconnectionstatechange - iceConnectionState: ",
      state.peerConnection.iceConnectionState
    );
  };
  state.peerConnection.onsignalingstatechange = event => {
    console.log(
      "onsignalingstatechange - signalingState: ",
      state.peerConnection.signalingState
    );
  };
};

export const connectMedia = async (constraints: MediaStreamConstraints) => {
  console.log("connect media");
  if (!state.userMediaStream) {
    console.log("connect media: getting user media");
    state.userMediaStream = await navigator.mediaDevices.getUserMedia(
      constraints
    );
  }

  return state.userMediaStream.clone();
};

export const disconnectMedia = async () => {
  if (state.userMediaStream) {
    state.userMediaStream.getTracks().forEach(track => track.stop());
  }

  if (state.inboundStream) {
    state.inboundStream.getTracks().forEach(track => track.stop());
  }
};

export const sendMedia = () => {
  console.log("send media");

  if (state.userMediaStream) {
    console.log("send media: adding tracks");
    state.userMediaStream
      .clone()
      .getTracks()
      .forEach(track => {
        if (state.userMediaStream) {
          state.peerConnection.addTrack(track, state.userMediaStream);
        }
      });
  }
};

export const createIceOffer = async () => {
  const offer = await state.peerConnection.createOffer();

  console.log("createIceOffer: attempting local offer", offer);

  try {
    await state.peerConnection.setLocalDescription(offer);
    console.log(
      "createIceOffer: created: ",
      state.peerConnection.localDescription
    );
  } catch (e) {
    console.log("createIceOffer: error setting local offer: ", e);
  }

  return state.peerConnection.localDescription;
};

export const createIceAnswer = async () => {
  const answer = await state.peerConnection.createAnswer();

  console.log("createIceAnswer: attempting local answer", answer);

  try {
    await state.peerConnection.setLocalDescription(answer);
    console.log(
      "createIceAnswer: created: ",
      state.peerConnection.localDescription
    );
  } catch (e) {
    console.log("createIceAnswer: error setting local answer: ", e);
  }

  return state.peerConnection.localDescription;
};

export const setLocalDescription = async (offer: RTCSessionDescription) => {
  console.log(
    "setLocalDescription: ",
    state.negotingOffer,
    state.peerConnection.signalingState
  );

  if (state.negotingOffer || state.peerConnection.signalingState !== "stable") {
    // exit if already negotiating offer or unstable
    return;
  }

  try {
    await state.peerConnection.setLocalDescription(offer);
  } catch (e) {
    console.log("setLocalDescription: error setting remote desc: ", e);
  }
};

export const setRemoteDescription = async (offer: RTCSessionDescription) => {
  console.log(
    "setRemoteDescription: ",
    state.negotingOffer,
    state.peerConnection.signalingState
  );

  if (state.negotingOffer || state.peerConnection.signalingState !== "stable") {
    // exit if already negotiating offer or unstable
    return;
  }

  try {
    await state.peerConnection.setRemoteDescription(offer);
  } catch (e) {
    console.log("setRemoteDescription: error setting remote desc: ", e);
  }
};

export const addIceCandidate = async (candidate: RTCIceCandidate) => {
  console.log("ice candidate adding", candidate);
  state.peerConnection.addIceCandidate(candidate);
};

export const setIceCandidateHandler = (
  handler: (candidate: RTCIceCandidate | null) => void
) => {
  state.iceCandidateHandler = handler;

  state.peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
    console.log("in onicecandidate");
    handler(event.candidate);
  };
};

//   return state?.userMediaStream.clone();
// };

// const initPeerConnection = async () => {
//   state.peerConnection = createPeerConnection(ICE_CONFIG);
//   state.inboundStream = undefined;

//   // send ice candidates to peer
//   state.peerConnection.onicecandidate = async e => {
//     if (e.candidate) {
//       console.log("candidate sent to peer");

//       console.log("candidate: sending candidate ", e);
//       console.log(
//         "candidate: ice candidate length ",
//         e.candidate && e.candidate.candidate && e.candidate.candidate.length
//       );

//       try {
//         await pubnub.publish({
//           channel: currentCall.peerUserId,
//           message: {
//             candidate: e.candidate
//           }
//         });
//       } catch (e) {
//         console.log("error sending ice candidate to peer", e);
//       }
//     }
//   };

//   state.peerConnection.ontrack = e => {
//     if (e.streams && e.streams[0]) {
//       (document.querySelector("#remotevideo") as any).srcObject =
//         e.streams[0];
//     } else {
//       if (!state.inboundStream) {
//         state.inboundStream = new MediaStream();
//         (document.querySelector("#remotevideo") as any).srcObject =
//           state.inboundStream;
//       }
//       state.inboundStream.addTrack(e.track);
//     }
//   };

//   state.peerConnection.onconnectionstatechange = async e => {
//     console.log(
//       "onconnectionstatechange",
//       state.peerConnection.connectionState
//     );
//   };

//   state.peerConnection.onnegotiationneeded = async () => {
//     console.log("negotiation: on negotiation needed");

//     try {
//       state.negotingOffer = true;

//       await connectMedia();
//       await updateMedia({ audio, video });

//       const offer = await state.peerConnection.createOffer();

//       console.log("negotiation: attempting local offer", offer);

//       try {
//         await state.peerConnection.setLocalDescription(offer);
//       } catch (e) {
//         console.log("negotiation: error setting local desc: ", e);
//       }

//       console.log(
//         "negotiation: sending offer",
//         state.peerConnection.localDescription
//       );

//       console.log("negotiation: sending local offer to peer");

//       try {
//         await pubnub.publish({
//           channel: currentCall.peerUserId,
//           message: {
//             offer: state.peerConnection.localDescription
//           }
//         });
//       } catch (e) {
//         console.log("error sending offer from negotiation needed", e);
//       }
//     } catch (e) {
//       console.log("error in negotiation needed", e);
//     } finally {
//       state.negotingOffer = false;
//     }
//   };
// };
