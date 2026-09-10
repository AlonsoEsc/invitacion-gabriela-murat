import "dotenv/config";
import { createApp, connectDatabase } from "./app.js";
import { closeDatabase } from "./database.js";

const required = ["MYSQL_HOST", "MYSQL_DATABASE", "MYSQL_USER", "JWT_SECRET", "ADMIN_EMAIL"];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing required environment variable: ${name}`);
}
if (!process.env.DATABASE_CREDENTIAL && !process.env.DB_PASSWORD && !process.env.MYSQL_PASSWORD) {
  throw new Error("Missing required environment variable: DATABASE_CREDENTIAL");
}
if (!process.env.ADMIN_PASSWORD && !process.env.ADMIN_PASSWORD_HASH) throw new Error("Set ADMIN_PASSWORD_HASH or ADMIN_PASSWORD.");
if (process.env.JWT_SECRET.length < 32) throw new Error("JWT_SECRET must contain at least 32 characters.");

const port = Number(process.env.PORT || 4001);
let server;

async function start() {
  await connectDatabase(process.env);
  server = createApp().listen(port, () => console.log(`Gabriela & Murad API listening on http://127.0.0.1:${port}`));
}

async function shutdown(signal) {
  console.log(`${signal}: closing server`);
  if (!server) {
    await closeDatabase();
    process.exit(0);
  }
  server.close(async () => {
    await closeDatabase();
    process.exit(0);
  });
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));

start().catch((error) => {
  console.error("Unable to start application", error);
  process.exitCode = 1;
});
