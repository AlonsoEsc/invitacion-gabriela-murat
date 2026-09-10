import assert from "node:assert/strict";
import test from "node:test";
import { parseInvitationCsv, toCsv } from "../src/admin/csv.js";

test("parses quoted guest data and normalizes capacity", () => {
  const rows = parseInvitationCsv('name,email,maxAttendees,language,group,notes\n"Familia, López",test@example.com,3,es,Familia,"Mesa 1"');
  assert.equal(rows.length, 1);
  assert.equal(rows[0].displayName, "Familia, López");
  assert.equal(rows[0].maxAttendees, 3);
});

test("rejects invalid capacity before import", () => {
  assert.throws(() => parseInvitationCsv("name,maxAttendees\nInvitado,0"), /entre 1 y 3/);
});

test("exports companion names without breaking CSV cells", () => {
  const csv = toCsv([{ displayName: "Familia López", maxAttendees: 3, attendeeNames: ["Ana", "José"], message: "Gracias" }]);
  assert.match(csv, /Ana \| José/);
  assert.match(csv, /Familia López/);
});
