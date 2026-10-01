/**
 * Seeds a demo account and store so you can explore Farho right away.
 *   npm run seed
 * Login: demo@farho.app / demo1234 — storefront at /store/demo
 */
import Database from "better-sqlite3";
import bcrypt from "bcryptjs";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { SCHEMA } from "../src/lib/schema.ts";

const dataDir = path.resolve(process.env.DATA_DIR || "./data");
fs.mkdirSync(path.join(dataDir, "uploads"), { recursive: true });
const db = new Database(path.join(dataDir, "farho.db"));
db.pragma("foreign_keys = ON");
db.exec(SCHEMA);

const email = "demo@farho.app";
db.prepare("DELETE FROM users WHERE email = ?").run(email);
db.prepare("DELETE FROM stores WHERE slug = 'demo'").run();

const userId = Number(
  db
    .prepare("INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)")
    .run("Demo Seller", email, bcrypt.hashSync("demo1234", 10)).lastInsertRowid,
);

const storeId = Number(
  db
    .prepare(
      `INSERT INTO stores (owner_id, name, slug, tagline, about, hero_title, hero_subtitle, hero_image_url, announcement,
         theme, primary_color, delivery_charge, free_delivery_over, contact_phone, contact_email, address, instagram_url)
       VALUES (?, 'Himalayan Threads', 'demo', 'Handmade in Nepal', ?, ?, ?, ?, ?, 'classic', '#b45309', 100, 3000,
         '+977 9800000000', 'hello@himalayanthreads.example', 'Thamel, Kathmandu', 'https://instagram.com/')`,
    )
    .run(
      userId,
      "We work with artisans across Nepal to bring you handwoven pashmina, felt goods and everyday essentials.\nEvery purchase supports local makers.",
      "Warm, handmade & made to last",
      "Discover pashmina shawls, felt crafts and knitwear woven by Nepali artisans.",
      "https://picsum.photos/seed/himalaya/1600/900",
      "🎉 Free delivery on orders over Rs. 3,000 — Cash on delivery available",
    ).lastInsertRowid,
);

const cat = (name: string, slug: string) =>
  Number(db.prepare("INSERT INTO categories (store_id, name, slug) VALUES (?, ?, ?)").run(storeId, name, slug).lastInsertRowid);
const shawls = cat("Shawls", "shawls");
const felt = cat("Felt crafts", "felt-crafts");
const knit = cat("Knitwear", "knitwear");

const products: [string, number, number | null, number | null, number, number, string][] = [
  ["Pure Pashmina Shawl", 8500, 10500, 12, shawls, 1, "Ultra-soft 100% pashmina, handwoven in Kathmandu."],
  ["Cashmere Blend Scarf", 3200, null, 25, shawls, 1, "Lightweight everyday scarf in a cashmere-silk blend."],
  ["Yak Wool Blanket", 6400, 7200, 4, shawls, 0, "Thick, warm blanket made from Himalayan yak wool."],
  ["Felt Ball Garland", 950, null, 40, felt, 1, "Colourful garland of 30 hand-rolled felt balls."],
  ["Felt Cat Cave", 4200, null, 6, felt, 0, "Cosy felted wool cave your cat will love."],
  ["Felt Slippers", 1800, 2200, 0, felt, 0, "Warm felt slippers with a non-slip sole."],
  ["Hand-knit Wool Beanie", 1200, null, 30, knit, 1, "Fleece-lined beanie, hand knitted in Pokhara."],
  ["Woolen Mittens", 900, null, null, knit, 0, "Fleece-lined mittens with traditional patterns."],
  ["Hemp Backpack", 3500, null, 8, knit, 0, "Durable hemp backpack with laptop sleeve."],
];
const insertProduct = db.prepare(
  `INSERT INTO products (store_id, category_id, name, slug, description, price, compare_at_price, stock, featured, image_url)
   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
);
const productIds = products.map(([name, price, compare, stock, category, featured, desc]) => {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  return {
    id: Number(
      insertProduct.run(storeId, category, name, slug, desc, price, compare, stock, featured, `https://picsum.photos/seed/${slug}/600/600`)
        .lastInsertRowid,
    ),
    name,
    price,
    image: `https://picsum.photos/seed/${slug}/600/600`,
  };
});

db.prepare("INSERT INTO coupons (store_id, code, kind, value, min_subtotal) VALUES (?, 'DASHAIN10', 'percent', 10, 1000)").run(storeId);

const customers = [
  ["Aarati Shrestha", "9801111111", "Kathmandu", "Baneshwor"],
  ["Bikash Gurung", "9802222222", "Pokhara", "Lakeside"],
  ["Sita Tamang", "9803333333", "Lalitpur", "Jhamsikhel"],
  ["Rohan Karki", "9804444444", "Bhaktapur", "Suryabinayak"],
  ["Nisha Rai", "9805555555", "Dharan", "Bhanu Chowk"],
];
const statuses = ["delivered", "delivered", "shipped", "processing", "confirmed", "pending", "pending", "cancelled"];
let number = 1001;
for (let i = 0; i < 18; i++) {
  const [name, phone, city, address] = customers[i % customers.length];
  db.prepare(
    "INSERT INTO customers (store_id, name, phone, address, city) VALUES (?, ?, ?, ?, ?) ON CONFLICT DO NOTHING",
  ).run(storeId, name, phone, address, city);
  const { id: customerId } = db.prepare("SELECT id FROM customers WHERE store_id = ? AND phone = ?").get(storeId, phone) as { id: number };

  const lines = [productIds[(i * 3) % productIds.length], productIds[(i * 5 + 1) % productIds.length]].slice(0, (i % 2) + 1);
  const subtotal = lines.reduce((s, p) => s + p.price, 0);
  const delivery = subtotal >= 3000 ? 0 : 100;
  const status = statuses[i % statuses.length];
  const daysAgo = Math.floor((18 - i) * 0.75);
  const created = `datetime('now', '-${daysAgo} days', '-${(i * 37) % 600} minutes')`;
  const orderId = Number(
    db
      .prepare(
        `INSERT INTO orders (store_id, number, public_token, customer_id, customer_name, phone, address, city, subtotal,
           delivery_charge, total, status, payment_status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ${created}, ${created})`,
      )
      .run(
        storeId,
        number++,
        crypto.randomBytes(16).toString("hex"),
        customerId,
        name,
        phone,
        address,
        city,
        subtotal,
        delivery,
        subtotal + delivery,
        status,
        status === "delivered" ? "paid" : "unpaid",
      ).lastInsertRowid,
  );
  for (const p of lines) {
    db.prepare("INSERT INTO order_items (order_id, product_id, name, image_url, price, quantity) VALUES (?, ?, ?, ?, ?, 1)").run(
      orderId,
      p.id,
      p.name,
      p.image,
      p.price,
    );
  }
  db.prepare(`INSERT INTO order_events (order_id, kind, message, created_at) VALUES (?, 'status', 'Order placed by customer', ${created})`).run(orderId);
}
db.prepare("UPDATE stores SET next_order_number = ? WHERE id = ?").run(number, storeId);

console.log("Seeded demo store → /store/demo");
console.log("Login: demo@farho.app / demo1234");
