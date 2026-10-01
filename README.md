# Farho

A store builder (similar to Blanxer): sellers sign up, create an online store, design their website and manage
products, orders and customers from an admin panel. Customers shop on the store's website and pay with cash on delivery.

## Features

**For sellers (admin panel at `/dashboard`)**
- Account signup/login; one account can run several stores
- Store creation wizard: name, web address, theme and brand colour
- **Website design editor** with live desktop/mobile preview: 3 themes (Classic, Modern, Minimal), brand colour, font,
  logo, banner image, homepage text, announcement bar and section toggles
- **Orders**: status tabs, search, pagination, order detail with progress tracker, one-click "Mark as next step",
  payment status, internal notes and timeline, printable invoice, customer tracking link
  - Cancelling an order restocks its items; delivering a COD order marks it paid
- **Products**: images (upload or URL), price and compare-at (discount) price, stock tracking, SKU, categories,
  featured/visible toggles, units sold
- Categories, **coupons** (percent/fixed, minimum order), **customers** with order history and lifetime spend
- Overview dashboard: 30-day revenue/orders, 14-day sales chart, recent orders, low-stock alerts, setup checklist
- Settings: currency (NPR/INR/USD), delivery charge, free-delivery threshold, contact and social links,
  publish/unpublish, delete store

**For customers (storefront at `/store/<slug>`)**
- Themed homepage, shop with category filter/search/sort, product pages, related products
- Cart (saved in the browser), checkout with coupon codes and cash on delivery
- Order confirmation page and order tracking (by order number + phone)
- Prices, stock and discounts are always re-checked on the server when an order is placed

## Tech

Next.js 15 (App Router, server actions) · React 19 · Tailwind CSS 4 · Appwrite (TablesDB + Storage) · zod.
All data lives in an Appwrite project; uploaded images go to an Appwrite Storage bucket. The browser never talks to
Appwrite directly — every read and write goes through the server with an API key.

## Getting started

1. Create an Appwrite project and an API key with these scopes: `databases`, `tables`, `columns`, `indexes`, `rows`,
   `buckets`, `files` (read + write).
2. Copy `.env.example` to `.env.local` and fill in `APPWRITE_PROJECT_ID` and `APPWRITE_API_KEY`.

```bash
npm install
npm run setup:appwrite   # creates the database, tables, indexes and image bucket (safe to re-run)
npm run seed             # optional: demo store at /store/demo, login demo@farho.app / demo1234
npm run dev              # http://localhost:3000
```

The scripts read the same variables; export them in your shell (or prefix the command) when running them.

Production: `npm run build && npm start`. Type-check with `npm run typecheck`.

### Custom subdomains

Set `ROOT_DOMAIN=yourdomain.com` (see `.env.example`) and point a wildcard DNS record `*.yourdomain.com` at the server.
`mystore.yourdomain.com` will then serve the store with slug `mystore`. Without it, stores are served at `/store/<slug>`.

## Project layout

```
src/app/(auth)            signup / login / logout
src/app/dashboard         store list, create store, per-store admin panel
src/app/store/[slug]      public storefront (home, products, product, cart, checkout, order, track)
src/lib/actions           server actions (store, catalog, orders + checkout)
src/lib/appwrite-schema.ts  Appwrite tables, columns and indexes
src/lib/data.ts           all data access
scripts/setup-appwrite.mts  creates the Appwrite schema
src/middleware.ts         subdomain → storefront rewrite
scripts/seed.mts          demo data
```

## Deploying to Azure App Service

The app builds to a standalone Node server (`.next/standalone`). Deploy it to a Linux App Service (Node 22) with the
startup command `sh /home/site/wwwroot/startup.sh` and these app settings: `APPWRITE_ENDPOINT`, `APPWRITE_PROJECT_ID`,
`APPWRITE_API_KEY`, `SCM_DO_BUILD_DURING_DEPLOYMENT=false`. `.github/workflows/azure-deploy.yml` automates this once the
`AZURE_WEBAPP_NAME` repository variable and `AZURE_WEBAPP_PUBLISH_PROFILE` secret are set.

## Next steps

Ideas not built yet: online payments (eSewa, Khalti), product variants (size/colour) and multiple images,
email/SMS notifications for new orders, staff accounts, custom domains with automatic SSL.
