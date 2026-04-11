---
name: tresr-product-scoring
description: Score community-approved products using Shopify sales + GA4 page views + add-to-carts + conversion rate, write scores to tresr.product_score metafield, then reorder all 10 category collections by score. Run daily at midnight to keep collections fresh.
---

# Product Scoring & Collection Reordering

## Overview

Scores every product in the community-approved collection using a weighted formula, persists the score as a `tresr.product_score` metafield, then reorders all 10 smart collections so the highest-scoring products appear first.

The metafield is the source of truth — if GA4 goes down, the last good scores still drive collection ordering everywhere.

## When to Run

- **Daily at midnight CT** (automated via cron/heartbeat)
- **After a big sales day** to immediately surface trending products
- **After adding new products** to community-approved collection

## Script Location

```
scripts/product-scoring/
  config.js               — Collection IDs, scoring weights
  score-and-reorder.js    — Main script
  google-oauth-setup.js   — Re-auth helper when GA4 token expires
```

**GitHub repo:** `whoisjonray/client-tresr` (main branch)

## Commands

```bash
# Full path from repo root
cd /path/to/client-tresr

# Score + reorder all collections (normal daily run)
node scripts/product-scoring/score-and-reorder.js

# Preview without changing anything
node scripts/product-scoring/score-and-reorder.js --dry-run

# Score and write metafields, skip reordering
node scripts/product-scoring/score-and-reorder.js --score-only

# Reorder from existing metafield scores (no GA4 needed)
node scripts/product-scoring/score-and-reorder.js --reorder-only

# Reorder a single collection
node scripts/product-scoring/score-and-reorder.js --reorder-only --collection developer
```

## Scoring Formula

```
score = (total_units_sold × 10)
      + (sales_last_30d × 5)
      + (sales_last_7d × 3)
      + (page_views_30d × 0.1)
      + (add_to_carts_30d × 2)
      + (conversion_rate × 50)
```

Tie-breaker: newest product first (by created_at).
Products with zero data land at bottom, sorted newest-first.

## Data Sources

1. **Sales** — Shopify Orders API (GraphQL, paginated, all-time + 30d + 7d)
2. **Page views** — GA4 Data API, `/products/*` paths, last 30 days
3. **Add-to-carts** — GA4 Data API, `add_to_cart` events, last 30 days

## Collections Reordered

| Handle | ID |
|--------|-----|
| community-approved | 651916443933 |
| developer | 651916968221 |
| coffee-lovers | 651916771613 |
| meme-humor | 651916738845 |
| entrepreneur | 651917000989 |
| 80s-90s-nostalgia | 651916837149 |
| cat-lovers | 651916706077 |
| dog-lovers | 651916935453 |
| crypto-web3 | 651916869917 |
| openclaw | 651937022237 |

## Required Environment Variables

```env
# Shopify (already in .env)
SHOPIFY_STORE_DOMAIN=becc05-b4.myshopify.com
SHOPIFY_API_ACCESS_TOKEN=shpat_...

# Google OAuth for GA4 (already in .env)
GOOGLE_OAUTH_CLIENT_ID=856569879725-...
GOOGLE_OAUTH_CLIENT_SECRET=GOCSPX-...
GOOGLE_OAUTH_REFRESH_TOKEN=1//0f7Cy39cbiq...
GA4_PROPERTY_ID=377300744
```

## Dependencies

Uses packages already in client-tresr `package.json`:
- `dotenv`
- `@shopify/admin-api-client`
- Node.js built-in `https` module

## GA4 Token Expiry

The Google OAuth refresh token can expire every 7 days while the project is in "Testing" mode. If GA4 fails, the script gracefully degrades and scores using Shopify sales data only. To re-auth:

```bash
node scripts/product-scoring/google-oauth-setup.js
# Opens auth URL, get code, then:
node scripts/product-scoring/google-oauth-setup.js --code=YOUR_CODE
# Add new refresh token to .env
```

## Rollback

To revert any collection to default Shopify sorting:
- Set `sort_order` back to `best-selling` in Shopify Admin > Collections

## Cron Setup (for TRESR bot)

Add to daily heartbeat or cron — run once per day at midnight CT:

```bash
cd /path/to/client-tresr && node scripts/product-scoring/score-and-reorder.js >> scripts/product-scoring/cron.log 2>&1
```

If running on Railway or a server without the repo, clone it first:
```bash
git clone https://github.com/whoisjonray/client-tresr.git /tmp/client-tresr
cd /tmp/client-tresr && npm install
# Copy .env with required vars, then run the script
```
