import "server-only";
import { AppwriteException, Client, ID, Query, Storage, TablesDB } from "node-appwrite";
import { DATABASE_ID } from "./appwrite-schema";

const endpoint = process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
const projectId = process.env.APPWRITE_PROJECT_ID || "";
const apiKey = process.env.APPWRITE_API_KEY || "";

export const appwriteConfig = { endpoint, projectId };

const client = new Client().setEndpoint(endpoint).setProject(projectId).setKey(apiKey);
export const tablesDB = new TablesDB(client);
export const storage = new Storage(client);
export { ID, Query };

/** Row as returned to the app: `$id` → `id`, `$createdAt` → `created_at` (unless the table has its own). */
type Mapped = { id: string; created_at: string; updated_at: string };

export function mapRow<T>(row: Record<string, unknown>): T {
  const { $id, $createdAt, $updatedAt, $permissions, $tableId, $databaseId, $sequence, ...rest } = row;
  void $permissions;
  void $tableId;
  void $databaseId;
  void $sequence;
  return { id: $id, ...rest, created_at: rest.created_at ?? $createdAt, updated_at: $updatedAt } as T & Mapped;
}

export function isNotFound(e: unknown) {
  return e instanceof AppwriteException && e.code === 404;
}

export function isConflict(e: unknown) {
  return e instanceof AppwriteException && e.code === 409;
}

export async function getRow<T>(tableId: string, rowId: string): Promise<T | null> {
  if (!rowId) return null;
  try {
    return mapRow<T>(await tablesDB.getRow({ databaseId: DATABASE_ID, tableId, rowId }));
  } catch (e) {
    if (isNotFound(e)) return null;
    throw e;
  }
}

export async function listRows<T>(tableId: string, queries: string[] = []): Promise<{ rows: T[]; total: number }> {
  const res = await tablesDB.listRows({ databaseId: DATABASE_ID, tableId, queries });
  return { rows: res.rows.map((r) => mapRow<T>(r)), total: res.total };
}

export async function firstRow<T>(tableId: string, queries: string[]): Promise<T | null> {
  const { rows } = await listRows<T>(tableId, [...queries, Query.limit(1)]);
  return rows[0] ?? null;
}

export async function countRows(tableId: string, queries: string[]): Promise<number> {
  const res = await tablesDB.listRows({ databaseId: DATABASE_ID, tableId, queries: [...queries, Query.limit(1), Query.select(["$id"])] });
  return res.total;
}

/** Fetches every matching row, page by page. Fine for per-store data volumes. */
export async function listAllRows<T>(tableId: string, queries: string[] = []): Promise<T[]> {
  const out: T[] = [];
  let cursor: string | undefined;
  for (;;) {
    const page = await tablesDB.listRows({
      databaseId: DATABASE_ID,
      tableId,
      queries: [...queries, Query.limit(500), ...(cursor ? [Query.cursorAfter(cursor)] : [])],
      total: false,
    });
    out.push(...page.rows.map((r) => mapRow<T>(r)));
    if (page.rows.length < 500) return out;
    cursor = page.rows[page.rows.length - 1].$id;
  }
}

export async function createRow<T>(tableId: string, data: Record<string, unknown>, rowId = ID.unique()): Promise<T> {
  return mapRow<T>(await tablesDB.createRow({ databaseId: DATABASE_ID, tableId, rowId, data }));
}

export async function updateRow<T>(tableId: string, rowId: string, data: Record<string, unknown>): Promise<T> {
  return mapRow<T>(await tablesDB.updateRow({ databaseId: DATABASE_ID, tableId, rowId, data }));
}

export async function deleteRow(tableId: string, rowId: string) {
  try {
    await tablesDB.deleteRow({ databaseId: DATABASE_ID, tableId, rowId });
  } catch (e) {
    if (!isNotFound(e)) throw e;
  }
}

export async function deleteRowsWhere(tableId: string, queries: string[]) {
  await tablesDB.deleteRows({ databaseId: DATABASE_ID, tableId, queries });
}

export async function updateRowsWhere(tableId: string, queries: string[], data: Record<string, unknown>) {
  await tablesDB.updateRows({ databaseId: DATABASE_ID, tableId, queries, data });
}

/** Atomically adds to a numeric column and returns the updated row. */
export async function incrementColumn<T>(tableId: string, rowId: string, column: string, value: number, max?: number) {
  return mapRow<T>(await tablesDB.incrementRowColumn({ databaseId: DATABASE_ID, tableId, rowId, column, value, max }));
}

/** Atomically subtracts from a numeric column; throws if the result would drop below `min`. */
export async function decrementColumn<T>(tableId: string, rowId: string, column: string, value: number, min?: number) {
  return mapRow<T>(await tablesDB.decrementRowColumn({ databaseId: DATABASE_ID, tableId, rowId, column, value, min }));
}
