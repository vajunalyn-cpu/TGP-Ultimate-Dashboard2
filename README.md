# TGP Ultimate Dashboard

Premium single-page dashboard for The Gummy Pack — covering executive summary,
sales performance, TikTok Shop, Shopify, marketing, inventory, and customer
experience.

## Run

Open `index.html` in any modern browser. No build step or server required.

## Features

- **Executive Summary** — combined KPIs (revenue, orders, AOV, cancellations,
  returns, ROAS), revenue-by-channel chart, channel mix, top products,
  recent activity feed.
- **Sales Performance** — per-entry log with channel, product, units, revenue,
  notes; trend & channel comparison charts.
- **TikTok Shop & Shopify** — separate sections each tracking inventory, sales,
  fulfillment, cancellations, returns, claims, refunds, and replacements.
- **Marketing** — coupons, discounts, ads, and affiliates with spend, attributed
  revenue, and automatic ROAS calculation.
- **Inventory** — product list with SKU, current stock, automatic stock-level
  classification (Critical / Low / Healthy / Overstock), live-on-channel flags
  for TikTok / Shopify / Other store, and remarks.
- **Customer Experience** — positive/negative reviews, rating, complaint
  category (Product / Customer Service / Shop / Delivery / Other), status, and
  internal remarks.
- **Date filtering** — global From/To date pickers with Daily / Weekly /
  Monthly grain that drive all KPIs and charts.
- **Add / Edit / Delete** — every section has full CRUD via modal forms so you
  can manually paste data from Shopify and TikTok exports.
- **Export / Import** — back up or share the entire dataset as JSON.
- **Light / Dark themes**.

## Data

All data is stored in browser `localStorage` under the key
`tgp_dashboard_data_v1`. A small sample dataset is seeded on first load so you
can see the dashboard populated immediately — replace it with real entries via
the **+ Add** buttons or by importing a JSON file.
