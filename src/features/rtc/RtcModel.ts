import { AppState } from "main/storeTypes";
import { createSelector } from "reselect";
import { AppActions } from "../../main/AppActions";
import { RtcCallState } from "./RtcCallState.enum";
import { RtcCallType } from "./RtcCallType.enum";

export const OUTGOING_CALL_INITIATED = "OUTGOING_CALL_INITIATED";
export const INCOMING_CALL_RECEIVED = "INCOMING_CALL_RECEIVED";

export const INCOMING_CALL_ACCEPTED = "INCOMING_CALL_ACCEPTED";
export const OUTGOING_CALL_ACCEPTED = "OUTGOING_CALL_ACCEPTED";

// export const CALL_REJECTED = "CALL_REJECTED";
// export const CALL_CONNECTED = "CALL_CONNECTED";
export const CALL_COMPLETED = "CALL_COMPLETED";

// export const CALL_NOT_ANSWERED = "CALL_NOT_ANSWERED";
// // only incoming calls
// export const CALL_SIGNAL_RECEIVED = "CALL_SIGNAL_RECEIVED";
// export const CALL_MISSED = "CALL_MISSED";

export interface RtcCallInfo {
  callType: RtcCallType;
  callState: RtcCallState;
  peerUserId: string;
  startTime: number;
  endTime?: number;
}

export interface RtcState {
  currentCall: RtcCallInfo;
  lastIncomingCall: RtcCallInfo;
  callLog: RtcCallInfo[];
}

const initialState: RtcState = {
  currentCall: {
    callType: RtcCallType.NONE,
    callState: RtcCallState.NONE,
    peerUserId: "",
    startTime: 0
  },
  lastIncomingCall: {
    callType: RtcCallType.NONE,
    callState: RtcCallState.NONE,
    peerUserId: "",
    startTime: 0
  },
  callLog: []
};

export const outgoingCallInitiated = (
  userId: string,
  startTime: number
): OutgoingCallInitiatedAction => ({
  type: OUTGOING_CALL_INITIATED,
  payload: {
    userId,
    startTime
  }
});

export const incomingCallReceived = (
  userId: string,
  startTime: number
): IncomingCallReceivedAction => ({
  type: INCOMING_CALL_RECEIVED,
  payload: {
    userId,
    startTime
  }
});

export const incomingCallAccepted = (
  userId: string,
  startTime: number
): IncomingCallAcceptedAction => ({
  type: INCOMING_CALL_ACCEPTED,
  payload: {
    userId,
    startTime
  }
});

export const outgoingCallAccepted = (
  userId: string,
  startTime: number
): OutgoingCallAcceptedAction => ({
  type: OUTGOING_CALL_ACCEPTED,
  payload: {
    userId,
    startTime
  }
});

// export const callMissed = (endTime: number): callMissedAction => ({
//   type: CALL_MISSED,
//   payload: {
//     endTime
//   }
// });

// export const callNotAnswered = (endTime: number): callNotAnsweredAction => ({
//   type: CALL_NOT_ANSWERED,
//   payload: {
//     endTime
//   }
// });

// export const callRejected = (
//   status: RtcCallState,
//   endTime: number
// ): callRejectedAction => ({
//   type: CALL_REJECTED,
//   payload: {
//     status,
//     endTime
//   }
// });

// export const callConnected = (status: RtcCallState): callConnectedAction => ({
//   type: CALL_CONNECTED,
//   payload: {
//     status
//   }
// });

export const callCompleted = (
  userId: string,
  startTime: number,
  endTime: number
): CallCompletedAction => ({
  type: CALL_COMPLETED,
  payload: {
    userId,
    startTime,
    endTime
  }
});

type CallActionPayload = {
  userId: string;
  startTime: number;
};

type EndCallActionPayload = {
  userId: string;
  startTime: number;
  endTime: number;
};

export interface OutgoingCallInitiatedAction {
  type: typeof OUTGOING_CALL_INITIATED;
  payload: CallActionPayload;
}

export interface IncomingCallReceivedAction {
  type: typeof INCOMING_CALL_RECEIVED;
  payload: CallActionPayload;
}

export interface IncomingCallAcceptedAction {
  type: typeof INCOMING_CALL_ACCEPTED;
  payload: CallActionPayload;
}

export interface OutgoingCallAcceptedAction {
  type: typeof OUTGOING_CALL_ACCEPTED;
  payload: CallActionPayload;
}

// export interface callRejectedAction {
//   type: typeof CALL_REJECTED;
//   payload: callRejectedPayloadType;
// }

// export interface callMissedAction {
//   type: typeof CALL_MISSED;
//   payload: callMissedPayloadType;
// }
// export interface callNotAnsweredAction {
//   type: typeof CALL_NOT_ANSWERED;
//   payload: callNotAnsweredPayloadType;
// }
// export interface callConnectedAction {
//   type: typeof CALL_CONNECTED;
//   payload: callConnectedPayloadType;
// }

export interface CallCompletedAction {
  type: typeof CALL_COMPLETED;
  payload: EndCallActionPayload;
}

const RtcStateReducer = (
  state: RtcState = initialState,
  action: AppActions
): RtcState => {
  switch (action.type) {
    case OUTGOING_CALL_INITIATED:
      return {
        ...state,
        currentCall: {
          peerUserId: action.payload.userId,
          callType: RtcCallType.OUTGOING,
          callState: RtcCallState.INITIATED,
          startTime: action.payload.startTime
        }
      };
    case INCOMING_CALL_RECEIVED:
      if (state.currentCall.callState === RtcCallState.CONNECTED) {
        // calls received while already in a call will be missed call and added to the call log.
        // we may want to add the ability to end the current call and accept a new one in the future.

        const newCall = {
          peerUserId: action.payload.userId,
          callType: RtcCallType.INCOMING,
          callState: RtcCallState.NOT_ANSWERED,
          startTime: action.payload.startTime,
          missed: true
        };

        return {
          ...state,
          lastIncomingCall: newCall,
          callLog: [...state.callLog, newCall]
        };
      }

      // most recent incoming call wins, we don't have busy
      // signal and we don't block simultaneous incoming calls

      const newCall = {
        peerUserId: action.payload.userId,
        callType: RtcCallType.INCOMING,
        callState: RtcCallState.RECEIVING,
        startTime: action.payload.startTime
      };

      return {
        ...state,
        lastIncomingCall: newCall
      };
    case INCOMING_CALL_ACCEPTED:
      // only the lastIncomingCall can be answered

      if (
        state.lastIncomingCall.callState === RtcCallState.RECEIVING &&
        state.lastIncomingCall.peerUserId === action.payload.userId &&
        state.lastIncomingCall.startTime === action.payload.startTime
      ) {
        const currentCall = {
          ...state.lastIncomingCall,
          callState: RtcCallState.ACCEPTED
        };

        return {
          ...state,
          lastIncomingCall: currentCall,
          currentCall
        };
      } else {
        return state;
      }
    case OUTGOING_CALL_ACCEPTED:
      const currentCall = {
        ...state.currentCall,
        callState: RtcCallState.ACCEPTED
      };

      return {
        ...state,
        currentCall
      };
    // case CALL_REJECTED: {
    //   const currentCall = {
    //     ...state.currentCall,
    //     endTime: action.payload.endTime,
    //     callState: action.payload.status
    //   };

    //   return {
    //     ...state,
    //     currentCall,
    //     callLog: [...state.callLog, currentCall]
    //   };
    // }
    // case CALL_MISSED: {
    //   const currentCall = {
    //     ...state.currentCall,
    //     endTime: action.payload.endTime,
    //     callState: RtcCallState.NOT_ANSWERED
    //   };

    //   return {
    //     ...state,
    //     currentCall,
    //     callLog: [...state.callLog, currentCall]
    //   };
    // }
    // case CALL_NOT_ANSWERED: {
    //   const currentCall = {
    //     ...state.currentCall,
    //     endTime: action.payload.endTime,
    //     callState: RtcCallState.CALL_NOT_ANSWERED,
    //     notAnswered: true
    //   };

    //   return {
    //     ...state,
    //     currentCall,
    //     callLog: [...state.callLog, currentCall]
    //   };
    // }
    // case CALL_CONNECTED: {
    //   const currentCall = {
    //     ...state.currentCall,
    //     callState: action.payload.status
    //   };

    //   return {
    //     ...state,
    //     currentCall
    //   };
    // }
    case CALL_COMPLETED:
      // only the currentCall can be answered

      if (
        state.currentCall.peerUserId === action.payload.userId &&
        state.currentCall.startTime === action.payload.startTime
      ) {
        const currentCall = {
          ...state.currentCall,
          callState: RtcCallState.COMPLETED,
          endTime: action.payload.endTime
        };

        return {
          ...state,
          currentCall,
          callLog: [...state.callLog, currentCall]
        };
      } else {
        return state;
      }
    default:
      return state;
  }
};

const getRtcStateSlice = (state: AppState) => state.rtc;

export const getCurrentCall = createSelector(
  getRtcStateSlice,
  (rtc: RtcState): RtcCallInfo => {
    return rtc.currentCall;
  }
);

export const getLastIncomingCall = createSelector(
  getRtcStateSlice,
  (rtc: RtcState): RtcCallInfo => {
    return rtc.lastIncomingCall;
  }
);

export { RtcStateReducer };
