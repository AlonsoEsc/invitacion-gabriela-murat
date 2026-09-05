import { httpsCallable } from "firebase/functions";
import { getFirebaseFunctions, isFirebaseConfigured } from "../lib/firebase.js";

function callableError(error) {
  const code = error?.details?.reason || error?.code?.replace("functions/", "") || "unknown";
  return new Error(code, { cause: error });
}

async function call(name, data) {
  if (!isFirebaseConfigured) throw new Error("firebase-not-configured");
  try {
    const result = await httpsCallable(getFirebaseFunctions(), name)(data);
    return result.data;
  } catch (error) {
    throw callableError(error);
  }
}

export const getInvitation = (token) => call("getInvitation", { token });

export const submitRsvp = (payload) => {
  const data = {
    ...payload,
    submissionId: globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
  };
  if (!data.guestEmail) delete data.guestEmail;
  return call("submitRsvp", data);
};

export const createInvitation = (payload) => call("createInvitation", payload);
export const updateInvitation = (invitationId, payload) => call("updateInvitation", { invitationId, ...payload });
export const importInvitations = (rows) => call("importInvitations", { rows });
export const retryRsvpEmail = (invitationId) => call("retryRsvpEmail", { invitationId });
