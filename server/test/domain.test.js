import assert from "node:assert/strict";
import test from "node:test";
import { buildShareUrl, invitationToken, tokenHash, validateInvitationInput, validatePublicRsvpInput, validateRsvpInput } from "../src/domain.js";

test("creates a non-reversible invitation id", () => {
  const token = invitationToken();
  assert.equal(tokenHash(token), tokenHash(token));
  assert.equal(tokenHash(token).length, 64);
});

test("validates invitation capacity", () => {
  assert.equal(validateInvitationInput({ displayName: "Familia", maxAttendees: 3 }).maxAttendees, 3);
  assert.throws(() => validateInvitationInput({ displayName: "Familia", maxAttendees: 4 }), /invalid-capacity/);
  assert.throws(() => validateInvitationInput({ displayName: "Familia", maxAttendees: 0 }), /invalid-capacity/);
});

test("rejects RSVP above assigned capacity", () => {
  assert.throws(() => validateRsvpInput({ status: "attending", attendingCount: 3, attendeeNames: ["A", "B", "C"] }, { maxAttendees: 2, contactEmail: "a@example.com" }), /invalid-attendance-count/);
});

test("allows a public RSVP with a maximum of three attendees", () => {
  const result = validatePublicRsvpInput({ status: "attending", attendingCount: 3, language: "es" }, "Invitado");
  assert.equal(result.attendingCount, 3);
  assert.deepEqual(result.attendeeNames, ["Invitado"]);
  assert.throws(() => validatePublicRsvpInput({ status: "attending", attendingCount: 4 }, "Invitado"), /invalid-attendance-count/);
});

test("builds personalized URLs", () => {
  assert.match(buildShareUrl("https://example.com/", "abcdefghijklmnopqrstuvwxyz12", "en"), /lang=en/);
});
