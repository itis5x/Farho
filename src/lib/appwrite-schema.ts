// Appwrite database layout. Shared by the app and scripts/setup-appwrite.mts,
// so this file must not import anything.

export const DATABASE_ID = "farho";
export const BUCKET_ID = "images";

export const TABLES = {
  users: "users",
  sessions: "sessions",
  stores: "stores",
  categories: "categories",
  products: "products",
  customers: "customers",
  coupons: "coupons",
  orders: "orders",
  orderItems: "order_items",
  orderEvents: "order_events",
  storeSecrets: "store_secrets",
  ledger: "ledger",
  channels: "channels",
  conversations: "conversations",
  messages: "messages",
  autoReplies: "auto_replies",
} as const;

export type ColumnDef =
  | { key: string; type: "varchar"; size: number; required?: boolean; default?: string }
  | { key: string; type: "text"; required?: boolean }
  | { key: string; type: "integer"; required?: boolean; default?: number }
  | { key: string; type: "float"; required?: boolean; default?: number }
  | { key: string; type: "boolean"; required?: boolean; default?: boolean }
  | { key: string; type: "datetime"; required?: boolean }
  | { key: string; type: "enum"; elements: string[]; required?: boolean; default?: string };

export type IndexDef = { key: string; type: "key" | "unique"; columns: string[]; orders?: ("ASC" | "DESC")[] };

export type TableDef = { id: string; name: string; columns: ColumnDef[]; indexes: IndexDef[] };

const v = (key: string, size: number, opts: { required?: boolean; default?: string } = {}): ColumnDef => ({
  key,
  type: "varchar",
  size,
  ...opts,
  ...(opts.required ? {} : { default: opts.default ?? "" }),
});

export const SCHEMA: TableDef[] = [
  {
    id: TABLES.users,
    name: "Users",
    columns: [v("name", 100, { required: true }), v("email", 200, { required: true }), v("password_hash", 100, { required: true })],
    indexes: [{ key: "email_unique", type: "unique", columns: ["email"] }],
  },
  {
    id: TABLES.sessions,
    name: "Sessions",
    columns: [v("token", 64, { required: true }), v("user_id", 36, { required: true }), { key: "expires_at", type: "datetime", required: true }],
    indexes: [
      { key: "token_unique", type: "unique", columns: ["token"] },
      { key: "user_idx", type: "key", columns: ["user_id"] },
    ],
  },
  {
    id: TABLES.stores,
    name: "Stores",
    columns: [
      v("owner_id", 36, { required: true }),
      v("name", 100, { required: true }),
      v("slug", 50, { required: true }),
      v("tagline", 150),
      { key: "about", type: "text" },
      v("logo_url", 500),
      v("hero_image_url", 500),
      v("hero_title", 150),
      v("hero_subtitle", 300),
      v("announcement", 200),
      { key: "theme", type: "enum", elements: ["classic", "modern", "minimal"], default: "classic" },
      v("primary_color", 7, { default: "#4f46e5" }),
      { key: "font", type: "enum", elements: ["sans", "serif", "mono"], default: "sans" },
      { key: "show_categories", type: "boolean", default: true },
      { key: "show_featured", type: "boolean", default: true },
      { key: "show_about", type: "boolean", default: true },
      { key: "currency", type: "enum", elements: ["NPR", "INR", "USD"], default: "NPR" },
      { key: "delivery_charge", type: "float", default: 0 },
      { key: "free_delivery_over", type: "float", default: 0 },
      v("contact_phone", 40),
      v("contact_email", 200),
      v("address", 250),
      v("facebook_url", 250),
      v("instagram_url", 250),
      v("tiktok_url", 250),
      { key: "published", type: "boolean", default: true },
      { key: "next_order_number", type: "integer", default: 1001 },
      // JSON: which payment methods the store offers (see src/lib/payments/settings.ts).
      { key: "payments", type: "text" },
      // JSON: inbox/assistant settings (see src/lib/inbox/settings.ts).
      { key: "inbox", type: "text" },
    ],
    indexes: [
      { key: "slug_unique", type: "unique", columns: ["slug"] },
      { key: "owner_idx", type: "key", columns: ["owner_id"] },
    ],
  },
  {
    id: TABLES.categories,
    name: "Categories",
    columns: [v("store_id", 36, { required: true }), v("name", 100, { required: true }), v("slug", 80, { required: true })],
    indexes: [{ key: "store_slug_unique", type: "unique", columns: ["store_id", "slug"] }],
  },
  {
    id: TABLES.products,
    name: "Products",
    columns: [
      v("store_id", 36, { required: true }),
      v("category_id", 36, { default: "" }),
      v("name", 150, { required: true }),
      v("slug", 100, { required: true }),
      { key: "description", type: "text" },
      { key: "price", type: "float", required: true },
      { key: "compare_at_price", type: "float" },
      v("image_url", 500),
      v("sku", 80),
      { key: "stock", type: "integer" },
      { key: "active", type: "boolean", default: true },
      { key: "featured", type: "boolean", default: false },
    ],
    indexes: [
      { key: "store_slug_unique", type: "unique", columns: ["store_id", "slug"] },
      { key: "category_idx", type: "key", columns: ["category_id"] },
    ],
  },
  {
    id: TABLES.customers,
    name: "Customers",
    columns: [
      v("store_id", 36, { required: true }),
      v("name", 100, { required: true }),
      v("phone", 20, { required: true }),
      v("email", 200),
      v("address", 250),
      v("city", 80),
    ],
    indexes: [{ key: "store_phone_unique", type: "unique", columns: ["store_id", "phone"] }],
  },
  {
    id: TABLES.coupons,
    name: "Coupons",
    columns: [
      v("store_id", 36, { required: true }),
      v("code", 30, { required: true }),
      { key: "kind", type: "enum", elements: ["percent", "fixed"], required: true },
      { key: "value", type: "float", required: true },
      { key: "min_subtotal", type: "float", default: 0 },
      { key: "active", type: "boolean", default: true },
      { key: "times_used", type: "integer", default: 0 },
    ],
    indexes: [{ key: "store_code_unique", type: "unique", columns: ["store_id", "code"] }],
  },
  {
    id: TABLES.orders,
    name: "Orders",
    columns: [
      v("store_id", 36, { required: true }),
      { key: "number", type: "integer", required: true },
      v("public_token", 32, { required: true }),
      v("customer_id", 36),
      v("customer_name", 100, { required: true }),
      v("phone", 20, { required: true }),
      v("email", 200),
      v("address", 250, { required: true }),
      v("city", 80),
      v("note", 500),
      { key: "subtotal", type: "float", required: true },
      { key: "discount", type: "float", default: 0 },
      v("coupon_code", 30),
      { key: "delivery_charge", type: "float", default: 0 },
      { key: "total", type: "float", required: true },
      v("payment_method", 20, { default: "cod" }),
      v("payment_ref", 120),
      v("payment_proof_url", 500),
      v("payment_gateway_mode", 10),
      { key: "paid_at", type: "datetime" },
      v("source", 20, { default: "website" }),
      v("courier", 30),
      v("courier_ref", 80),
      v("courier_status", 80),
      { key: "courier_fee", type: "float" },
      { key: "courier_booked_at", type: "datetime" },
      { key: "payment_status", type: "enum", elements: ["unpaid", "paid", "refunded"], default: "unpaid" },
      {
        key: "status",
        type: "enum",
        elements: ["pending", "confirmed", "processing", "shipped", "delivered", "cancelled"],
        default: "pending",
      },
      { key: "created_at", type: "datetime", required: true },
    ],
    indexes: [
      { key: "token_unique", type: "unique", columns: ["public_token"] },
      { key: "store_number_unique", type: "unique", columns: ["store_id", "number"] },
      { key: "store_created_idx", type: "key", columns: ["store_id", "created_at"], orders: ["ASC", "DESC"] },
      { key: "customer_idx", type: "key", columns: ["customer_id"] },
      { key: "courier_ref_idx", type: "key", columns: ["courier_ref"] },
    ],
  },
  {
    id: TABLES.orderItems,
    name: "Order items",
    columns: [
      v("store_id", 36, { required: true }),
      v("order_id", 36, { required: true }),
      v("product_id", 36),
      v("name", 150, { required: true }),
      v("image_url", 500),
      { key: "price", type: "float", required: true },
      { key: "quantity", type: "integer", required: true },
    ],
    indexes: [
      { key: "order_idx", type: "key", columns: ["order_id"] },
      { key: "store_idx", type: "key", columns: ["store_id"] },
    ],
  },
  {
    id: TABLES.orderEvents,
    name: "Order events",
    columns: [
      v("store_id", 36, { required: true }),
      v("order_id", 36, { required: true }),
      v("kind", 20, { required: true }),
      v("message", 1000, { required: true }),
      { key: "created_at", type: "datetime", required: true },
    ],
    indexes: [
      { key: "order_idx", type: "key", columns: ["order_id"] },
      { key: "store_idx", type: "key", columns: ["store_id"] },
    ],
  },
  {
    id: TABLES.storeSecrets,
    name: "Store secrets",
    // Merchant/courier/social credentials, AES-256-GCM encrypted by the app before storing.
    columns: [v("store_id", 36, { required: true }), v("kind", 30, { required: true }), { key: "data", type: "text", required: true }],
    indexes: [{ key: "store_kind_unique", type: "unique", columns: ["store_id", "kind"] }],
  },
  {
    id: TABLES.ledger,
    name: "Ledger",
    // Money collected by Farho Pay on a store's behalf, platform fees and payouts.
    columns: [
      v("store_id", 36, { required: true }),
      v("order_id", 36),
      { key: "kind", type: "enum", elements: ["payment", "fee", "payout", "refund"], required: true },
      { key: "amount", type: "float", required: true },
      v("gateway", 20),
      v("note", 300),
      { key: "created_at", type: "datetime", required: true },
    ],
    indexes: [{ key: "store_created_idx", type: "key", columns: ["store_id", "created_at"], orders: ["ASC", "DESC"] }],
  },
  {
    id: TABLES.channels,
    name: "Channels",
    // A connected messaging account. Its access tokens live in store_secrets under kind "channel:<id>".
    columns: [
      v("store_id", 36, { required: true }),
      { key: "kind", type: "enum", elements: ["web", "messenger", "instagram", "whatsapp", "telegram"], required: true },
      v("name", 120),
      v("external_id", 64),
      { key: "active", type: "boolean", default: true },
    ],
    indexes: [
      { key: "store_idx", type: "key", columns: ["store_id"] },
      { key: "kind_external_idx", type: "key", columns: ["kind", "external_id"] },
    ],
  },
  {
    id: TABLES.conversations,
    name: "Conversations",
    columns: [
      v("store_id", 36, { required: true }),
      v("channel_id", 36, { required: true }),
      v("kind", 20, { required: true }),
      v("external_user_id", 80, { required: true }),
      v("customer_name", 120),
      v("customer_id", 36),
      v("last_message", 300),
      { key: "last_at", type: "datetime", required: true },
      { key: "unread", type: "integer", default: 0 },
      { key: "bot_paused", type: "boolean", default: false },
      // JSON scratchpad for the assistant (e.g. collected order details).
      { key: "state", type: "text" },
    ],
    indexes: [
      { key: "channel_user_unique", type: "unique", columns: ["channel_id", "external_user_id"] },
      { key: "store_last_idx", type: "key", columns: ["store_id", "last_at"], orders: ["ASC", "DESC"] },
    ],
  },
  {
    id: TABLES.messages,
    name: "Messages",
    columns: [
      v("store_id", 36, { required: true }),
      v("conversation_id", 36, { required: true }),
      { key: "direction", type: "enum", elements: ["in", "out"], required: true },
      { key: "sender", type: "enum", elements: ["customer", "seller", "bot", "ai"], required: true },
      { key: "text", type: "text", required: true },
      v("external_id", 120),
      { key: "created_at", type: "datetime", required: true },
    ],
    indexes: [{ key: "conversation_created_idx", type: "key", columns: ["conversation_id", "created_at"] }],
  },
  {
    id: TABLES.autoReplies,
    name: "Auto replies",
    columns: [
      v("store_id", 36, { required: true }),
      v("keywords", 300, { required: true }),
      v("reply", 1000, { required: true }),
      { key: "active", type: "boolean", default: true },
    ],
    indexes: [{ key: "store_idx", type: "key", columns: ["store_id"] }],
  },
];
