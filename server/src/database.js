import mysql from "mysql2/promise";

let adapter;
let connected = false;

function parseJson(value, fallback) {
  if (value == null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try { return JSON.parse(value); } catch { return fallback; }
}

function asDate(value) {
  return value ? new Date(value) : null;
}

function mapRow(row) {
  if (!row) return null;
  return {
    id: String(row.id),
    displayName: row.display_name,
    contactEmail: row.contact_email || "",
    maxAttendees: Number(row.max_attendees),
    defaultLanguage: row.default_language,
    group: row.group_name || "",
    notes: row.notes || "",
    publicResponseId: row.public_response_id || "",
    token: row.token,
    tokenHash: row.token_hash,
    disabled: Boolean(row.disabled),
    status: row.status,
    attendingCount: Number(row.attending_count || 0),
    attendeeNames: parseJson(row.attendee_names, []),
    message: row.message || "",
    language: row.language || row.default_language,
    confirmationCode: row.confirmation_code || "",
    emailStatus: parseJson(row.email_status, { overall: "not-sent" }),
    respondedAt: asDate(row.responded_at),
    lastSubmittedAt: asDate(row.last_submitted_at),
    rsvpDeadlineAt: asDate(row.rsvp_deadline_at),
    createdAt: asDate(row.created_at),
    updatedAt: asDate(row.updated_at),
  };
}

function invitationValues(data) {
  return [
    data.displayName, data.contactEmail || "", data.maxAttendees, data.defaultLanguage || "es",
    data.group || "", data.notes || "", data.publicResponseId || null, data.token,
    data.tokenHash, data.disabled ? 1 : 0, data.status || "pending", data.attendingCount || 0,
    JSON.stringify(data.attendeeNames || []), data.message || "", data.language || data.defaultLanguage || "es",
    data.confirmationCode || "", JSON.stringify(data.emailStatus || { overall: "not-sent" }),
    data.respondedAt || null, data.lastSubmittedAt || null, data.rsvpDeadlineAt,
  ];
}

const SELECT_COLUMNS = `id, display_name, contact_email, max_attendees, default_language, group_name, notes,
  public_response_id, token, token_hash, disabled, status, attending_count, attendee_names, message,
  language, confirmation_code, email_status, responded_at, last_submitted_at, rsvp_deadline_at,
  created_at, updated_at`;

class MySqlAdapter {
  constructor(pool) { this.pool = pool; }

  async findByTokenHash(hash) {
    const [rows] = await this.pool.execute(`SELECT ${SELECT_COLUMNS} FROM invitations WHERE token_hash = ? AND disabled = 0 LIMIT 1`, [hash]);
    return mapRow(rows[0]);
  }

  async findByPublicResponseId(responseId) {
    const [rows] = await this.pool.execute(`SELECT ${SELECT_COLUMNS} FROM invitations WHERE public_response_id = ? LIMIT 1`, [responseId]);
    return mapRow(rows[0]);
  }

  async findById(id) {
    const [rows] = await this.pool.execute(`SELECT ${SELECT_COLUMNS} FROM invitations WHERE id = ? LIMIT 1`, [id]);
    return mapRow(rows[0]);
  }

  async listInvitations() {
    const [rows] = await this.pool.query(`SELECT ${SELECT_COLUMNS} FROM invitations ORDER BY created_at DESC`);
    return rows.map(mapRow);
  }

  async createInvitation(data, connection = this.pool) {
    const sql = `INSERT INTO invitations
      (display_name, contact_email, max_attendees, default_language, group_name, notes, public_response_id,
       token, token_hash, disabled, status, attending_count, attendee_names, message, language,
       confirmation_code, email_status, responded_at, last_submitted_at, rsvp_deadline_at)
      VALUES (${Array(20).fill("?").join(", ")})`;
    const [result] = await connection.execute(sql, invitationValues(data));
    return this.findById(result.insertId);
  }

  async updateInvitation(id, data, options = {}) {
    const fields = [];
    const values = [];
    const mapping = {
      displayName: "display_name", contactEmail: "contact_email", maxAttendees: "max_attendees",
      defaultLanguage: "default_language", group: "group_name", notes: "notes", publicResponseId: "public_response_id",
      disabled: "disabled", status: "status", attendingCount: "attending_count", attendeeNames: "attendee_names",
      message: "message", language: "language", confirmationCode: "confirmation_code", emailStatus: "email_status",
      respondedAt: "responded_at", lastSubmittedAt: "last_submitted_at", rsvpDeadlineAt: "rsvp_deadline_at",
    };
    for (const [key, column] of Object.entries(mapping)) {
      if (!(key in data)) continue;
      let value = data[key];
      if (["attendeeNames", "emailStatus"].includes(key)) value = JSON.stringify(value);
      if (key === "disabled") value = value ? 1 : 0;
      fields.push(`${column} = ?`);
      values.push(value);
    }
    if (!fields.length) return this.findById(id);
    let where = "id = ?";
    values.push(id);
    if (options.lastSubmittedBefore) {
      where += " AND (last_submitted_at IS NULL OR last_submitted_at < ?)";
      values.push(options.lastSubmittedBefore);
    }
    const [result] = await this.pool.execute(`UPDATE invitations SET ${fields.join(", ")} WHERE ${where}`, values);
    return result.affectedRows ? this.findById(id) : null;
  }

  async findSubmission(submissionId) {
    const [rows] = await this.pool.execute("SELECT submission_id, invitation_id, response FROM submissions WHERE submission_id = ? LIMIT 1", [submissionId]);
    const row = rows[0];
    return row ? { submissionId: row.submission_id, invitationId: String(row.invitation_id), response: parseJson(row.response, {}) } : null;
  }

  async createSubmission(submissionId, invitationId, response) {
    await this.pool.execute("INSERT INTO submissions (submission_id, invitation_id, response) VALUES (?, ?, ?)", [submissionId, invitationId, JSON.stringify(response)]);
  }

  async deleteSubmission(submissionId) {
    await this.pool.execute("DELETE FROM submissions WHERE submission_id = ?", [submissionId]);
  }

  async close() { await this.pool.end(); }
}

class MemoryAdapter {
  constructor() { this.invitations = new Map(); this.submissions = new Map(); this.nextId = 1; }
  clone(value) { return value ? structuredClone(value) : null; }
  async findByTokenHash(hash) { return this.clone([...this.invitations.values()].find((item) => item.tokenHash === hash && !item.disabled)); }
  async findByPublicResponseId(id) { return this.clone([...this.invitations.values()].find((item) => item.publicResponseId === id)); }
  async findById(id) { return this.clone(this.invitations.get(String(id))); }
  async listInvitations() { return [...this.invitations.values()].sort((a, b) => b.createdAt - a.createdAt).map((item) => this.clone(item)); }
  async createInvitation(data) {
    const id = String(this.nextId++);
    const now = new Date();
    const record = { disabled: false, status: "pending", attendingCount: 0, attendeeNames: [], message: "", confirmationCode: "", emailStatus: { overall: "not-sent" }, respondedAt: null, lastSubmittedAt: null, ...this.clone(data), id, createdAt: now, updatedAt: now };
    this.invitations.set(id, record);
    return this.clone(record);
  }
  async updateInvitation(id, data, options = {}) {
    const current = this.invitations.get(String(id));
    if (!current) return null;
    if (options.lastSubmittedBefore && current.lastSubmittedAt && current.lastSubmittedAt >= options.lastSubmittedBefore) return null;
    Object.assign(current, this.clone(data), { updatedAt: new Date() });
    return this.clone(current);
  }
  async findSubmission(id) { return this.clone(this.submissions.get(id)); }
  async createSubmission(id, invitationId, response) {
    if (this.submissions.has(id)) { const error = new Error("duplicate-submission"); error.code = "ER_DUP_ENTRY"; throw error; }
    this.submissions.set(id, { submissionId: id, invitationId: String(invitationId), response: this.clone(response) });
  }
  async deleteSubmission(id) { this.submissions.delete(id); }
  async close() {}
}

export async function connectDatabase(config = process.env) {
  const pool = mysql.createPool({
    host: config.MYSQL_HOST,
    port: Number(config.MYSQL_PORT || 3306),
    user: config.MYSQL_USER,
    password: config.MYSQL_PASSWORD,
    database: config.MYSQL_DATABASE,
    waitForConnections: true,
    connectionLimit: Number(config.MYSQL_CONNECTION_LIMIT || 5),
    timezone: "Z",
    charset: "utf8mb4",
  });
  await pool.query("SELECT 1");
  await pool.query(`CREATE TABLE IF NOT EXISTS invitations (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    display_name VARCHAR(100) NOT NULL, contact_email VARCHAR(254) NOT NULL DEFAULT '',
    max_attendees TINYINT UNSIGNED NOT NULL DEFAULT 3, default_language VARCHAR(2) NOT NULL DEFAULT 'es',
    group_name VARCHAR(80) NOT NULL DEFAULT '', notes VARCHAR(500) NOT NULL DEFAULT '',
    public_response_id VARCHAR(80) NULL UNIQUE, token VARCHAR(100) NOT NULL,
    token_hash CHAR(64) NOT NULL UNIQUE, disabled TINYINT(1) NOT NULL DEFAULT 0,
    status VARCHAR(16) NOT NULL DEFAULT 'pending', attending_count TINYINT UNSIGNED NOT NULL DEFAULT 0,
    attendee_names TEXT NOT NULL, message VARCHAR(500) NOT NULL DEFAULT '', language VARCHAR(2) NOT NULL DEFAULT 'es',
    confirmation_code VARCHAR(16) NOT NULL DEFAULT '', email_status TEXT NOT NULL,
    responded_at DATETIME(3) NULL, last_submitted_at DATETIME(3) NULL, rsvp_deadline_at DATETIME(3) NOT NULL,
    created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    updated_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
    INDEX idx_invitations_created (created_at), INDEX idx_invitations_status (status)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await pool.query(`CREATE TABLE IF NOT EXISTS submissions (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
    submission_id VARCHAR(80) NOT NULL UNIQUE, invitation_id BIGINT UNSIGNED NOT NULL,
    response TEXT NOT NULL, created_at DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    CONSTRAINT fk_submissions_invitation FOREIGN KEY (invitation_id) REFERENCES invitations(id) ON DELETE CASCADE
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  adapter = new MySqlAdapter(pool);
  connected = true;
  return adapter;
}

export function connectMemoryDatabase() {
  adapter = new MemoryAdapter();
  connected = true;
  return adapter;
}

export function database() {
  if (!adapter) throw new Error("database-not-connected");
  return adapter;
}

export function isDatabaseConnected() { return connected; }

export async function closeDatabase() {
  if (adapter) await adapter.close();
  adapter = undefined;
  connected = false;
}
