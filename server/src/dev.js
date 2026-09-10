process.env.NODE_ENV ||= "development";
process.env.JWT_SECRET ||= "local-development-secret-change-in-production-2026";
process.env.ADMIN_EMAIL ||= "admin@local.test";
process.env.ADMIN_PASSWORD ||= "admin-demo-2026";
process.env.PUBLIC_SITE_URL ||= "http://127.0.0.1:5174/";
process.env.RSVP_DEADLINE ||= "2026-10-27T05:59:59.000Z";

const { createApp } = await import("./app.js");
const { closeDatabase, connectMemoryDatabase } = await import("./database.js");
connectMemoryDatabase();

const port = Number(process.env.PORT || 4001);
const server = createApp().listen(port, "127.0.0.1", () => {
  console.log(`API local listening on http://127.0.0.1:${port}`);
  console.log(`Admin local: ${process.env.ADMIN_EMAIL} / ${process.env.ADMIN_PASSWORD}`);
  console.log("Base temporal en memoria: los datos se eliminan al detener este proceso.");
});

let closing = false;
async function shutdown(signal) {
  if (closing) return;
  closing = true;
  console.log(`${signal}: closing local stack`);
  server.close();
  await closeDatabase();
  process.exit(0);
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
