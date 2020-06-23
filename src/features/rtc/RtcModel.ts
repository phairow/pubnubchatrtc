import { AppState } from "main/storeTypes";
import { createSelector } from "reselect";
import { AppActions } from "../../main/AppActions";
import { RtcCallState } from "./RtcCallState";

// both incoming and outgoing calls
export const CALL_REJECTED = "CALL_REJECTED";
export const CALL_CONNECTED = "CALL_CONNECTED";
export const CALL_COMPLETED = "CALL_COMPLETED";

// only outgoing calls
export const CALL_SIGNAL_SENT = "CALL_SIGNAL_SENT";
export const CALL_NOT_ANSWERED = "CALL_NOT_ANSWERED";

// only incoming calls
export const CALL_ACCEPTED = "CALL_ACCEPTED";
export const CALL_SIGNAL_RECEIVED = "CALL_SIGNAL_RECEIVED";
export const CALL_MISSED = "CALL_MISSED";

export interface RtcCallInfo {
  callState: RtcCallState;
  peerUserId: string;
  startTime: number;
  endTime?: number;
  completed?: boolean;
  missed?: boolean;
  notAnswered?: boolean;
  rejected?: boolean;
}

export interface RtcState {
  currentCall: RtcCallInfo;
  lastIncomingCall: RtcCallInfo;
  callLog: RtcCallInfo[];
}

const initialState: RtcState = {
  currentCall: { callState: RtcCallState.NONE, peerUserId: "", startTime: 0 },
  lastIncomingCall: {
    callState: RtcCallState.NONE,
    peerUserId: "",
    startTime: 0
  },
  callLog: []
};

export const callSignalSent = (
  userId: string,
  startTime: number
): callSignalSentAction => ({
  type: CALL_SIGNAL_SENT,
  payload: {
    userId,
    startTime
  }
});

export const callSignalReceived = (
  userId: string,
  startTime: number
): callSignalReceivedAction => ({
  type: CALL_SIGNAL_RECEIVED,
  payload: {
    userId,
    startTime
  }
});

export const callAccepted = (
  userId: string,
  startTime: number
): callAcceptedAction => ({
  type: CALL_ACCEPTED,
  payload: {
    userId,
    startTime
  }
});

export const callMissed = (endTime: number): callMissedAction => ({
  type: CALL_MISSED,
  payload: {
    endTime
  }
});

export const callNotAnswered = (endTime: number): callNotAnsweredAction => ({
  type: CALL_NOT_ANSWERED,
  payload: {
    endTime
  }
});

export const callRejected = (
  status: RtcCallState,
  endTime: number
): callRejectedAction => ({
  type: CALL_REJECTED,
  payload: {
    status,
    endTime
  }
});

export const callConnected = (status: RtcCallState): callConnectedAction => ({
  type: CALL_CONNECTED,
  payload: {
    status
  }
});

export const callCompleted = (
  status: RtcCallState,
  endTime: number
): callCompletedAction => ({
  type: CALL_COMPLETED,
  payload: {
    status,
    endTime
  }
});

type callSignalSentPayloadType = {
  userId: string;
  startTime: number;
};

type callSignalReceivedPayloadType = {
  userId: string;
  startTime: number;
};

type callAcceptedPayloadType = {
  userId: string;
  startTime: number;
};

type callRejectedPayloadType = {
  status: RtcCallState;
  endTime: number;
};

type callMissedPayloadType = {
  endTime: number;
};

type callNotAnsweredPayloadType = {
  endTime: number;
};

type callConnectedPayloadType = {
  status: RtcCallState;
};

type callCompletedPayloadType = {
  status: RtcCallState;
  endTime: number;
};
export interface callSignalSentAction {
  type: typeof CALL_SIGNAL_SENT;
  payload: callSignalSentPayloadType;
}

export interface callSignalReceivedAction {
  type: typeof CALL_SIGNAL_RECEIVED;
  payload: callSignalReceivedPayloadType;
}

export interface callAcceptedAction {
  type: typeof CALL_ACCEPTED;
  payload: callAcceptedPayloadType;
}

export interface callRejectedAction {
  type: typeof CALL_REJECTED;
  payload: callRejectedPayloadType;
}

export interface callMissedAction {
  type: typeof CALL_MISSED;
  payload: callMissedPayloadType;
}
export interface callNotAnsweredAction {
  type: typeof CALL_NOT_ANSWERED;
  payload: callNotAnsweredPayloadType;
}
export interface callConnectedAction {
  type: typeof CALL_CONNECTED;
  payload: callConnectedPayloadType;
}

export interface callCompletedAction {
  type: typeof CALL_COMPLETED;
  payload: callCompletedPayloadType;
}

const RtcStateReducer = (
  state: RtcState = initialState,
  action: AppActions
): RtcState => {
  switch (action.type) {
    case CALL_SIGNAL_SENT: {
      return {
        ...state,
        currentCall: {
          peerUserId: action.payload.userId,
          callState: RtcCallState.DIALING,
          startTime: action.payload.startTime
        }
      };
    }
    case CALL_SIGNAL_RECEIVED: {
      if (
        state.currentCall.callState === RtcCallState.OUTGOING_CALL_CONNECTED ||
        state.currentCall.callState === RtcCallState.INCOMING_CALL_CONNECTED
      ) {
        // TODO: currently calls received while already in a call will be ignored
        // we may want to add the ability to end the current call and accept the new one

        const newCall = {
          peerUserId: action.payload.userId,
          callState: RtcCallState.RECEIVING_CALL,
          startTime: action.payload.startTime,
          missed: true
        };

        return {
          ...state,
          lastIncomingCall: newCall,
          callLog: [...state.callLog, newCall]
        };
      }

      const newCall = {
        peerUserId: action.payload.userId,
        callState: RtcCallState.RECEIVING_CALL,
        startTime: action.payload.startTime
      };

      return {
        ...state,
        lastIncomingCall: newCall
      };
    }
    case CALL_ACCEPTED: {
      const currentCall = {
        ...state.lastIncomingCall,
        startTime: action.payload.startTime,
        callState: RtcCallState.ACCEPTED
      };

      return {
        ...state,
        currentCall
      };
    }
    case CALL_REJECTED: {
      const currentCall = {
        ...state.currentCall,
        endTime: action.payload.endTime,
        callState: action.payload.status,
        rejected: true
      };

      return {
        ...state,
        currentCall,
        callLog: [...state.callLog, currentCall]
      };
    }
    case CALL_MISSED: {
      const currentCall = {
        ...state.currentCall,
        endTime: action.payload.endTime,
        callState: RtcCallState.MISSED_CALL,
        missed: true
      };

      return {
        ...state,
        currentCall,
        callLog: [...state.callLog, currentCall]
      };
    }
    case CALL_NOT_ANSWERED: {
      const currentCall = {
        ...state.currentCall,
        endTime: action.payload.endTime,
        callState: RtcCallState.CALL_NOT_ANSWERED,
        notAnswered: true
      };

      return {
        ...state,
        currentCall,
        callLog: [...state.callLog, currentCall]
      };
    }
    case CALL_CONNECTED: {
      const currentCall = {
        ...state.currentCall,
        callState: action.payload.status
      };

      return {
        ...state,
        currentCall
      };
    }
    case CALL_COMPLETED: {
      const currentCall = {
        ...state.currentCall,
        callState: action.payload.status,
        completed: true
      };

      return {
        ...state,
        currentCall,
        callLog: [...state.callLog, currentCall]
      };
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

export const getLastIncommingCall = createSelector(
  getRtcStateSlice,
  (rtc: RtcState): RtcCallInfo => {
    return rtc.lastIncomingCall;
  }
);

export { RtcStateReducer };
