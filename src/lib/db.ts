import "server-only";
import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA } from "./schema";

export const DATA_DIR = path.resolve(process.env.DATA_DIR || "./data");
export const UPLOAD_DIR = path.join(DATA_DIR, "uploads");

function open() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, "farho.db"));
  // WAL is fastest on a local disk. On network storage (e.g. Azure App Service's /home)
  // set SQLITE_JOURNAL_MODE=DELETE, since WAL needs shared memory that network shares lack.
  const journal = (process.env.SQLITE_JOURNAL_MODE || "WAL").toUpperCase();
  db.pragma(`journal_mode = ${/^(WAL|DELETE|TRUNCATE)$/.test(journal) ? journal : "WAL"}`);
  db.pragma("busy_timeout = 5000");
  db.pragma("foreign_keys = ON");
  db.exec(SCHEMA);
  return db;
}

// Reuse one connection across hot reloads in development.
const globalForDb = globalThis as unknown as { __farhoDb?: Database.Database };
export const db = globalForDb.__farhoDb ?? open();
if (process.env.NODE_ENV !== "production") globalForDb.__farhoDb = db;
