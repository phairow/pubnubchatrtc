import { AppState } from "main/storeTypes";
import { createSelector } from "reselect";
import { AppActions } from "../../main/AppActions";

export enum CallState {
  IDLE = "IDLE",
  DIALING = "DIALING",
  RECEIVING_CALL = "RECEIVING_CALL",
  OUTGOING_CALL_REJECTED = "OUTGOING_CALL_REJECTED",
  INCOMMING_CALL_REJECTED = "INCOMMING_CALL_REJECTED",
  OUTGOING_CALL_CONNECTED = "OUTGOING_CALL_CONNECTED",
  INCOMMING_CALL_CONNECTED = "INCOMMING_CALL_CONNECTED",
  OUTGOING_CALL_COMPLETED = "OUTGOING_CALL_COMPLETED",
  INCOMMING_CALL_COMPLETED = "INCOMMING_CALL_COMPLETED"
}

export const USER_CALLED = "USER_CALLED";
export const USER_CALLING = "USER_CALLING";
export const CALL_REJECTED = "CALL_REJECTED";
export const CALL_CONNECTED = "CALL_CONNECTED";
export const CALL_COMPLETED = "CALL_COMPLETED";

export const userCalled = (userId: string): userCalledAction => ({
  type: USER_CALLED,
  payload: {
    userId
  }
});

export const userCalling = (userId: string): userCallingAction => ({
  type: USER_CALLING,
  payload: {
    userId
  }
});

export const callRejected = (status: CallState): callRejectedAction => ({
  type: CALL_REJECTED,
  payload: {
    status
  }
});

export const callConnected = (status: CallState): callConnectedAction => ({
  type: CALL_CONNECTED,
  payload: {
    status
  }
});

export const callCompleted = (status: CallState): callCompletedAction => ({
  type: CALL_COMPLETED,
  payload: {
    status
  }
});

type userCalledPayloadType = {
  userId: string;
};

type userCallingPayloadType = {
  userId: string;
};

type callRejectedPayloadType = {
  status: CallState;
};

type callConnectedPayloadType = {
  status: CallState;
};

type callCompletedPayloadType = {
  status: CallState;
};

export interface RtcState {
  peerUserId: string;
  callState: CallState;
}
export interface userCalledAction {
  type: typeof USER_CALLED;
  payload: userCalledPayloadType;
}

export interface userCallingAction {
  type: typeof USER_CALLING;
  payload: userCallingPayloadType;
}

export interface callRejectedAction {
  type: typeof CALL_REJECTED;
  payload: callRejectedPayloadType;
}

export interface callConnectedAction {
  type: typeof CALL_CONNECTED;
  payload: callConnectedPayloadType;
}

export interface callCompletedAction {
  type: typeof CALL_COMPLETED;
  payload: callCompletedPayloadType;
}

const initialState: RtcState = {
  peerUserId: "",
  callState: CallState.IDLE
};

const RtcStateReducer = (
  state: RtcState = initialState,
  action: AppActions
): RtcState => {
  switch (action.type) {
    case USER_CALLED: {
      return {
        ...state,
        peerUserId: action.payload.userId,
        callState: CallState.DIALING
      };
    }
    case USER_CALLING: {
      return {
        ...state,
        peerUserId: action.payload.userId,
        callState: CallState.RECEIVING_CALL
      };
    }
    case CALL_REJECTED: {
      return { ...state, callState: action.payload.status };
    }
    case CALL_CONNECTED: {
      return { ...state, callState: action.payload.status };
    }
    case CALL_COMPLETED: {
      return { ...state, callState: action.payload.status };
    }
    default:
      return state;
  }
};

const getRtcStateSlice = (state: AppState) => state.rtc;

export const getPeerUserId = createSelector(
  getRtcStateSlice,
  (rtc: RtcState): string => {
    return rtc.peerUserId;
  }
);

export const getCallState = createSelector(
  getRtcStateSlice,
  (rtc: RtcState): string => {
    return rtc.callState;
  }
);

export { RtcStateReducer };
