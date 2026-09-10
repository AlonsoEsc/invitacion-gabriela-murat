import bcrypt from "bcryptjs";
import compression from "compression";
import cookieParser from "cookie-parser";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import { randomUUID, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { buildShareUrl, cleanText, invitationToken, normalizeEmail, tokenHash, validateInvitationInput, validatePublicRsvpInput, validateRsvpInput } from "./domain.js";
import { connectDatabase, database, isDatabaseConnected } from "./database.js";
import { deliverRsvpEmails } from "./email.js";
const COOKIE_NAME = "gm_admin";
const sseClients = new Set();

function env(name, fallback = "") {
  return process.env[name] || fallback;
}

function publicSiteUrl() {
  return env("PUBLIC_SITE_URL", "http://127.0.0.1:5174/");
}

function deadline() {
  return new Date(env("RSVP_DEADLINE", "2026-10-27T05:59:59.000Z"));
}

function apiError(error) {
  const map = {
    required: [400, "required"],
    "too-long": [400, "too-long"],
    "invalid-email": [400, "invalid-email"],
    "invalid-token": [404, "not-found"],
    "invalid-capacity": [400, "invalid-capacity"],
    "invalid-status": [400, "invalid-status"],
    "invalid-attendance-count": [400, "invalid-attendance-count"],
    "invalid-attendee-names": [400, "invalid-attendee-names"],
    "email-required": [400, "email-required"],
  };
  const [status, code] = map[error?.message] || [500, "internal"];
  return { status, code };
}

function route(handler) {
  return (request, response, next) => Promise.resolve(handler(request, response)).catch(next);
}

function publicInvitation(invitation) {
  return {
    displayName: invitation.displayName,
    maxAttendees: invitation.maxAttendees,
    defaultLanguage: invitation.defaultLanguage,
    hasContactEmail: Boolean(invitation.contactEmail),
    response: invitation.status !== "pending" ? {
      status: invitation.status,
      attendingCount: invitation.attendingCount || 0,
      attendeeNames: invitation.attendeeNames || [],
      message: invitation.message || "",
      respondedAt: invitation.respondedAt?.toISOString?.() || null,
    } : null,
  };
}

function adminInvitation(invitation) {
  return {
    ...invitation,
    id: String(invitation.id),
    shareUrl: buildShareUrl(publicSiteUrl(), invitation.token, invitation.defaultLanguage),
  };
}

function notifyAdmins() {
  for (const client of sseClients) client.write("event: invitations\ndata: {\"changed\":true}\n\n");
}

function signAdmin(response, email) {
  const token = jwt.sign({ email, role: "admin" }, env("JWT_SECRET"), { expiresIn: "12h", issuer: "gabriela-murad-api" });
  response.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: env("COOKIE_SECURE", "false") === "true",
    maxAge: 12 * 60 * 60 * 1000,
    path: "/",
  });
}

function requireAdmin(request, response, next) {
  try {
    const payload = jwt.verify(request.cookies?.[COOKIE_NAME], env("JWT_SECRET"), { issuer: "gabriela-murad-api" });
    if (payload.role !== "admin" || payload.email !== normalizeEmail(env("ADMIN_EMAIL"), true)) throw new Error("unauthorized");
    request.admin = payload;
    next();
  } catch {
    response.status(401).json({ error: "unauthenticated" });
  }
}

async function passwordMatches(password) {
  const hash = env("ADMIN_PASSWORD_HASH");
  if (hash) return bcrypt.compare(password, hash);
  const configured = Buffer.from(env("ADMIN_PASSWORD"));
  const supplied = Buffer.from(password || "");
  return configured.length > 0 && configured.length === supplied.length && timingSafeEqual(configured, supplied);
}

async function sendAndRecord(invitation, responseData) {
  const delivery = await deliverRsvpEmails({
    apiKey: env("RESEND_API_KEY"),
    from: env("EMAIL_FROM", "Invitaciones Gabriela & Murad <invitaciones@gabrielaymurad.site>"),
    replyTo: env("EMAIL_REPLY_TO"),
    coupleEmails: env("COUPLE_EMAILS"),
    invitation,
    response: responseData,
  });
  await database().updateInvitation(invitation.id, { emailStatus: delivery });
  return delivery;
}

export function createApp() {
  const app = express();
  app.set("trust proxy", 1);
  app.use(helmet({ contentSecurityPolicy: false }));
  app.use(compression());
  app.use(express.json({ limit: "2mb" }));
  app.use(cookieParser());

  const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false });
  const rsvpLimiter = rateLimit({ windowMs: 5 * 60 * 1000, limit: 40, standardHeaders: true, legacyHeaders: false });

  app.get("/api/health", (request, response) => response.json({ ok: true, database: isDatabaseConnected() ? "connected" : "disconnected" }));

  app.post("/api/auth/login", authLimiter, route(async (request, response) => {
    const email = normalizeEmail(request.body?.email, true);
    if (email !== normalizeEmail(env("ADMIN_EMAIL"), true) || !(await passwordMatches(request.body?.password))) {
      return response.status(401).json({ error: "invalid-credentials" });
    }
    signAdmin(response, email);
    return response.json({ user: { email } });
  }));

  app.post("/api/auth/logout", (request, response) => {
    response.clearCookie(COOKIE_NAME, { path: "/" });
    response.status(204).end();
  });

  app.get("/api/auth/me", requireAdmin, (request, response) => response.json({ user: { email: request.admin.email } }));

  app.get("/api/invitations/public/:token", route(async (request, response) => {
    const invitation = await database().findByTokenHash(tokenHash(request.params.token));
    if (!invitation) return response.status(404).json({ error: "not-found" });
    return response.json(publicInvitation(invitation));
  }));

  app.post("/api/rsvp", rsvpLimiter, route(async (request, response) => {
    const hashedToken = tokenHash(request.body?.token);
    const submissionId = cleanText(request.body?.submissionId, 80, true);
    if (!/^[A-Za-z0-9-]{10,80}$/.test(submissionId)) return response.status(400).json({ error: "invalid-submission" });

    const duplicate = await database().findSubmission(submissionId);
    if (duplicate) {
      const invitation = await database().findById(duplicate.invitationId);
      return response.json({ saved: true, duplicate: true, emailStatus: invitation?.emailStatus?.overall || "pending", confirmationCode: duplicate.response?.confirmationCode });
    }

    const invitation = await database().findByTokenHash(hashedToken);
    if (!invitation) return response.status(404).json({ error: "not-found" });
    if (Date.now() > invitation.rsvpDeadlineAt.getTime()) return response.status(412).json({ error: "deadline-passed" });
    if (invitation.lastSubmittedAt && Date.now() - invitation.lastSubmittedAt.getTime() < 5000) return response.status(429).json({ error: "resource-exhausted" });

    const responseData = {
      ...validateRsvpInput(request.body, invitation),
      confirmationCode: randomUUID().split("-")[0].toUpperCase(),
    };

    await database().createSubmission(submissionId, invitation.id, responseData);
    const updated = await database().updateInvitation(invitation.id,
      { ...responseData, respondedAt: new Date(), lastSubmittedAt: new Date(), emailStatus: { overall: "pending" } },
      { lastSubmittedBefore: new Date(Date.now() - 5000) },
    );
    if (!updated) {
      await database().deleteSubmission(submissionId);
      return response.status(429).json({ error: "resource-exhausted" });
    }

    const delivery = await sendAndRecord(updated, responseData);
    notifyAdmins();
    return response.json({ saved: true, emailStatus: delivery.overall, confirmationCode: responseData.confirmationCode });
  }));

  app.post("/api/rsvp/public", rsvpLimiter, route(async (request, response) => {
    if (Date.now() > deadline().getTime()) return response.status(412).json({ error: "deadline-passed" });

    const suppliedId = cleanText(request.body?.responseId, 80);
    if (suppliedId && !/^[A-Za-z0-9-]{10,80}$/.test(suppliedId)) return response.status(400).json({ error: "invalid-submission" });

    const responseId = suppliedId || randomUUID();
    const displayName = cleanText(request.body?.displayName, 100, true);
    let invitation = suppliedId ? await database().findByPublicResponseId(suppliedId) : null;
    if (invitation?.lastSubmittedAt && Date.now() - invitation.lastSubmittedAt.getTime() < 5000) {
      return response.status(429).json({ error: "resource-exhausted" });
    }

    const responseData = {
      ...validatePublicRsvpInput(request.body, displayName),
      confirmationCode: invitation?.confirmationCode || randomUUID().split("-")[0].toUpperCase(),
    };

    if (!invitation) {
      const token = invitationToken();
      invitation = await database().createInvitation({
        displayName,
        contactEmail: responseData.contactEmail,
        maxAttendees: 3,
        defaultLanguage: responseData.language,
        group: "RSVP público",
        notes: "Confirmación desde el formulario general",
        publicResponseId: responseId,
        token,
        tokenHash: tokenHash(token),
        rsvpDeadlineAt: deadline(),
        ...responseData,
        respondedAt: new Date(),
        lastSubmittedAt: new Date(),
        emailStatus: { overall: "pending" },
      });
    } else {
      invitation = await database().updateInvitation(invitation.id, {
        displayName,
        contactEmail: responseData.contactEmail,
        ...responseData,
        respondedAt: new Date(),
        lastSubmittedAt: new Date(),
        emailStatus: { overall: "pending" },
      });
    }

    const delivery = await sendAndRecord(invitation, responseData);
    notifyAdmins();
    return response.json({ saved: true, responseId, emailStatus: delivery.overall, confirmationCode: responseData.confirmationCode });
  }));

  app.use("/api/admin", requireAdmin);

  app.get("/api/admin/events", (request, response) => {
    response.setHeader("Content-Type", "text/event-stream");
    response.setHeader("Cache-Control", "no-cache");
    response.setHeader("Connection", "keep-alive");
    response.flushHeaders();
    response.write("event: ready\ndata: {}\n\n");
    sseClients.add(response);
    request.on("close", () => sseClients.delete(response));
  });

  app.get("/api/admin/invitations", route(async (request, response) => {
    const invitations = await database().listInvitations();
    response.json({ invitations: invitations.map(adminInvitation) });
  }));

  app.post("/api/admin/invitations", route(async (request, response) => {
    const data = validateInvitationInput(request.body);
    const token = invitationToken();
    const invitation = await database().createInvitation({ ...data, token, tokenHash: tokenHash(token), rsvpDeadlineAt: deadline() });
    notifyAdmins();
    response.status(201).json(adminInvitation(invitation));
  }));

  app.patch("/api/admin/invitations/:id", route(async (request, response) => {
    const data = validateInvitationInput(request.body);
    const current = await database().findById(request.params.id);
    if (!current) return response.status(404).json({ error: "not-found" });
    if ((current.attendingCount || 0) > data.maxAttendees) return response.status(412).json({ error: "capacity-below-confirmed" });
    await database().updateInvitation(current.id, data);
    notifyAdmins();
    return response.json({ saved: true });
  }));

  app.post("/api/admin/invitations/import", route(async (request, response) => {
    const rows = request.body?.rows;
    if (!Array.isArray(rows) || rows.length < 1 || rows.length > 500) return response.status(400).json({ error: "invalid-import-size" });
    const records = rows.map((row) => {
      const data = validateInvitationInput(row);
      const token = invitationToken();
      return { ...data, token, tokenHash: tokenHash(token), rsvpDeadlineAt: deadline() };
    });
    const created = [];
    for (const record of records) created.push(await database().createInvitation(record));
    notifyAdmins();
    return response.status(201).json({ created: created.map(adminInvitation) });
  }));

  app.post("/api/admin/invitations/:id/retry-email", route(async (request, response) => {
    const invitation = await database().findById(request.params.id);
    if (!invitation || !["attending", "declined"].includes(invitation.status)) return response.status(412).json({ error: "no-response" });
    const responseData = {
      status: invitation.status,
      attendingCount: invitation.attendingCount || 0,
      attendeeNames: invitation.attendeeNames || [],
      contactEmail: invitation.contactEmail,
      language: invitation.language || invitation.defaultLanguage || "es",
      message: invitation.message || "",
      confirmationCode: invitation.confirmationCode || String(invitation.id).slice(0, 8).toUpperCase(),
    };
    const delivery = await sendAndRecord(invitation, responseData);
    notifyAdmins();
    return response.json({ emailStatus: delivery.overall });
  }));

  const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
  const clientDirectory = resolve(projectRoot, "dist/client");
  if (existsSync(clientDirectory)) {
    app.use(express.static(clientDirectory, { maxAge: env("NODE_ENV") === "production" ? "1d" : 0 }));
    app.get(/^(?!\/api\/).*/, (request, response) => response.sendFile(resolve(clientDirectory, "index.html")));
  }

  app.use((error, request, response, next) => {
    if (response.headersSent) return next(error);
    const { status, code } = apiError(error);
    if (status === 500) console.error(error);
    return response.status(status).json({ error: code });
  });

  return app;
}

export { connectDatabase };
