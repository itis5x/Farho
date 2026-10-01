export type User = {
  id: number;
  name: string;
  email: string;
  created_at: string;
};

export type Store = {
  id: number;
  owner_id: number;
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
  show_categories: number;
  show_featured: number;
  show_about: number;
  currency: string;
  delivery_charge: number;
  free_delivery_over: number;
  contact_phone: string;
  contact_email: string;
  address: string;
  facebook_url: string;
  instagram_url: string;
  tiktok_url: string;
  published: number;
  next_order_number: number;
  created_at: string;
};

export type Category = { id: number; store_id: number; name: string; slug: string };

export type Product = {
  id: number;
  store_id: number;
  category_id: number | null;
  name: string;
  slug: string;
  description: string;
  price: number;
  compare_at_price: number | null;
  image_url: string;
  sku: string;
  stock: number | null;
  active: number;
  featured: number;
  created_at: string;
};

export type Customer = {
  id: number;
  store_id: number;
  name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  created_at: string;
};

export type Coupon = {
  id: number;
  store_id: number;
  code: string;
  kind: "percent" | "fixed";
  value: number;
  min_subtotal: number;
  active: number;
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
  id: number;
  store_id: number;
  number: number;
  public_token: string;
  customer_id: number | null;
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
  payment_status: PaymentStatus;
  status: OrderStatus;
  created_at: string;
  updated_at: string;
};

export type OrderItem = {
  id: number;
  order_id: number;
  product_id: number | null;
  name: string;
  image_url: string;
  price: number;
  quantity: number;
};

export type OrderEvent = {
  id: number;
  order_id: number;
  kind: string;
  message: string;
  created_at: string;
};

export const THEMES = ["classic", "modern", "minimal"] as const;
export type Theme = (typeof THEMES)[number];

export const FONTS = ["sans", "serif", "mono"] as const;
export type FontChoice = (typeof FONTS)[number];

export type FormState = { error?: string; ok?: string } | undefined;
