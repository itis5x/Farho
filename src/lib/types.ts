export type User = {
  id: string;
  name: string;
  email: string;
  created_at: string;
};

export type Store = {
  id: string;
  owner_id: string;
  name: string;
  slug: string;
  tagline: string;
  about: string;
  logo_url: string;
  hero_image_url: string;
  hero_title: string;
  hero_subtitle: string;
  announcement: string;
  theme: Theme;
  primary_color: string;
  font: FontChoice;
  show_categories: boolean;
  show_featured: boolean;
  show_about: boolean;
  currency: string;
  delivery_charge: number;
  free_delivery_over: number;
  contact_phone: string;
  contact_email: string;
  address: string;
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string;
  published: boolean;
  next_order_number: number;
  payments: string;
  inbox: string;
  layout: string;
  created_at: string;
};

export type Category = { id: string; store_id: string; name: string; slug: string };

export type Product = {
  id: string;
  store_id: string;
  category_id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  image_url: string;
  sku: string;
  stock: number | null;
  active: boolean;
  featured: boolean;
  created_at: string;
};

export type Customer = {
  id: string;
  store_id: string;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  created_at: string;
};

export type Coupon = {
  id: string;
  store_id: string;
  code: string;
  kind: "percent" | "fixed";
  value: number;
  min_subtotal: number;
  active: boolean;
  times_used: number;
  created_at: string;
};

export const ORDER_STATUSES = [
  "pending",
  "confirmed",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const PAYMENT_STATUSES = ["unpaid", "paid", "refunded"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export type Order = {
  id: string;
  store_id: string;
  number: number;
  public_token: string;
  customer_id: string;
  customer_name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  note: string;
  subtotal: number;
  discount: number;
  coupon_code: string;
  delivery_charge: number;
  total: number;
  payment_method: string;
  payment_ref: string;
  payment_proof_url: string;
  payment_gateway_mode: string;
  paid_at: string | null;
  source: string;
  courier: string;
  courier_ref: string;
  courier_status: string;
  courier_fee: number | null;
  courier_booked_at: string | null;
  payment_status: PaymentStatus;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: string;
  store_id: string;
  order_id: string;
  product_id: string;
  name: string;
  image_url: string;
  price: number;
  quantity: number;
};

export type OrderEvent = {
  id: string;
  store_id: string;
  order_id: string;
  kind: string;
  message: string;
  created_at: string;
};

export const THEMES = ["classic", "modern", "minimal"] as const;
export type Theme = (typeof THEMES)[number];

export const FONTS = ["sans", "serif", "mono"] as const;
export type FontChoice = (typeof FONTS)[number];

export type FormState = { error?: string; ok?: string } | undefined;

export type LedgerEntry = {
  id: string;
  store_id: string;
  order_id: string;
  kind: "payment" | "fee" | "payout" | "refund";
  amount: number;
  gateway: string;
  note: string;
  created_at: string;
};

export type ChannelKind = "web" | "messenger" | "instagram" | "whatsapp" | "telegram";

export type Channel = {
  id: string;
  store_id: string;
  kind: ChannelKind;
  name: string;
  external_id: string;
  active: boolean;
  created_at: string;
};

export type Conversation = {
  id: string;
  store_id: string;
  channel_id: string;
  kind: ChannelKind;
  external_user_id: string;
  customer_name: string;
  customer_id: string;
  last_message: string;
  last_at: string;
  unread: number;
  bot_paused: boolean;
  state: string;
  created_at: string;
};

export type Message = {
  id: string;
  store_id: string;
  conversation_id: string;
  direction: "in" | "out";
  sender: "customer" | "seller" | "bot" | "ai";
  text: string;
  external_id: string;
  created_at: string;
};

export type AutoReply = { id: string; store_id: string; keywords: string; reply: string; active: boolean };
