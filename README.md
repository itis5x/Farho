# Farho

Farho lets anyone launch an online store and run their whole business from one admin panel: website, orders, payments,
deliveries, customer chats, counter sales and reports. Built for sellers in Nepal.

Live: https://farho.azurewebsites.net · Demo store: `/store/demo` (seller login `demo@farho.app` / `demo1234`)

## Features

**Website builder**
- 8 templates (Boutique, Tech Hub, Fresh Mart, Handmade, Glow Beauty, Streetwear, Luxe, Little Ones), applied in one click
- Homepage built from 14 section types: hero (4 styles), product grids/carousels, categories, promo banners,
  image + text, perks bar, testimonials, FAQ, YouTube video, gallery, sale countdown, spacer and sandboxed custom
  HTML/JS; add, reorder, hide, duplicate and edit with a live desktop/mobile preview
- Custom pages (About, Returns, Contact…) in the menu and footer, custom CSS, brand colour, font and logo
- Store subdomains (`mystore.yourdomain.com`) via `ROOT_DOMAIN`

**Selling**
- Products with variants (size, colour…) and per-variant price, stock and SKU; photo galleries; compare-at prices;
  categories; cost prices; barcodes
- Cart, coupons, delivery charges and free-delivery thresholds, wishlist, reviews with "verified buyer" badges
- "Order on WhatsApp" button and a chat bubble on every page
- Stock is reserved atomically at checkout, so two customers can never buy the last item

**Payments** — the store doesn't need its own merchant accounts
- Cash on delivery, eSewa (ePay v2), Khalti (KPG-2), any QR code (Fonepay / eSewa / bank) and bank transfer
- *Farho Pay*: eSewa and Khalti through the platform's merchant account with a per-store payout ledger, or the
  store's own merchant keys (encrypted at rest)
- Payments are always verified server-side with the gateway before an order is marked paid

**Inbox and assistant**
- One inbox for website chat, Messenger, Instagram, WhatsApp (Cloud API) and Telegram
- Keyword auto-replies and a built-in assistant for catalogue, prices, delivery and order status
- Optional Claude assistant that answers questions in English or Nepali and places orders after the customer confirms
- Sellers can reply and pause the assistant per chat; order details are only shared with the phone number on the order

**Orders and delivery**
- Order pipeline, payment status, notes, timeline, printable invoices, customer tracking page
- Courier booking with Pathao and Nepal Can Move (one click, COD amount filled in), status refresh and webhooks;
  delivered parcels mark orders delivered and paid
- POS for counter sales (barcode scanning, change calculator, receipts) and manual orders for phone/DM sales,
  printable Code 128 barcode labels
- SMS updates to customers through Sparrow SMS or Aakash SMS

**Running the business**
- Overview dashboard and reports: revenue, profit, average order, sales by channel, payment method and city, best sellers
- Customers with order history and lifetime spend
- CSV export of orders and products, CSV product import
- Team accounts: owner, manager and staff roles

## Tech

Next.js 15 (App Router, server actions) · React 19 · Tailwind CSS 4 · Appwrite (TablesDB + Storage) · zod ·
Anthropic SDK (optional AI assistant). Every read and write goes through the server with an Appwrite API key; the
browser never talks to Appwrite directly.

## Getting started

1. Create an Appwrite project and an API key with these scopes: `databases`, `tables`, `columns`, `indexes`, `rows`,
   `buckets`, `files` (read + write).
2. Copy `.env.example` to `.env.local` and fill it in.

```bash
npm install
npm run setup:appwrite   # creates/updates the database, tables, indexes and image bucket (safe to re-run)
npm run seed             # optional demo store at /store/demo, login demo@farho.app / demo1234
npm run dev              # http://localhost:3000
```

The scripts read the same variables as the app; export them in your shell when running them.

### Configuration

| Variable | Purpose |
|---|---|
| `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`, `APPWRITE_API_KEY` | Appwrite connection (required) |
| `SECRETS_KEY` | Encrypts stored merchant, courier and channel credentials (recommended; 32+ random characters) |
| `PUBLIC_URL` | Public base URL used in payment and webhook links, e.g. `https://farho.azurewebsites.net` |
| `ROOT_DOMAIN` | Enables `<store>.yourdomain.com` subdomains |
| `FARHO_ESEWA_PRODUCT_CODE`, `FARHO_ESEWA_SECRET_KEY` | Farho Pay eSewa merchant (without them Farho Pay uses eSewa's test environment) |
| `FARHO_KHALTI_SECRET_KEY` | Farho Pay Khalti merchant |
| `FARHO_PAYMENTS_LIVE=true` | Use the gateways' production endpoints for Farho Pay |
| `FARHO_PAY_FEE_PERCENT` | Farho Pay fee (default 1.5) |
| `ANTHROPIC_API_KEY`, `FARHO_AI_MODEL` | Enables the Claude shopping assistant (default model `claude-opus-5-5`) |
| `META_APP_SECRET`, `META_VERIFY_TOKEN` | Optional platform Meta app for `/api/webhooks/meta` |

## Deploying to Azure App Service

The app builds to a standalone Node server (`.next/standalone`). Deploy it to a Linux App Service (Node 22) with the
startup command `sh /home/site/wwwroot/startup.sh`, the variables above, and `SCM_DO_BUILD_DURING_DEPLOYMENT=false`.
`.github/workflows/azure-deploy.yml` automates this once the `AZURE_WEBAPP_NAME` repository variable and
`AZURE_WEBAPP_PUBLISH_PROFILE` secret are set.

## Project layout

```
src/app/(auth)                 signup / login / logout
src/app/dashboard/[storeId]    admin panel (orders, POS, inbox, products, reviews, payments, delivery, design, team…)
src/app/store/[slug]           storefront (home, shop, product, cart, checkout, order, track, pages, wishlist)
src/app/api                    payment returns, webhooks (Meta, Telegram, couriers), CSV exports
src/lib/data.ts                data access (Appwrite)        src/lib/appwrite-schema.ts  tables and indexes
src/lib/orders.ts              pricing, stock and order creation
src/lib/payments, couriers, inbox, builder                    integrations and features
scripts/setup-appwrite.mts     creates the schema            scripts/seed.mts            demo data
```
