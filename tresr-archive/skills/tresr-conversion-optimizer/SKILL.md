---
name: tresr-conversion-optimizer
description: Full funnel audit and optimization for TRESR Shopify store. Checks PayPal, shipping, product pages, trust signals, and calculates ROAS bottleneck (CPC vs CR vs AOV). Based on Shopify print on demand brand research conversion framework.
---

# Conversion Optimizer

## The Conversion Formula

```
ROAS = (Conversion Rate × AOV) / CPC
```

**Current TRESR numbers** (Feb 2026):
- CPC: $0.15 (EXCELLENT — ads are working)
- CR: ~0% (BROKEN — this is the problem)
- AOV: $35 (estimated from 2 orders)

**Target**: CR 2.5%, AOV $45, CPC $0.50 → ROAS = 2.25 (profitable)

## Step 1: Shopify Store Audit via API

### Check Payment Gateways (Is PayPal enabled?)

PayPal = 50% of checkouts. If it's not enabled, you're losing half your sales.

```bash
export SHOP="becc05-b4.myshopify.com"
export TOKEN=$(grep SHOPIFY_ACCESS_TOKEN .env | head -1 | cut -d= -f2)

# Check payment gateways — NOTE: Shopify Admin API doesn't expose payment settings directly.
# Must check via: Settings → Payments in Shopify Admin
# Bot action: Tell Jon to verify PayPal is enabled at:
# https://admin.shopify.com/store/becc05-b4/settings/payments

# Check if PayPal is mentioned in checkout settings
curl -s -H "X-Shopify-Access-Token: $TOKEN" \
  "https://$SHOP/admin/api/2024-01/shop.json" | python3 -c "
import sys, json
shop = json.load(sys.stdin)['shop']
print('Shop:', shop['name'])
print('Currency:', shop['currency'])
print('Plan:', shop['plan_name'])
print('Checkout URL:', shop['myshopify_domain'])
"
```

**⚠️ Manual check needed**: Jon must verify PayPal is active at Shopify Admin → Settings → Payments.

### Check Shipping Rates & Free Shipping Threshold

```bash
# Get shipping zones
curl -s -H "X-Shopify-Access-Token: $TOKEN" \
  "https://$SHOP/admin/api/2024-01/shipping_zones.json" | python3 -c "
import sys, json
zones = json.load(sys.stdin)['shipping_zones']
for zone in zones:
    print(f'Zone: {zone[\"name\"]}')
    for rate in zone.get('price_based_shipping_rates', []):
        print(f'  Rate: {rate[\"name\"]} - \${rate[\"price\"]} (min: \${rate.get(\"min_order_subtotal\", \"0\")})')
    for rate in zone.get('weight_based_shipping_rates', []):
        print(f'  Weight rate: {rate[\"name\"]} - \${rate[\"price\"]}')
"
```

**Target**: Free shipping at $75 threshold. This pushes AOV up (people add a second shirt to hit free shipping).

**If missing, Jon needs to set up**:
1. Shopify Admin → Settings → Shipping → Edit rate
2. Add rate: "Free Shipping" — $0, minimum order $75
3. Keep standard rate for orders under $75

### Audit ALL Products for Conversion Elements

```python
import requests, os, json

SHOP = "becc05-b4.myshopify.com"
TOKEN = os.environ.get('SHOPIFY_ACCESS_TOKEN', 'REDACTED_SHOPIFY_TOKEN=REDACTED')
HEADERS = {'X-Shopify-Access-Token': TOKEN}

def audit_all_products():
    """Check every product for conversion-critical elements."""
    issues = []
    page_url = f'https://{SHOP}/admin/api/2024-01/products.json?limit=250&status=active'
    
    while page_url:
        resp = requests.get(page_url, headers=HEADERS)
        products = resp.json().get('products', [])
        
        for p in products:
            pid = p['id']
            handle = p['handle']
            product_issues = []
            
            # 1. Check compare-at price
            has_compare = any(
                v.get('compare_at_price') and float(v['compare_at_price']) > float(v['price'])
                for v in p['variants']
            )
            if not has_compare:
                product_issues.append('❌ No compare-at price (no discount shown)')
            
            # 2. Check body HTML quality
            body = p.get('body_html', '') or ''
            if len(body) < 50:
                product_issues.append(f'❌ Body HTML too short ({len(body)} chars)')
            if '<p>' not in body and '<div>' not in body:
                product_issues.append('⚠️ Body HTML has no structure (no <p> tags)')
            
            # 3. Check images
            images = p.get('images', [])
            if len(images) < 2:
                product_issues.append(f'⚠️ Only {len(images)} image(s) — need 2+ (front + lifestyle)')
            
            # 4. Check alt text on images
            missing_alt = [img for img in images if not img.get('alt')]
            if missing_alt:
                product_issues.append(f'⚠️ {len(missing_alt)} image(s) missing alt text')
            
            # 5. Check meta description
            # Need to fetch metafields separately
            meta_resp = requests.get(
                f'https://{SHOP}/admin/api/2024-01/products/{pid}/metafields.json',
                headers=HEADERS
            )
            metafields = meta_resp.json().get('metafields', [])
            has_meta_desc = any(
                m['namespace'] == 'global' and m['key'] == 'description_tag'
                for m in metafields
            )
            if not has_meta_desc:
                product_issues.append('❌ Missing meta description (SEO dead)')
            
            # 6. Check tags
            tags = p.get('tags', '')
            if 'ai-designed' not in tags:
                product_issues.append('⚠️ Missing ai-designed tag')
            
            if product_issues:
                issues.append({
                    'product': p['title'],
                    'handle': handle,
                    'id': pid,
                    'issues': product_issues
                })
        
        # Pagination
        link = resp.headers.get('Link', '')
        if 'rel="next"' in link:
            page_url = link.split('<')[1].split('>')[0]
        else:
            page_url = None
    
    return issues

# Run audit
issues = audit_all_products()
print(f"
{'='*60}")
print(f"PRODUCT AUDIT: {len(issues)} products with issues")
print(f"{'='*60}
")
for item in issues:
    print(f"
📦 {item['product']} (ID: {item['id']})")
    for issue in item['issues']:
        print(f"   {issue}")
```

## Step 2: GA4 Funnel Metrics

```bash
# IMPORTANT: Use node+dotenv to load .env (shell export/source mangles keys with special chars)
TOKEN=$(node -e "require('dotenv').config({override:true}); const https=require('https'); const data='client_id='+process.env.GOOGLE_CLIENT_ID+'&client_secret='+process.env.GOOGLE_CLIENT_SECRET+'&refresh_token='+process.env.GOOGLE_OAUTH_REFRESH_TOKEN+'&grant_type=refresh_token'; const req=https.request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'}},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log(JSON.parse(d).access_token))}); req.write(data); req.end();" 2>/dev/null)

# Funnel: Sessions → Add to Cart → Begin Checkout → Purchase
curl -s -X POST "https://analyticsdata.googleapis.com/v1beta/properties/377300744:runReport" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{
    "dateRanges":[{"startDate":"7daysAgo","endDate":"yesterday"}],
    "metrics":[
      {"name":"sessions"},
      {"name":"addToCarts"},
      {"name":"checkouts"},
      {"name":"ecommercePurchases"},
      {"name":"purchaseRevenue"},
      {"name":"averagePurchaseRevenue"}
    ]
  }'
```

### Calculate Funnel Rates

```python
# From GA4 response
sessions = 800      # example
add_to_carts = 12   # example
checkouts = 4       # example
purchases = 1       # example
revenue = 35.00     # example

atc_rate = (add_to_carts / sessions) * 100  # Target: 3-5%
checkout_rate = (checkouts / add_to_carts) * 100 if add_to_carts else 0  # Target: 30-50%
purchase_rate = (purchases / checkouts) * 100 if checkouts else 0  # Target: 50-70%
overall_cr = (purchases / sessions) * 100  # Target: 2-3%
aov = revenue / purchases if purchases else 0

print(f"Sessions: {sessions}")
print(f"Add to Cart: {add_to_carts} ({atc_rate:.1f}%)")
print(f"Checkout: {checkouts} ({checkout_rate:.1f}% of ATC)")
print(f"Purchase: {purchases} ({purchase_rate:.1f}% of checkout)")
print(f"Overall CR: {overall_cr:.2f}%")
print(f"AOV: ${aov:.2f}")
```

## Step 3: Identify the Bottleneck

```python
def identify_bottleneck(cpc, cr, aov, ad_spend):
    """Determine which metric is the constraint and recommend fix."""
    roas = (cr * aov) / cpc if cpc > 0 else 0
    
    print(f"
{'='*40}")
    print(f"ROAS ANALYSIS")
    print(f"{'='*40}")
    print(f"CPC: ${cpc:.2f}")
    print(f"CR: {cr*100:.2f}%")
    print(f"AOV: ${aov:.2f}")
    print(f"ROAS: {roas:.2f}x")
    print(f"Daily spend: ${ad_spend:.2f}")
    print(f"Daily revenue: ${ad_spend * roas:.2f}")
    
    # Identify constraint
    if cr < 0.01:  # Less than 1% CR
        print(f"
🚨 BOTTLENECK: Conversion Rate ({cr*100:.2f}%)")
        print("FIX: Product pages (trust signals, mockups, PayPal, reviews)")
        print("  → Enable PayPal")
        print("  → Add lifestyle mockups (see tresr-lifestyle-mockup-generator)")
        print("  → Install Judge.me reviews")
        print("  → Add size chart (Kiwi $6/mo)")
        print("  → Set free shipping at $75")
    elif aov < 35:
        print(f"
⚠️ BOTTLENECK: AOV (${aov:.2f})")
        print("FIX: Pricing & upsells")
        print("  → Free shipping threshold at $75 (pushes multi-item)")
        print("  → Related products / frequently bought together")
        print("  → Bundle offers")
    elif cpc > 1.00:
        print(f"
⚠️ BOTTLENECK: CPC (${cpc:.2f})")
        print("FIX: Ad creative quality")
        print("  → Better lifestyle mockups")
        print("  → Test new ad copy")
        print("  → Narrow targeting")
    else:
        print(f"
✅ All metrics healthy — SCALE!")
        print(f"  → Increase budget 20% and monitor")

# Current TRESR state
identify_bottleneck(cpc=0.15, cr=0.00, aov=35.00, ad_spend=25.00)
```

## Step 4: Trust Signals Checklist

| Signal | Status | Action | Who |
|--------|--------|--------|-----|
| **PayPal** | ❓ Unknown | Verify enabled in Shopify Settings | **Jon (manual)** |
| **Reviews (Judge.me)** | ❌ Not installed | Install free tier from Shopify App Store | **Jon (manual)** |
| **Size Chart (Kiwi)** | ❌ Not installed | Install Kiwi Size Chart ($6/mo) | **Jon (manual)** |
| **Free Shipping at $75** | ❌ Not set | Create shipping rate in Shopify Settings | **Jon (manual)** |
| **Compare-at Prices** | ✅ Set ($42.50) | Verify on all products | **Bot (audit above)** |
| **Shipping/Returns Info** | ❌ Missing | Add collapsible rows to product template | **Bot (theme edit)** |
| **Twitter Social Proof** | ✅ Embedded | Already on site | N/A |
| **Product Descriptions** | ⚠️ Varies | Audit and improve thin descriptions | **Bot** |
| **Meta Descriptions** | ❌ 10 missing | Run SEO audit, add to all products | **Bot** |
| **Multiple Product Images** | ❌ Most have 1 | Add lifestyle mockups as 2nd image | **Bot** |

### What Jon Needs to Do Manually
1. **Enable PayPal** — Settings → Payments → PayPal → Connect
2. **Install Judge.me** — App Store → Judge.me → Free tier
3. **Install Kiwi Size Chart** — App Store → Kiwi → $6/mo
4. **Set free shipping at $75** — Settings → Shipping → Domestic → Add rate → Free, min $75

### What the Bot Can Automate
1. ✅ Audit all products for missing elements
2. ✅ Add meta descriptions to products missing them
3. ✅ Update product body HTML with better descriptions
4. ✅ Add image alt text
5. ✅ Generate and upload lifestyle mockups
6. ✅ Add collapsible shipping/returns section to theme

## Step 5: Product Page Template Recommendations

### Ideal Product Page Structure
```
[Lifestyle mockup — primary image]
[Flat garment mockups — secondary images (black, navy, white)]
[Product title with keyword]
[Price: $29.00  ~~$42.50~~  (32% off)]
[Color selector — PILLS not dropdown]
[Size selector — PILLS not dropdown]
[Add to Cart button — large, prominent]
[Collapsible: Shipping & Returns]
[Collapsible: Size Guide]
[Collapsible: Product Details (material, care)]
[Reviews section (Judge.me)]
[Related Products]
```

### Add Collapsible Rows via Theme

Edit product template JSON or add to theme's product section:

```bash
# Check current product template
curl -s -H "X-Shopify-Access-Token: $TOKEN" \
  "https://$SHOP/admin/api/2024-01/themes/179374358813/assets.json?asset[key]=templates/product.json" \
  | python3 -m json.tool
```

## Step 6: Ongoing Monitoring

Run this weekly:

```
1. Pull GA4 funnel metrics (Step 2)
2. Calculate ROAS and identify bottleneck (Step 3)
3. Audit products for missing elements (Step 1)
4. Report findings in tresr-daily-scorecard
5. Track trust signal implementation progress
```

## Integration Points

- **tresr-daily-scorecard**: Reports funnel metrics and ROAS daily
- **tresr-lifestyle-mockup-generator**: Fixes the mockup quality issue
- **tresr-meta-ads-testing**: Provides CPC data for ROAS calculation
- **tresr-seo-compact-keywords**: Fixes meta descriptions and product page SEO

## MANDATORY: Visual Verification

After ANY live site change (theme CSS, product images, page content), visually verify with `browser(action="screenshot", targetUrl="<affected_url>", target="host")` before confirming to Jon. NEVER say changes are working without seeing them yourself. If browser is unavailable, say "pushed but unable to visually verify, please check."
