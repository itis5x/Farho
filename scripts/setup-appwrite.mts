/**
 * Creates (or completes) Farho's Appwrite database, tables, indexes and image bucket.
 * Safe to run repeatedly: anything that already exists is skipped.
 *
 *   APPWRITE_PROJECT_ID=... APPWRITE_API_KEY=... npm run setup:appwrite
 */
import { AppwriteException, Client, Permission, Role, Storage, TablesDB } from "node-appwrite";
import { BUCKET_ID, DATABASE_ID, SCHEMA, type ColumnDef } from "../src/lib/appwrite-schema.ts";

const endpoint = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
if (!projectId || !apiKey) {
  console.error("Set APPWRITE_PROJECT_ID and APPWRITE_API_KEY.");
  process.exit(1);
}

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
const db = new TablesDB(client);
const storage = new Storage(client);

async function ensure(label: string, fn: () => Promise<unknown>) {
  try {
    await fn();
    console.log(`  + ${label}`);
  } catch (e) {
    if (e instanceof AppwriteException && e.code === 409) return;
    throw new Error(`${label}: ${(e as Error).message}`);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function createColumn(tableId: string, c: ColumnDef) {
  const base = { databaseId: DATABASE_ID, tableId, key: c.key, required: !!c.required };
  const dflt = <T,>(v: T | undefined) => (c.required ? undefined : v);
  switch (c.type) {
    case "varchar":
      return db.createVarcharColumn({ ...base, size: c.size, xdefault: dflt(c.default) });
    case "text":
      return db.createTextColumn(base);
    case "integer":
      return db.createIntegerColumn({ ...base, xdefault: dflt(c.default) });
    case "float":
      return db.createFloatColumn({ ...base, xdefault: dflt(c.default) });
    case "boolean":
      return db.createBooleanColumn({ ...base, xdefault: dflt(c.default) });
    case "datetime":
      return db.createDatetimeColumn(base);
    case "enum":
      return db.createEnumColumn({ ...base, elements: c.elements, xdefault: dflt(c.default) });
  }
}

async function waitForColumns(tableId: string) {
  for (let i = 0; i < 120; i++) {
    const { columns } = await db.listColumns({ databaseId: DATABASE_ID, tableId });
    const states = (columns as { key: string; status: string; error?: string }[]).map((c) => c.status);
    const failed = (columns as { key: string; status: string; error?: string }[]).find((c) => c.status === "failed");
    if (failed) throw new Error(`Column ${tableId}.${failed.key} failed: ${failed.error}`);
    if (states.every((s) => s === "available")) return;
    await sleep(1000);
  }
  throw new Error(`Timed out waiting for columns on ${tableId}`);
}

console.log(`Setting up Appwrite project ${projectId}`);
await ensure(`database ${DATABASE_ID}`, () => db.create({ databaseId: DATABASE_ID, name: "Farho" }));

for (const table of SCHEMA) {
  // No table permissions: only the server (API key) can read or write.
  await ensure(`table ${table.id}`, () => db.createTable({ databaseId: DATABASE_ID, tableId: table.id, name: table.name }));
  for (const col of table.columns) await ensure(`${table.id}.${col.key}`, () => createColumn(table.id, col));
  await waitForColumns(table.id);
  for (const idx of table.indexes) {
    await ensure(`${table.id} index ${idx.key}`, () =>
      db.createIndex({
        databaseId: DATABASE_ID,
        tableId: table.id,
        key: idx.key,
        type: idx.type as never,
        columns: idx.columns,
        orders: idx.orders as never,
      }),
    );
  }
}

await ensure(`bucket ${BUCKET_ID}`, () =>
  storage.createBucket({
    bucketId: BUCKET_ID,
    name: "Store images",
    permissions: [Permission.read(Role.any())],
    fileSecurity: false,
    maximumFileSize: 5 * 1024 * 1024,
    allowedFileExtensions: ["png", "jpg", "jpeg", "webp", "gif"],
  }),
);

console.log("Appwrite is ready.");
