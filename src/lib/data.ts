import "server-only";
import {
  countRows,
  createRow,
  deleteRow,
  deleteRowsWhere,
  firstRow,
  getRow,
  listAllRows,
  listRows,
  Query,
  updateRow,
  updateRowsWhere,
} from "./appwrite";
import { TABLES } from "./appwrite-schema";
import { decrypt, encrypt } from "./crypto";
import type { Category, Coupon, Customer, LedgerEntry, Order, OrderEvent, OrderItem, Product, Store, User } from "./types";

/* --------------------------------- Users --------------------------------- */

export type UserWithHash = User & { password_hash: string };

export const getUserByEmail = (email: string) =>
  firstRow<UserWithHash>(TABLES.users, [Query.equal("email", email.toLowerCase())]);

export const createUser = (data: { name: string; email: string; password_hash: string }) =>
  createRow<User>(TABLES.users, { ...data, email: data.email.toLowerCase() });

export async function getUser(id: string): Promise<User | null> {
  const u = await getRow<UserWithHash>(TABLES.users, id);
  if (!u) return null;
  const { password_hash: _, ...user } = u;
  return user;
}

/* -------------------------------- Sessions ------------------------------- */

type Session = { id: string; token: string; user_id: string; expires_at: string };

export const createSessionRow = (token: string, userId: string, expires: Date) =>
  createRow<Session>(TABLES.sessions, { token, user_id: userId, expires_at: expires.toISOString() });

export const getSessionByToken = (token: string) => firstRow<Session>(TABLES.sessions, [Query.equal("token", token)]);

export async function deleteSessionByToken(token: string) {
  const s = await getSessionByToken(token);
  if (s) await deleteRow(TABLES.sessions, s.id);
}

/* --------------------------------- Stores -------------------------------- */

export const getStore = (id: string) => getRow<Store>(TABLES.stores, id);

export const getStoreBySlug = (slug: string) => firstRow<Store>(TABLES.stores, [Query.equal("slug", slug.toLowerCase())]);

export const listStoresByOwner = (ownerId: string) =>
  listAllRows<Store>(TABLES.stores, [Query.equal("owner_id", ownerId), Query.orderDesc("$createdAt")]);

export const createStoreRow = (data: Partial<Store> & { owner_id: string; name: string; slug: string }) =>
  createRow<Store>(TABLES.stores, data);

export const updateStoreRow = (id: string, data: Partial<Store>) => updateRow<Store>(TABLES.stores, id, data);

/** Deletes a store and everything that belongs to it. */
export async function deleteStoreCascade(storeId: string) {
  const byStore = [Query.equal("store_id", storeId)];
  await Promise.all([
    deleteRowsWhere(TABLES.storeSecrets, byStore),
    deleteRowsWhere(TABLES.messages, byStore),
    deleteRowsWhere(TABLES.conversations, byStore),
    deleteRowsWhere(TABLES.channels, byStore),
    deleteRowsWhere(TABLES.autoReplies, byStore),
    deleteRowsWhere(TABLES.ledger, byStore),
    deleteRowsWhere(TABLES.orderEvents, byStore),
    deleteRowsWhere(TABLES.orderItems, byStore),
    deleteRowsWhere(TABLES.coupons, byStore),
    deleteRowsWhere(TABLES.products, byStore),
    deleteRowsWhere(TABLES.categories, byStore),
  ]);
  await Promise.all([deleteRowsWhere(TABLES.orders, byStore), deleteRowsWhere(TABLES.customers, byStore)]);
  await deleteRow(TABLES.stores, storeId);
}

/* ------------------------------- Categories ------------------------------ */

export const listCategories = (storeId: string) =>
  listAllRows<Category>(TABLES.categories, [Query.equal("store_id", storeId), Query.orderAsc("name")]);

export const getCategory = async (storeId: string, id: string) => {
  const c = await getRow<Category>(TABLES.categories, id);
  return c && c.store_id === storeId ? c : null;
};

export const categorySlugTaken = async (storeId: string, slug: string, excludeId?: string) =>
  !!(await firstRow<Category>(TABLES.categories, [
    Query.equal("store_id", storeId),
    Query.equal("slug", slug),
    ...(excludeId ? [Query.notEqual("$id", excludeId)] : []),
  ]));

export const createCategoryRow = (storeId: string, name: string, slug: string) =>
  createRow<Category>(TABLES.categories, { store_id: storeId, name, slug });

export const updateCategoryRow = (id: string, data: Partial<Category>) => updateRow<Category>(TABLES.categories, id, data);

export async function deleteCategoryRow(id: string) {
  await updateRowsWhere(TABLES.products, [Query.equal("category_id", id)], { category_id: "" });
  await deleteRow(TABLES.categories, id);
}

/* -------------------------------- Products ------------------------------- */

export const listProducts = (storeId: string, opts: { activeOnly?: boolean } = {}) =>
  listAllRows<Product>(TABLES.products, [
    Query.equal("store_id", storeId),
    ...(opts.activeOnly ? [Query.equal("active", true)] : []),
    Query.orderDesc("$createdAt"),
  ]);

export const countProducts = (storeId: string) => countRows(TABLES.products, [Query.equal("store_id", storeId)]);

export const getProduct = async (storeId: string, id: string) => {
  const p = await getRow<Product>(TABLES.products, id);
  return p && p.store_id === storeId ? p : null;
};

export const getActiveProductBySlug = (storeId: string, slug: string) =>
  firstRow<Product>(TABLES.products, [Query.equal("store_id", storeId), Query.equal("slug", slug), Query.equal("active", true)]);

export const productSlugTaken = async (storeId: string, slug: string, excludeId?: string) =>
  !!(await firstRow<Product>(TABLES.products, [
    Query.equal("store_id", storeId),
    Query.equal("slug", slug),
    ...(excludeId ? [Query.notEqual("$id", excludeId)] : []),
  ]));

export const createProductRow = (data: Omit<Product, "id" | "created_at">) =>
  createRow<Product>(TABLES.products, data as Record<string, unknown>);

export const updateProductRow = (id: string, data: Partial<Product>) => updateRow<Product>(TABLES.products, id, data);

export const deleteProductRow = (id: string) => deleteRow(TABLES.products, id);

export const listLowStock = (storeId: string) =>
  listRows<Product>(TABLES.products, [
    Query.equal("store_id", storeId),
    Query.equal("active", true),
    Query.isNotNull("stock"),
    Query.lessThanEqual("stock", 5),
    Query.orderAsc("stock"),
    Query.limit(5),
  ]).then((r) => r.rows);

/** Units sold per product, excluding cancelled orders. */
export async function unitsSoldByProduct(storeId: string): Promise<Map<string, number>> {
  const [items, cancelled] = await Promise.all([
    listAllRows<OrderItem>(TABLES.orderItems, [Query.equal("store_id", storeId), Query.select(["$id", "order_id", "product_id", "quantity"])]),
    listAllRows<Order>(TABLES.orders, [Query.equal("store_id", storeId), Query.equal("status", "cancelled"), Query.select(["$id"])]),
  ]);
  const skip = new Set(cancelled.map((o) => o.id));
  const sold = new Map<string, number>();
  for (const it of items) {
    if (!it.product_id || skip.has(it.order_id)) continue;
    sold.set(it.product_id, (sold.get(it.product_id) ?? 0) + it.quantity);
  }
  return sold;
}

/* -------------------------------- Customers ------------------------------ */

export const listCustomers = (storeId: string) => listAllRows<Customer>(TABLES.customers, [Query.equal("store_id", storeId)]);

export const getCustomer = async (storeId: string, id: string) => {
  const c = await getRow<Customer>(TABLES.customers, id);
  return c && c.store_id === storeId ? c : null;
};

/** Creates the customer or refreshes their details; customers are unique per store by phone. */
export async function upsertCustomer(storeId: string, d: { name: string; phone: string; email: string; address: string; city: string }) {
  const existing = await firstRow<Customer>(TABLES.customers, [Query.equal("store_id", storeId), Query.equal("phone", d.phone)]);
  if (existing) {
    return updateRow<Customer>(TABLES.customers, existing.id, {
      name: d.name,
      address: d.address,
      city: d.city,
      ...(d.email ? { email: d.email } : {}),
    });
  }
  return createRow<Customer>(TABLES.customers, { store_id: storeId, ...d });
}

/* --------------------------------- Coupons ------------------------------- */

export const listCoupons = (storeId: string) =>
  listAllRows<Coupon>(TABLES.coupons, [Query.equal("store_id", storeId), Query.orderDesc("$createdAt")]);

export const getCoupon = async (storeId: string, id: string) => {
  const c = await getRow<Coupon>(TABLES.coupons, id);
  return c && c.store_id === storeId ? c : null;
};

export const getCouponByCode = (storeId: string, code: string) =>
  firstRow<Coupon>(TABLES.coupons, [Query.equal("store_id", storeId), Query.equal("code", code.toUpperCase())]);

export const createCouponRow = (data: Pick<Coupon, "store_id" | "code" | "kind" | "value" | "min_subtotal">) =>
  createRow<Coupon>(TABLES.coupons, data);

export const updateCouponRow = (id: string, data: Partial<Coupon>) => updateRow<Coupon>(TABLES.coupons, id, data);

export const deleteCouponRow = (id: string) => deleteRow(TABLES.coupons, id);

/* --------------------------------- Orders -------------------------------- */

export const listOrders = (storeId: string, extra: string[] = []) =>
  listAllRows<Order>(TABLES.orders, [Query.equal("store_id", storeId), ...extra, Query.orderDesc("created_at")]);

export const pageOrders = (storeId: string, filters: string[], limit: number, offset: number) =>
  listRows<Order>(TABLES.orders, [
    Query.equal("store_id", storeId),
    ...filters,
    Query.orderDesc("created_at"),
    Query.limit(limit),
    Query.offset(offset),
  ]);

export const countOrders = (storeId: string, filters: string[] = []) =>
  countRows(TABLES.orders, [Query.equal("store_id", storeId), ...filters]);

export const getOrder = async (storeId: string, id: string) => {
  const o = await getRow<Order>(TABLES.orders, id);
  return o && o.store_id === storeId ? o : null;
};

export const getOrderByToken = (storeId: string, token: string) =>
  firstRow<Order>(TABLES.orders, [Query.equal("store_id", storeId), Query.equal("public_token", token)]);

export const getOrderByPublicToken = (token: string) =>
  /^[a-f0-9]{32}$/.test(token) ? firstRow<Order>(TABLES.orders, [Query.equal("public_token", token)]) : Promise.resolve(null);

export const findOrderByNumber = (storeId: string, number: number) =>
  firstRow<Order>(TABLES.orders, [Query.equal("store_id", storeId), Query.equal("number", number)]);

export const findOrderByNumberAndPhone = (storeId: string, number: number, phone: string) =>
  firstRow<Order>(TABLES.orders, [Query.equal("store_id", storeId), Query.equal("number", number), Query.equal("phone", phone)]);

export const listOrdersByCustomer = (customerId: string) =>
  listAllRows<Order>(TABLES.orders, [Query.equal("customer_id", customerId), Query.orderDesc("created_at")]);

export const updateOrderRow = (id: string, data: Partial<Order>) => updateRow<Order>(TABLES.orders, id, data);

export async function listOrderItems(orderIds: string[]): Promise<OrderItem[]> {
  // Appwrite accepts at most 100 values per equal() query.
  const chunks: string[][] = [];
  for (let i = 0; i < orderIds.length; i += 100) chunks.push(orderIds.slice(i, i + 100));
  const pages = await Promise.all(chunks.map((ids) => listAllRows<OrderItem>(TABLES.orderItems, [Query.equal("order_id", ids)])));
  return pages.flat();
}

export const listOrderEvents = (orderId: string) =>
  listAllRows<OrderEvent>(TABLES.orderEvents, [Query.equal("order_id", orderId), Query.orderDesc("created_at")]);

export const addOrderEvent = (storeId: string, orderId: string, kind: string, message: string) =>
  createRow<OrderEvent>(TABLES.orderEvents, {
    store_id: storeId,
    order_id: orderId,
    kind,
    message,
    created_at: new Date().toISOString(),
  });

/* ------------------------------ Store secrets ----------------------------- */

type SecretRow = { id: string; store_id: string; kind: string; data: string };

/** Returns a store's decrypted credentials of one kind (e.g. "esewa"), or null. */
export async function getStoreSecret<T>(storeId: string, kind: string): Promise<T | null> {
  const row = await firstRow<SecretRow>(TABLES.storeSecrets, [Query.equal("store_id", storeId), Query.equal("kind", kind)]);
  if (!row) return null;
  try {
    return JSON.parse(decrypt(row.data)) as T;
  } catch {
    return null;
  }
}

export async function setStoreSecret(storeId: string, kind: string, value: object | null) {
  const row = await firstRow<SecretRow>(TABLES.storeSecrets, [Query.equal("store_id", storeId), Query.equal("kind", kind)]);
  if (!value) {
    if (row) await deleteRow(TABLES.storeSecrets, row.id);
    return;
  }
  const data = encrypt(JSON.stringify(value));
  if (row) await updateRow(TABLES.storeSecrets, row.id, { data });
  else await createRow(TABLES.storeSecrets, { store_id: storeId, kind, data });
}

/* --------------------------------- Ledger -------------------------------- */

export const addLedgerEntry = (e: Omit<LedgerEntry, "id" | "created_at">) =>
  createRow<LedgerEntry>(TABLES.ledger, { ...e, created_at: new Date().toISOString() });

export const listLedger = (storeId: string) =>
  listAllRows<LedgerEntry>(TABLES.ledger, [Query.equal("store_id", storeId), Query.orderDesc("created_at")]);
