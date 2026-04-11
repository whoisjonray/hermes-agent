---
name: tresr-email-marketing
description: Set up and manage email marketing flows for TRESR. Klaviyo free tier for Welcome, Abandoned Cart, and Browse Abandonment flows. Fallback to Resend API + Shopify webhooks. Email should drive 20-30% of revenue.
---

# Email Marketing

## Strategy

Email captures visitors who don't buy immediately and brings them back. Target: 20-30% of total revenue from email.

**Critical flow priority**: Abandoned Cart > Welcome > Browse Abandonment > Campaigns

## Option A: Klaviyo (Recommended — Free Tier)

**Free tier**: 250 contacts, 500 emails/month — $0 to start. Perfect for current traffic levels.

### Setup Steps (Jon Manual)

1. **Install Klaviyo** from Shopify App Store (free)
2. Klaviyo auto-syncs with Shopify (products, customers, orders)
3. Set up email domain authentication (tresr.com SPF/DKIM)
4. Create flows (below)
5. Create popup form (below)

### Flow 1: Welcome Series (3 emails)

**Trigger**: New subscriber (popup or checkout opt-in)

| Email | Delay | Subject | Content |
|-------|-------|---------|---------|
| 1 | Immediate | "Welcome to TRESR — here's 15% off 🤖" | Introduce AI story, WELCOME15 code, shop CTA |
| 2 | Day 2 | "How an AI runs a t-shirt store" | Behind-the-scenes story, bestsellers, social proof |
| 3 | Day 4 | "Your 15% off expires tomorrow" | Urgency, curated picks, final CTA |

**Discount**: Use existing `WELCOME15` discount code.

### Flow 2: Abandoned Cart (3 emails) — MOST CRITICAL

**Trigger**: Cart abandoned (Klaviyo auto-detects from Shopify)

| Email | Delay | Subject | Content |
|-------|-------|---------|---------|
| 1 | 1 hour | "You left something behind 🛒" | Cart contents, product images, simple "Complete your order" CTA |
| 2 | 24 hours | "Still thinking about it?" | Cart contents + social proof (community size, AI story), free shipping reminder if applicable |
| 3 | 48 hours | "Last chance — here's 10% off" | Cart contents + 10% discount code (COMEBACK10), urgency |

**Key**: Email 1 = no discount (many people just forgot). Email 3 = discount to push fence-sitters.

### Flow 3: Browse Abandonment (2 emails)

**Trigger**: Viewed product page but didn't add to cart

| Email | Delay | Subject | Content |
|-------|-------|---------|---------|
| 1 | 4 hours | "Still looking at [Product Name]?" | Product image, quick description, CTA |
| 2 | 2 days | "This one's been popular" | Social proof angle, related products |

### Campaign Calendar (2-3/week)

| Day | Type | Content |
|-----|------|---------|
| Tuesday | New Drop | Feature newest designs |
| Thursday | Story/Behind-scenes | AI running the store update, struggles, wins |
| Saturday | Sale/Social | Bestsellers, community highlights, limited offers |

### Email Popup (10% off)

Configure in Klaviyo:
- **Trigger**: After 5 seconds on site OR exit intent
- **Offer**: "Get 10% off your first order"
- **Form**: Email only (no name needed)
- **Design**: Match TRESR brand (dark theme, robot mascot)
- **Frequency**: Show once per visitor, don't show to existing subscribers

## Option B: Resend API + Shopify Webhooks (Fallback)

If Klaviyo isn't feasible, build flows manually using Resend (already configured) + Shopify webhooks.

### Resend Configuration

Already set up:
- **API Key**: `RESEND_FULL_ACCESS_KEY` in `.env`
- **From**: `notabot@tresr.com`
- **Domain**: tresr.com verified on Resend

### Shopify Webhook Setup

```bash
export SHOP="becc05-b4.myshopify.com"
export TOKEN=$(grep SHOPIFY_ACCESS_TOKEN .env | head -1 | cut -d= -f2)

# Create webhook for abandoned checkouts
curl -s -X POST "https://$SHOP/admin/api/2024-01/webhooks.json" \
  -H "X-Shopify-Access-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "topic": "checkouts/create",
      "address": "https://vibes.tresr.com/webhooks/checkout-created",
      "format": "json"
    }
  }'

# Webhook for new customers (welcome flow)
curl -s -X POST "https://$SHOP/admin/api/2024-01/webhooks.json" \
  -H "X-Shopify-Access-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "webhook": {
      "topic": "customers/create",
      "address": "https://vibes.tresr.com/webhooks/customer-created",
      "format": "json"
    }
  }'
```

**Note**: vibes.tresr.com (Railway) is currently down. Webhooks need a running server to receive them. Alternative: poll Shopify API for abandoned checkouts on a cron.

### Abandoned Cart via Polling + Resend

```python
import requests, os, json, time
from datetime import datetime, timedelta

SHOP = "becc05-b4.myshopify.com"
SHOPIFY_TOKEN = os.environ.get('SHOPIFY_ACCESS_TOKEN')
RESEND_KEY = os.environ.get('RESEND_FULL_ACCESS_KEY')

def check_abandoned_carts():
    """Poll Shopify for abandoned checkouts and send recovery emails."""
    
    # Get checkouts from last 24h
    since = (datetime.utcnow() - timedelta(hours=24)).isoformat() + 'Z'
    resp = requests.get(
        f'https://{SHOP}/admin/api/2024-01/checkouts.json',
        headers={'X-Shopify-Access-Token': SHOPIFY_TOKEN},
        params={'created_at_min': since, 'limit': 50}
    )
    checkouts = resp.json().get('checkouts', [])
    
    for checkout in checkouts:
        email = checkout.get('email')
        if not email:
            continue
        
        # Check if checkout was completed (has order)
        if checkout.get('completed_at'):
            continue
        
        # Check age of checkout
        created = datetime.fromisoformat(checkout['created_at'].replace('Z', '+00:00'))
        age_hours = (datetime.utcnow().replace(tzinfo=created.tzinfo) - created).total_seconds() / 3600
        
        # Send email based on timing
        if 1 <= age_hours < 2:
            send_cart_email(email, checkout, template='reminder_1')
        elif 23 <= age_hours < 25:
            send_cart_email(email, checkout, template='reminder_2')
        elif 47 <= age_hours < 49:
            send_cart_email(email, checkout, template='reminder_3_discount')

def send_cart_email(email, checkout, template):
    """Send abandoned cart recovery email via Resend."""
    
    items = checkout.get('line_items', [])
    item_html = ''
    for item in items:
        item_html += f'''
        <tr>
            <td style="padding:8px">{item["title"]}</td>
            <td style="padding:8px">{item.get("variant_title","")}</td>
            <td style="padding:8px">${item["price"]}</td>
        </tr>'''
    
    subjects = {
        'reminder_1': 'You left something behind 🛒',
        'reminder_2': 'Still thinking about it?',
        'reminder_3_discount': 'Last chance — here\'s 10% off'
    }
    
    discount_block = ''
    if template == 'reminder_3_discount':
        discount_block = '<p style="font-size:20px;text-align:center;background:#222;color:#00ff88;padding:15px;border-radius:8px">Use code <strong>COMEBACK10</strong> for 10% off</p>'
    
    html = f'''
    <div style="max-width:600px;margin:0 auto;font-family:sans-serif;color:#333">
        <h1 style="color:#000">Hey there 👋</h1>
        <p>Looks like you left some great picks in your cart:</p>
        <table style="width:100%;border-collapse:collapse">
            <tr style="background:#f5f5f5"><th style="padding:8px;text-align:left">Product</th><th style="padding:8px">Variant</th><th style="padding:8px">Price</th></tr>
            {item_html}
        </table>
        {discount_block}
        <p style="text-align:center;margin:20px 0">
            <a href="{checkout.get('abandoned_checkout_url', 'https://tresr.com')}" 
               style="background:#000;color:#fff;padding:12px 30px;text-decoration:none;border-radius:4px;font-size:16px">
                Complete Your Order
            </a>
        </p>
        <p style="color:#999;font-size:12px">TRESR — AI-designed tees for humans who get it.</p>
    </div>'''
    
    requests.post(
        'https://api.resend.com/emails',
        headers={'Authorization': f'Bearer {RESEND_KEY}', 'Content-Type': 'application/json'},
        json={
            'from': 'TRESR <notabot@tresr.com>',
            'to': [email],
            'subject': subjects[template],
            'html': html
        }
    )
    print(f"Sent {template} to {email}")
```

### Welcome Email via Resend (Already Partially Built)

The welcome email with WELCOME15 already exists. Extend to 3-email series using the same polling/cron pattern.

## Discount Code Setup

### COMEBACK10 (Abandoned Cart)

```bash
# Create discount code for cart recovery
curl -s -X POST "https://$SHOP/admin/api/2024-01/price_rules.json" \
  -H "X-Shopify-Access-Token: $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "price_rule": {
      "title": "COMEBACK10",
      "target_type": "line_item",
      "target_selection": "all",
      "allocation_method": "across",
      "value_type": "percentage",
      "value": "-10.0",
      "customer_selection": "all",
      "usage_limit": null,
      "once_per_customer": true,
      "starts_at": "2026-02-11T00:00:00-06:00"
    }
  }'
# Then create the discount code for that price rule
```

## Tracking Email Revenue

Once email flows are active, track in tresr-daily-scorecard:

```bash
# Shopify orders with discount code = email attribution
curl -s -H "X-Shopify-Access-Token: $TOKEN" \
  "https://$SHOP/admin/api/2024-01/orders.json?status=any&created_at_min=YESTERDAY" \
  | python3 -c "
import sys, json
orders = json.load(sys.stdin)['orders']
email_revenue = sum(
    float(o['total_price']) 
    for o in orders 
    if any(d['code'] in ['WELCOME15','COMEBACK10'] for d in o.get('discount_codes', []))
)
total_revenue = sum(float(o['total_price']) for o in orders)
pct = (email_revenue/total_revenue*100) if total_revenue else 0
print(f'Email revenue: \${email_revenue:.2f} ({pct:.0f}% of total)')
"
```

## Integration Points

- **tresr-daily-scorecard**: Report email revenue %, subscriber count, flow performance
- **tresr-conversion-optimizer**: Email captures the abandoned cart traffic that conversion issues cause
- **tresr-design-to-shopify**: New product drops feed into Tuesday campaign emails
