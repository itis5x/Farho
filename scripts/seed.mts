/**
 * Seeds a demo account and store in Appwrite (run setup:appwrite first).
 *   APPWRITE_PROJECT_ID=... APPWRITE_API_KEY=... npm run seed
 * Login: demo@farho.app / demo1234 — storefront at /store/demo
 */
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import { Client, ID, Query, TablesDB } from "node-appwrite";
import { DATABASE_ID, TABLES } from "../src/lib/appwrite-schema.ts";

const projectId = process.env.APPWRITE_PROJECT_ID;
const apiKey = process.env.APPWRITE_API_KEY;
if (!projectId || !apiKey) {
  console.error("Set APPWRITE_PROJECT_ID and APPWRITE_API_KEY.");
  process.exit(1);
}
const client = new Client()
  .setEndpoint(process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1")
  .setProject(projectId)
  .setKey(apiKey);
const db = new TablesDB(client);

const create = async (tableId: string, data: Record<string, unknown>) =>
  (await db.createRow({ databaseId: DATABASE_ID, tableId, rowId: ID.unique(), data })).$id;
const wipe = (tableId: string, queries: string[]) => db.deleteRows({ databaseId: DATABASE_ID, tableId, queries });

// Remove a previous demo store and user.
const old = await db.listRows({ databaseId: DATABASE_ID, tableId: TABLES.stores, queries: [Query.equal("slug", "demo")] });
for (const s of old.rows) {
  for (const t of Object.values(TABLES)) {
    if (t === TABLES.users || t === TABLES.sessions || t === TABLES.stores) continue;
    await wipe(t, [Query.equal("store_id", s.$id)]);
  }
  await db.deleteRow({ databaseId: DATABASE_ID, tableId: TABLES.stores, rowId: s.$id });
}
await wipe(TABLES.users, [Query.equal("email", "demo@farho.app")]);

const userId = await create(TABLES.users, {
  name: "Demo Seller",
  email: "demo@farho.app",
  password_hash: bcrypt.hashSync("demo1234", 10),
});

const storeId = await create(TABLES.stores, {
  owner_id: userId,
  name: "Himalayan Threads",
  slug: "demo",
  tagline: "Handmade in Nepal",
  about:
    "We work with artisans across Nepal to bring you handwoven pashmina, felt goods and everyday essentials.\nEvery purchase supports local makers.",
  hero_title: "Warm, handmade & made to last",
  hero_subtitle: "Discover pashmina shawls, felt crafts and knitwear woven by Nepali artisans.",
  hero_image_url: "https://picsum.photos/seed/himalaya/1600/900",
  announcement: "🎉 Free delivery on orders over Rs. 3,000 — Cash on delivery available",
  theme: "classic",
  primary_color: "#b45309",
  delivery_charge: 100,
  free_delivery_over: 3000,
  contact_phone: "+977 9800000000",
  contact_email: "hello@himalayanthreads.example",
  address: "Thamel, Kathmandu",
  instagram_url: "https://instagram.com/",
  payments: JSON.stringify({
    cod: { enabled: true, label: "Cash on delivery" },
    esewa: { enabled: true, mode: "farho" },
    khalti: { enabled: false, mode: "farho" },
    qr: { enabled: false, label: "Scan & pay", image_url: "", instructions: "" },
    bank: { enabled: true, details: "Nabil Bank\nHimalayan Threads Pvt. Ltd.\nA/C 0123456789012\nThamel branch" },
  }),
});

const cat = (name: string, slug: string) => create(TABLES.categories, { store_id: storeId, name, slug });
const [shawls, felt, knit] = await Promise.all([cat("Shawls", "shawls"), cat("Felt crafts", "felt-crafts"), cat("Knitwear", "knitwear")]);

const products: [string, number, number | null, number | null, string, boolean, string][] = [
  ["Pure Pashmina Shawl", 8500, 10500, 12, shawls, true, "Ultra-soft 100% pashmina, handwoven in Kathmandu."],
  ["Cashmere Blend Scarf", 3200, null, 25, shawls, true, "Lightweight everyday scarf in a cashmere-silk blend."],
  ["Yak Wool Blanket", 6400, 7200, 4, shawls, false, "Thick, warm blanket made from Himalayan yak wool."],
  ["Felt Ball Garland", 950, null, 40, felt, true, "Colourful garland of 30 hand-rolled felt balls."],
  ["Felt Cat Cave", 4200, null, 6, felt, false, "Cosy felted wool cave your cat will love."],
  ["Felt Slippers", 1800, 2200, 0, felt, false, "Warm felt slippers with a non-slip sole."],
  ["Hand-knit Wool Beanie", 1200, null, 30, knit, true, "Fleece-lined beanie, hand knitted in Pokhara."],
  ["Woolen Mittens", 900, null, null, knit, false, "Fleece-lined mittens with traditional patterns."],
  ["Hemp Backpack", 3500, null, 8, knit, false, "Durable hemp backpack with laptop sleeve."],
];
const productRows: { id: string; name: string; price: number; image: string }[] = [];
for (const [name, price, compare, stock, category, featured, description] of products) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const image = `https://picsum.photos/seed/${slug}/600/600`;
  const id = await create(TABLES.products, {
    store_id: storeId,
    category_id: category,
    name,
    slug,
    description,
    price,
    compare_at_price: compare,
    stock,
    featured,
    image_url: image,
  });
  productRows.push({ id, name, price, image });
}

// A product with sizes and colours.
const teeId = await create(TABLES.products, {
  store_id: storeId,
  category_id: knit,
  name: "Hemp Everyday Tee",
  slug: "hemp-everyday-tee",
  description: "Breathable hemp-cotton tee, dyed with natural colours.",
  price: 1500,
  cost_price: 650,
  stock: 0,
  featured: true,
  image_url: "https://picsum.photos/seed/hemp-tee/600/600",
  images: JSON.stringify(["https://picsum.photos/seed/hemp-tee-2/600/600", "https://picsum.photos/seed/hemp-tee-3/600/600"]),
  options: JSON.stringify([{ name: "Size", values: ["S", "M", "L"] }, { name: "Colour", values: ["Natural", "Indigo"] }]),
});
let teeStock = 0;
let pos = 0;
for (const size of ["S", "M", "L"]) {
  for (const colour of ["Natural", "Indigo"]) {
    const stock = size === "L" && colour === "Indigo" ? 0 : 6;
    teeStock += stock;
    await create(TABLES.variants, {
      store_id: storeId,
      product_id: teeId,
      title: `${size} / ${colour}`,
      option1: size,
      option2: colour,
      price: colour === "Indigo" ? 1650 : null,
      stock,
      sku: `TEE-${size}-${colour.slice(0, 3).toUpperCase()}`,
      position: pos++,
    });
  }
}
await db.updateRow({ databaseId: DATABASE_ID, tableId: TABLES.products, rowId: teeId, data: { stock: teeStock } });

await create(TABLES.coupons, { store_id: storeId, code: "DASHAIN10", kind: "percent", value: 10, min_subtotal: 1000 });

const people = [
  ["Aarati Shrestha", "9801111111", "Kathmandu", "Baneshwor"],
  ["Bikash Gurung", "9802222222", "Pokhara", "Lakeside"],
  ["Sita Tamang", "9803333333", "Lalitpur", "Jhamsikhel"],
  ["Rohan Karki", "9804444444", "Bhaktapur", "Suryabinayak"],
  ["Nisha Rai", "9805555555", "Dharan", "Bhanu Chowk"],
];
const customerIds = await Promise.all(
  people.map(([name, phone, city, address]) => create(TABLES.customers, { store_id: storeId, name, phone, city, address })),
);

const statuses = ["delivered", "delivered", "shipped", "processing", "confirmed", "pending", "pending", "cancelled"];
let number = 1001;
for (let i = 0; i < 18; i++) {
  const [name, phone, city, address] = people[i % people.length];
  const lines = [productRows[(i * 3) % productRows.length], productRows[(i * 5 + 1) % productRows.length]].slice(0, (i % 2) + 1);
  const subtotal = lines.reduce((s, p) => s + p.price, 0);
  const delivery = subtotal >= 3000 ? 0 : 100;
  const status = statuses[i % statuses.length];
  const created = new Date(Date.now() - Math.floor((18 - i) * 0.75) * 86_400_000 - ((i * 37) % 600) * 60_000).toISOString();
  const orderId = await create(TABLES.orders, {
    store_id: storeId,
    number: number++,
    public_token: crypto.randomBytes(16).toString("hex"),
    customer_id: customerIds[i % people.length],
    customer_name: name,
    phone,
    address,
    city,
    subtotal,
    delivery_charge: delivery,
    total: subtotal + delivery,
    status,
    payment_status: status === "delivered" ? "paid" : "unpaid",
    created_at: created,
  });
  await Promise.all([
    ...lines.map((p) =>
      create(TABLES.orderItems, { store_id: storeId, order_id: orderId, product_id: p.id, name: p.name, image_url: p.image, price: p.price, quantity: 1 }),
    ),
    create(TABLES.orderEvents, { store_id: storeId, order_id: orderId, kind: "status", message: "Order placed by customer", created_at: created }),
  ]);
}
await db.updateRow({ databaseId: DATABASE_ID, tableId: TABLES.stores, rowId: storeId, data: { next_order_number: number } });

// A few reviews.
const reviews: [number, string, number, string][] = [
  [0, "Aarati Shrestha", 5, "So soft and warm — exactly like the photos. Fast delivery too!"],
  [0, "Bikash Gurung", 4, "Beautiful shawl, bought it as a gift for my mother."],
  [3, "Sita Tamang", 5, "The kids love the garland. Great colours."],
  [6, "Rohan Karki", 5, "Perfect fit and really warm."],
];
for (const [i, name, rating, text] of reviews) {
  await create(TABLES.reviews, {
    store_id: storeId,
    product_id: productRows[i].id,
    name,
    rating,
    text,
    verified: true,
    approved: true,
    created_at: new Date(Date.now() - (i + 1) * 86_400_000).toISOString(),
  });
}

console.log("Seeded demo store → /store/demo");
console.log("Login: demo@farho.app / demo1234");
