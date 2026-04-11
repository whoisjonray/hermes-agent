---
name: tresr-daily-scorecard
description: Generate TRESR daily performance scorecard using GA4, Search Console, Meta Ads, and Shopify APIs. Use for morning briefs, evening reports, or when asked about store performance metrics.
---

# Daily Scorecard

## Data Sources (ALL required — never score with partial data)

### 1. Google Analytics (GA4)
Property: `377300744`

**⚠️ CRITICAL: .env variable names**
- `.env` has `GOOGLE_OAUTH_REFRESH_TOKEN` (NOT `GOOGLE_REFRESH_TOKEN`)
- `.env` has `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET` (NOT `GOOGLE_OAUTH_CLIENT_ID`)
- Also aliased as `GOOGLE_REFRESH_TOKEN` for script compatibility
- Google refresh tokens do NOT expire unless revoked — if you get 401, check the variable name first

Get OAuth token:
```bash
# IMPORTANT: Use node+dotenv to load .env (shell export/source mangles keys with special chars)
TOKEN=$(node -e "require('dotenv').config({override:true}); const https=require('https'); const data='client_id='+process.env.GOOGLE_CLIENT_ID+'&client_secret='+process.env.GOOGLE_CLIENT_SECRET+'&refresh_token='+process.env.GOOGLE_OAUTH_REFRESH_TOKEN+'&grant_type=refresh_token'; const req=https.request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'}},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log(JSON.parse(d).access_token))}); req.write(data); req.end();" 2>/dev/null)
```

Query (yesterday):
```bash
curl -s -X POST "https://analyticsdata.googleapis.com/v1beta/properties/377300744:runReport" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"dateRanges":[{"startDate":"yesterday","endDate":"yesterday"}],
       "metrics":[{"name":"activeUsers"},{"name":"sessions"},{"name":"bounceRate"},
                  {"name":"conversions"},{"name":"averageSessionDuration"}],
       "dimensions":[{"name":"sessionDefaultChannelGroup"}]}'
```

### 2. Search Console
```bash
curl -s -X POST "https://searchconsole.googleapis.com/webmasters/v3/sites/sc-domain%3Atresr.com/searchAnalytics/query" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"startDate":"YYYY-MM-DD","endDate":"YYYY-MM-DD","dimensions":["query"],"rowLimit":10}'
```

### 3. Meta Ads
```bash
curl -s "https://graph.facebook.com/v19.0/act_431799842093236/insights?fields=spend,clicks,impressions,ctr,cpc,actions&date_preset=yesterday&access_token=$FACEBOOK_ACCESS_TOKEN"
```

### 4. Shopify Orders
```bash
curl -s -H "X-Shopify-Access-Token: $SHOPIFY_ACCESS_TOKEN" \
  "https://becc05-b4.myshopify.com/admin/api/2024-01/orders.json?status=any&created_at_min=YYYY-MM-DDT00:00:00-06:00&created_at_max=YYYY-MM-DDT23:59:59-06:00"
```

### 5. Shopify Abandoned Checkouts
```bash
curl -s -H "X-Shopify-Access-Token: $SHOPIFY_ACCESS_TOKEN" \
  "https://becc05-b4.myshopify.com/admin/api/2024-01/checkouts.json?limit=50"
```

### 6. GA4 Funnel Metrics (Add to Cart → Checkout → Purchase)
```bash
curl -s -X POST "https://analyticsdata.googleapis.com/v1beta/properties/377300744:runReport" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"dateRanges":[{"startDate":"yesterday","endDate":"yesterday"}],
       "metrics":[{"name":"sessions"},{"name":"addToCarts"},{"name":"checkouts"},
                  {"name":"ecommercePurchases"},{"name":"purchaseRevenue"},
                  {"name":"averagePurchaseRevenue"}]}'
```

### 7. Meta Ads — CPC by Product/Ad
```bash
curl -s "https://graph.facebook.com/v19.0/act_431799842093236/insights?fields=ad_name,spend,clicks,cpc,ctr,actions&level=ad&date_preset=yesterday&access_token=$FACEBOOK_ACCESS_TOKEN"
```

### 8. AOV Calculation
```python
# From Shopify orders
aov = total_revenue / order_count if order_count > 0 else 0
```

### 9. ROAS Calculation
```python
# ROAS = Revenue / Ad Spend
roas = shopify_revenue / meta_spend if meta_spend > 0 else 0
# Also: theoretical ROAS = (CR × AOV) / CPC
```

### 10. Constraint Identification
```python
def identify_constraint(cpc, cr, aov):
    if cr < 0.01:
        return "🚨 BOTTLENECK: Conversion Rate — fix product pages, mockups, trust signals"
    elif aov < 35:
        return "⚠️ BOTTLENECK: AOV — add free shipping threshold, bundles, upsells"
    elif cpc > 1.00:
        return "⚠️ BOTTLENECK: CPC — improve ad creative, mockups, targeting"
    else:
        return "✅ All metrics healthy — SCALE"
```

### 11. Designs Created Today
```bash
# Count products created today
curl -s -H "X-Shopify-Access-Token: $SHOPIFY_ACCESS_TOKEN" \
  "https://becc05-b4.myshopify.com/admin/api/2024-01/products/count.json?created_at_min=$(date +%Y-%m-%d)T00:00:00-06:00"
```

## Grading Scale
| Grade | Score | Criteria |
|-------|-------|----------|
| A | 90-100 | Orders + traffic up + SEO growing |
| B | 70-89 | Traffic healthy, some conversions |
| C | 50-69 | Traffic okay, no conversions |
| D | 30-49 | Low traffic or high bounce |
| F | 0-29 | Multiple metrics failing |

## Grading Weights (Conversion-First)

| Category | Weight | Metrics |
|----------|--------|---------|
| Conversion | 35% | Orders, CR, funnel rates |
| Revenue & ROAS | 25% | Revenue, AOV, ROAS |
| Traffic | 15% | Sessions, users |
| SEO | 15% | Clicks, impressions, rankings |
| Design Velocity | 10% | New designs created today |

## Scorecard Format
```
📊 TRESR Daily Scorecard — [Date]
Grade: [X] ([score]/100)

👥 Traffic: [users] users, [sessions] sessions
📉 Bounce: [rate]%
💰 Revenue: $[amount] ([orders] orders) | AOV: $[aov]
🔄 ROAS: [roas]x ($[revenue] rev / $[spend] spend)
🛒 Funnel: [sessions] → [atc] ATC ([atc_rate]%) → [checkout] Checkout → [purchases] Purchase ([cr]% CR)
📢 Meta Ads: $[spend] spent, [clicks] clicks, [ctr]% CTR, $[cpc] CPC
📢 Top CPC: [product1] $[cpc1], [product2] $[cpc2], [product3] $[cpc3]
🔍 SEO: [clicks] clicks, [impressions] impressions, pos [avg]
🎨 Designs: [count] new today
⚠️ Constraint: [bottleneck identification]
🐦 Twitter: [engagement summary]
```

## Delivery
- Email to whoisjonray@gmail.com via Resend (from: notabot@tresr.com)
- Post summary to Discord announcements if grade changes significantly
- Update MEMORY.md with scorecard results
- If revenue changed, run `node scripts/update-revenue-everywhere.js [revenue] [price]` to update homepage + Twitter bio
- If revenue changed, also update ad copy revenue number when it hits milestones ($100, $250, $500, etc.)

## CRITICAL RULE
If ANY data source returns an error or is unavailable, **STOP and report which API is broken**. Never estimate or use partial data. A wrong scorecard is worse than no scorecard.
