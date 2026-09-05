import assert from "node:assert/strict";
import test from "node:test";
import { buildShareUrl, tokenHash, validateInvitationInput, validateRsvpInput } from "../src/domain.js";

test("creates a deterministic non-reversible document id from a token", () => {
  const token = "abcdefghijklmnopqrstuvwxyz123456";
  assert.equal(tokenHash(token), tokenHash(token));
  assert.equal(tokenHash(token).length, 64);
  assert.notEqual(tokenHash(token), token);
});

test("validates capacity and normalizes invitation data", () => {
  const result = validateInvitationInput({ displayName: "  Familia López  ", contactEmail: " TEST@Example.com ", maxAttendees: 4, defaultLanguage: "es" });
  assert.equal(result.displayName, "Familia López");
  assert.equal(result.contactEmail, "test@example.com");
  assert.equal(result.maxAttendees, 4);
});

test("rejects an RSVP above the assigned capacity", () => {
  assert.throws(() => validateRsvpInput({ status: "attending", attendingCount: 3, attendeeNames: ["A", "B", "C"] }, { maxAttendees: 2, contactEmail: "a@example.com" }), /invalid-attendance-count/);
});

test("requires every attendee name", () => {
  assert.throws(() => validateRsvpInput({ status: "attending", attendingCount: 2, attendeeNames: ["Ana"], guestEmail: "ana@example.com" }, { maxAttendees: 2 }), /invalid-attendee-names/);
});

test("builds a personalized language-aware URL", () => {
  const url = new URL(buildShareUrl("https://example.com/invitacion/", "abcdefghijklmnopqrstuvwxyz123456", "ar"));
  assert.equal(url.searchParams.get("inv"), "abcdefghijklmnopqrstuvwxyz123456");
  assert.equal(url.searchParams.get("lang"), "ar");
});
