import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { createApp } from "../src/app.js";
import { closeDatabase, connectMemoryDatabase, database } from "../src/database.js";
import { invitationToken, tokenHash } from "../src/domain.js";

process.env.JWT_SECRET = "integration-test-secret-that-is-long-enough";
process.env.ADMIN_EMAIL = "admin@test.local";
process.env.ADMIN_PASSWORD = "test-password";
process.env.RSVP_DEADLINE = "2026-10-27T05:59:59.000Z";

let server;
let baseUrl;

before(async () => {
  connectMemoryDatabase();
  server = createApp().listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve) => server.close(resolve));
  await closeDatabase();
});

test("saves a personalized RSVP and returns the same result for a duplicate submission", async () => {
  const token = invitationToken();
  await database().createInvitation({
    displayName: "Familia de prueba",
    contactEmail: "familia@example.com",
    maxAttendees: 3,
    defaultLanguage: "es",
    token,
    tokenHash: tokenHash(token),
    rsvpDeadlineAt: new Date("2026-10-27T05:59:59.000Z"),
  });

  const payload = {
    token,
    submissionId: "submission-test-12345",
    status: "attending",
    attendingCount: 2,
    attendeeNames: ["Ana", "Luis"],
    guestEmail: "familia@example.com",
    language: "es",
    message: "Nos vemos",
  };
  const first = await fetch(`${baseUrl}/api/rsvp`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  assert.equal(first.status, 200);
  const firstBody = await first.json();
  assert.equal(firstBody.saved, true);

  const second = await fetch(`${baseUrl}/api/rsvp`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
  assert.equal(second.status, 200);
  assert.equal((await second.json()).duplicate, true);

  const saved = await database().findByTokenHash(tokenHash(token));
  assert.equal(saved.status, "attending");
  assert.equal(saved.attendingCount, 2);
  assert.deepEqual(saved.attendeeNames, ["Ana", "Luis"]);
});

test("creates a general RSVP without a personalized invitation", async () => {
  const responseId = "public-response-12345";
  const result = await fetch(`${baseUrl}/api/rsvp/public`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ responseId, displayName: "Invitada general", status: "declined", attendingCount: 0, language: "es", message: "Gracias" }),
  });
  assert.equal(result.status, 200);
  const body = await result.json();
  assert.equal(body.saved, true);
  assert.equal(body.responseId, responseId);
  assert.equal((await database().findByPublicResponseId(responseId)).status, "declined");
});
