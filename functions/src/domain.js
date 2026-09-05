import { createHash, randomBytes } from "node:crypto";

export const LANGUAGES = new Set(["es", "en", "ar"]);
export const RESPONSE_STATUSES = new Set(["attending", "declined"]);

export function cleanText(value, maxLength, required = false) {
  const result = typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
  if (required && !result) throw new Error("required");
  if (result.length > maxLength) throw new Error("too-long");
  return result;
}

export function normalizeEmail(value, required = false) {
  const email = cleanText(value, 254, required).toLowerCase();
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("invalid-email");
  return email;
}

export function invitationToken() {
  return randomBytes(24).toString("base64url");
}

export function tokenHash(token) {
  const normalized = cleanText(token, 100, true);
  if (!/^[A-Za-z0-9_-]{24,100}$/.test(normalized)) throw new Error("invalid-token");
  return createHash("sha256").update(normalized).digest("hex");
}

export function validateInvitationInput(input = {}) {
  const maxAttendees = Number(input.maxAttendees);
  if (!Number.isInteger(maxAttendees) || maxAttendees < 1 || maxAttendees > 20) throw new Error("invalid-capacity");
  const defaultLanguage = LANGUAGES.has(input.defaultLanguage) ? input.defaultLanguage : "es";
  return {
    displayName: cleanText(input.displayName, 100, true),
    contactEmail: normalizeEmail(input.contactEmail),
    maxAttendees,
    defaultLanguage,
    group: cleanText(input.group, 80),
    notes: cleanText(input.notes, 500),
  };
}

export function validateRsvpInput(input = {}, invitation) {
  if (!RESPONSE_STATUSES.has(input.status)) throw new Error("invalid-status");
  const attending = input.status === "attending";
  const attendingCount = attending ? Number(input.attendingCount) : 0;
  if (attending && (!Number.isInteger(attendingCount) || attendingCount < 1 || attendingCount > invitation.maxAttendees)) {
    throw new Error("invalid-attendance-count");
  }
  const attendeeNames = attending && Array.isArray(input.attendeeNames)
    ? input.attendeeNames.map((name) => cleanText(name, 100, true))
    : [];
  if (attending && attendeeNames.length !== attendingCount) throw new Error("invalid-attendee-names");

  const suppliedEmail = normalizeEmail(input.guestEmail);
  const contactEmail = suppliedEmail || invitation.contactEmail || "";
  if (!contactEmail) throw new Error("email-required");

  return {
    status: input.status,
    attendingCount,
    attendeeNames,
    contactEmail,
    language: LANGUAGES.has(input.language) ? input.language : invitation.defaultLanguage || "es",
    message: cleanText(input.message, 500),
  };
}

export function buildShareUrl(baseUrl, token, language) {
  const url = new URL(baseUrl);
  url.searchParams.set("inv", token);
  url.searchParams.set("lang", LANGUAGES.has(language) ? language : "es");
  return url.toString();
}
