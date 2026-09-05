import { initializeApp } from "firebase-admin/app";
import { FieldValue, Timestamp, getFirestore } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";
import { defineSecret, defineString } from "firebase-functions/params";
import { randomUUID } from "node:crypto";
import { buildShareUrl, cleanText, invitationToken, tokenHash, validateInvitationInput, validateRsvpInput } from "./domain.js";
import { deliverRsvpEmails } from "./email.js";

initializeApp();
const db = getFirestore();
const REGION = "us-central1";
const RESEND_API_KEY = defineSecret("RESEND_API_KEY");
const COUPLE_EMAILS = defineString("COUPLE_EMAILS", { default: "" });
const EMAIL_FROM = defineString("EMAIL_FROM", { default: "Gabriela & Murad <onboarding@resend.dev>" });
const PUBLIC_SITE_URL = defineString("PUBLIC_SITE_URL", { default: "https://alonsoesc.github.io/invitacion-gabriela-murat/" });
const RSVP_DEADLINE = defineString("RSVP_DEADLINE", { default: "2026-12-02T05:59:59.000Z" });

function asHttpsError(error) {
  if (error instanceof HttpsError) return error;
  const map = {
    required: ["invalid-argument", "Falta un dato obligatorio."],
    "too-long": ["invalid-argument", "Uno de los campos excede el máximo permitido."],
    "invalid-email": ["invalid-argument", "El correo no es válido."],
    "invalid-token": ["not-found", "Invitación no encontrada."],
    "invalid-capacity": ["invalid-argument", "La cantidad de cupos no es válida."],
    "invalid-status": ["invalid-argument", "La respuesta no es válida."],
    "invalid-attendance-count": ["invalid-argument", "La cantidad de asistentes no es válida."],
    "invalid-attendee-names": ["invalid-argument", "Debes indicar el nombre de cada asistente."],
    "email-required": ["invalid-argument", "Se necesita un correo para enviar la confirmación."],
  };
  const [code, message] = map[error?.message] || ["internal", "No fue posible completar la operación."];
  return new HttpsError(code, message);
}

async function requireAdmin(request) {
  if (!request.auth?.uid) throw new HttpsError("unauthenticated", "Inicia sesión para continuar.");
  const admin = await db.doc(`admins/${request.auth.uid}`).get();
  if (!admin.exists || admin.data()?.active === false) throw new HttpsError("permission-denied", "No tienes permisos de administrador.");
  return request.auth.uid;
}

function publicInvitation(data) {
  return {
    displayName: data.displayName,
    maxAttendees: data.maxAttendees,
    defaultLanguage: data.defaultLanguage,
    hasContactEmail: Boolean(data.contactEmail),
    response: data.status && data.status !== "pending" ? {
      status: data.status,
      attendingCount: data.attendingCount || 0,
      attendeeNames: data.attendeeNames || [],
      message: data.message || "",
      respondedAt: data.respondedAt?.toDate?.()?.toISOString?.() || null,
    } : null,
  };
}

function newInvitation(input, adminUid) {
  const data = validateInvitationInput(input);
  const token = invitationToken();
  return {
    id: tokenHash(token),
    token,
    record: {
      ...data,
      token,
      status: "pending",
      attendingCount: 0,
      attendeeNames: [],
      message: "",
      emailStatus: { overall: "not-sent" },
      rsvpDeadlineAt: Timestamp.fromDate(new Date(RSVP_DEADLINE.value())),
      createdBy: adminUid,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    },
  };
}

export const getInvitation = onCall({ region: REGION, cors: true }, async (request) => {
  try {
    const id = tokenHash(request.data?.token);
    const snapshot = await db.doc(`invitations/${id}`).get();
    if (!snapshot.exists || snapshot.data()?.disabled) throw new HttpsError("not-found", "Invitación no encontrada.");
    return publicInvitation(snapshot.data());
  } catch (error) {
    throw asHttpsError(error);
  }
});

export const createInvitation = onCall({ region: REGION }, async (request) => {
  try {
    const adminUid = await requireAdmin(request);
    const invitation = newInvitation(request.data, adminUid);
    await db.doc(`invitations/${invitation.id}`).create(invitation.record);
    return { ...validateInvitationInput(request.data), shareUrl: buildShareUrl(PUBLIC_SITE_URL.value(), invitation.token, invitation.record.defaultLanguage) };
  } catch (error) {
    throw asHttpsError(error);
  }
});

export const updateInvitation = onCall({ region: REGION }, async (request) => {
  try {
    const adminUid = await requireAdmin(request);
    const invitationId = cleanText(request.data?.invitationId, 100, true);
    if (!/^[a-f0-9]{64}$/.test(invitationId)) throw new HttpsError("invalid-argument", "Identificador de invitación no válido.");
    const data = validateInvitationInput(request.data);
    const invitationRef = db.doc(`invitations/${invitationId}`);

    await db.runTransaction(async (transaction) => {
      const snapshot = await transaction.get(invitationRef);
      if (!snapshot.exists) throw new HttpsError("not-found", "Invitación no encontrada.");
      const current = snapshot.data();
      if ((current.attendingCount || 0) > data.maxAttendees) {
        throw new HttpsError("failed-precondition", "Los cupos no pueden ser menores que las personas ya confirmadas.");
      }
      transaction.update(invitationRef, {
        ...data,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: adminUid,
      });
    });

    return { saved: true };
  } catch (error) {
    throw asHttpsError(error);
  }
});

export const importInvitations = onCall({ region: REGION, timeoutSeconds: 120 }, async (request) => {
  try {
    const adminUid = await requireAdmin(request);
    const rows = request.data?.rows;
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 500) throw new HttpsError("invalid-argument", "La importación debe contener entre 1 y 500 filas.");
    const invitations = rows.map((row) => newInvitation(row, adminUid));
    const batch = db.batch();
    invitations.forEach((invitation) => batch.create(db.doc(`invitations/${invitation.id}`), invitation.record));
    await batch.commit();
    return {
      created: invitations.map((invitation) => ({
        ...validateInvitationInput(invitation.record),
        shareUrl: buildShareUrl(PUBLIC_SITE_URL.value(), invitation.token, invitation.record.defaultLanguage),
      })),
    };
  } catch (error) {
    throw asHttpsError(error);
  }
});

async function sendAndRecord(invitationRef, invitation, response) {
  const delivery = await deliverRsvpEmails({
    resendApiKey: RESEND_API_KEY.value(),
    from: EMAIL_FROM.value(),
    coupleEmails: COUPLE_EMAILS.value(),
    invitation,
    response,
  });
  await invitationRef.update({ emailStatus: { ...delivery, lastAttemptAt: FieldValue.serverTimestamp() }, updatedAt: FieldValue.serverTimestamp() });
  return delivery;
}

export const submitRsvp = onCall({ region: REGION, cors: true, secrets: [RESEND_API_KEY] }, async (request) => {
  try {
    const id = tokenHash(request.data?.token);
    const submissionId = cleanText(request.data?.submissionId, 80, true);
    if (!/^[A-Za-z0-9-]{10,80}$/.test(submissionId)) throw new HttpsError("invalid-argument", "Identificador de envío no válido.");
    const invitationRef = db.doc(`invitations/${id}`);
    const submissionRef = db.doc(`rsvpSubmissions/${submissionId}`);

    const transactionResult = await db.runTransaction(async (transaction) => {
      const [invitationSnapshot, submissionSnapshot] = await Promise.all([transaction.get(invitationRef), transaction.get(submissionRef)]);
      if (submissionSnapshot.exists) return { duplicate: true, invitation: invitationSnapshot.data(), response: submissionSnapshot.data().response };
      if (!invitationSnapshot.exists || invitationSnapshot.data()?.disabled) throw new HttpsError("not-found", "Invitación no encontrada.");
      const invitation = invitationSnapshot.data();
      const lastSubmission = invitation.lastSubmittedAt?.toDate?.();
      if (lastSubmission && Date.now() - lastSubmission.getTime() < 5000) throw new HttpsError("resource-exhausted", "Espera antes de enviar otra respuesta.");
      const deadline = invitation.rsvpDeadlineAt?.toDate?.() || new Date(RSVP_DEADLINE.value());
      if (Date.now() > deadline.getTime()) throw new HttpsError("deadline-exceeded", "El período de confirmación ha finalizado.");
      const response = { ...validateRsvpInput(request.data, invitation), confirmationCode: randomUUID().split("-")[0].toUpperCase() };
      const update = {
        ...response,
        respondedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
        emailStatus: { overall: "pending" },
        lastSubmittedAt: FieldValue.serverTimestamp(),
      };
      transaction.update(invitationRef, update);
      transaction.create(submissionRef, { invitationId: id, response, createdAt: FieldValue.serverTimestamp() });
      transaction.create(invitationRef.collection("history").doc(submissionId), { ...response, createdAt: FieldValue.serverTimestamp() });
      return { duplicate: false, invitation, response };
    });

    if (transactionResult.duplicate) {
      return { saved: true, duplicate: true, emailStatus: transactionResult.invitation?.emailStatus?.overall || "pending", confirmationCode: transactionResult.response?.confirmationCode };
    }

    const delivery = await sendAndRecord(invitationRef, transactionResult.invitation, transactionResult.response);
    return { saved: true, emailStatus: delivery.overall, confirmationCode: transactionResult.response.confirmationCode };
  } catch (error) {
    if (error instanceof HttpsError && error.code === "deadline-exceeded") throw new HttpsError("failed-precondition", "deadline-passed", { reason: "deadline-passed" });
    throw asHttpsError(error);
  }
});

export const retryRsvpEmail = onCall({ region: REGION, secrets: [RESEND_API_KEY] }, async (request) => {
  try {
    await requireAdmin(request);
    const invitationId = cleanText(request.data?.invitationId, 100, true);
    const invitationRef = db.doc(`invitations/${invitationId}`);
    const snapshot = await invitationRef.get();
    if (!snapshot.exists || !["attending", "declined"].includes(snapshot.data()?.status)) throw new HttpsError("failed-precondition", "Esta invitación aún no tiene respuesta.");
    const invitation = snapshot.data();
    const response = {
      status: invitation.status,
      attendingCount: invitation.attendingCount || 0,
      attendeeNames: invitation.attendeeNames || [],
      contactEmail: invitation.contactEmail,
      language: invitation.language || invitation.defaultLanguage || "es",
      message: invitation.message || "",
      confirmationCode: invitation.confirmationCode || invitationId.slice(0, 8).toUpperCase(),
    };
    const delivery = await sendAndRecord(invitationRef, invitation, response);
    return { emailStatus: delivery.overall };
  } catch (error) {
    throw asHttpsError(error);
  }
});
