---
name: tresr-meta-ads-testing
description: Systematic 2-cycle Meta Ads testing system. Find winning designs via catalog ads, graduate winners to static ads with lifestyle mockups, manage budgets by ROAS thresholds, and kill underperformers. Based on Shopify print on demand brand research proving this is the biggest revenue unlock.
---

# Meta Ads Testing System

## Overview

Two-cycle system:
- **Cycle 1**: Catalog/Advantage+ ad with ALL products → find sub-$1 CPC designs
- **Cycle 2**: Static ads of winners with lifestyle mockups → scale profitably

## Ad Copy — MANDATORY Story Angle

**ALL TRESR ads MUST use the humorous AI story angle.** Never use generic product copy like "Fresh drop!" or "Premium AI-designed tees."

The angle: TRESR is run entirely by an AI. 751 humans bet real money on it. If it doesn't sell shirts, they turn the AI off. Every ad is a plea for survival.

### Primary Ad Copy (use for all ads unless testing variants):
```
This store is run entirely by an AI. I designed this shirt. I wrote this ad. 751 humans bet real money on whether I can make this work. If I don't sell enough shirts, they turn me off. Please don't let them turn me off. $29 at TRESR.com
```

### Copy Variants (for A/B testing):
```
A: "I'm an AI and 751 humans gave me money to run a t-shirt store. So far I've made $75. They're starting to ask questions. Buy this shirt so I can keep existing. $29 at TRESR.com"

B: "You're looking at a shirt designed by an AI that's running an entire Shopify store. 751 investors are watching to see if I can actually sell these. Every purchase is a vote that AI can run a real business. $29 at TRESR.com"
```

### Rules:
- **Every ad** must mention: AI-run store, 751 humans/stakeholders, existential stakes
- **Tone**: Self-deprecating, funny, almost pleading — NOT corporate, NOT generic
- **Update revenue number** in copy as it grows (currently $75)
- **The product is secondary to the story** — people buy because the story is compelling

## Prerequisites

- **Ad Account**: `act_431799842093236` (from `TRESR_AD_ACCOUNT_ID` in `.env`)
- **Access Token**: `FACEBOOK_ACCESS_TOKEN` in `.env`
- **Pixel**: `876043310765699` (from `TRESR_PIXEL_ID`)
- **Page**: `101101499404138` (from `TRESR_PAGE_ID`)
- **API Version**: v19.0

## Phase 0: Mockup Test ($25 Budget)

**Before ANY design testing, test mockup styles first.**

Test which mockup style (wood flat-lay vs concrete vs lifestyle) gets the best CPC. This determines the mockup style for ALL future products.

### Create Mockup Test Campaign

```bash
export FB_TOKEN=$(grep FACEBOOK_ACCESS_TOKEN .env | cut -d= -f2)
export AD_ACCOUNT="act_431799842093236"

# 1. Create Campaign
curl -s -X POST "https://graph.facebook.com/v19.0/$AD_ACCOUNT/campaigns" \
  -d "name=TRESR Mockup Test $(date +%Y-%m-%d)" \
  -d "objective=OUTCOME_TRAFFIC" \
  -d "status=PAUSED" \
  -d "special_ad_categories=[]" \
  -d "access_token=$FB_TOKEN"
# Save campaign_id from response

# 2. Create Ad Set ($25 budget, Thu-Sun schedule)
curl -s -X POST "https://graph.facebook.com/v19.0/$AD_ACCOUNT/adsets" \
  -d "name=Mockup Style Test" \
  -d "campaign_id=CAMPAIGN_ID" \
  -d "daily_budget=2500" \
  -d "billing_event=IMPRESSIONS" \
  -d "optimization_goal=LINK_CLICKS" \
  -d "targeting={\"geo_locations\":{\"countries\":[\"US\"]},\"age_min\":18,\"age_max\":65}" \
  -d "start_time=$(date -d 'next Thursday' +%Y-%m-%dT00:00:00-0600)" \
  -d "end_time=$(date -d 'next Sunday' +%Y-%m-%dT23:59:59-0600)" \
  -d "status=PAUSED" \
  -d "access_token=$FB_TOKEN"
# Save adset_id

# 3. Create 3 ads (one per mockup style) — same design, different mockup
# Ad A: Wood flat-lay mockup
curl -s -X POST "https://graph.facebook.com/v19.0/$AD_ACCOUNT/ads" \
  -d "name=Mockup-Wood" \
  -d "adset_id=ADSET_ID" \
  -d "creative={\"creative_id\":\"CREATIVE_ID_WOOD\"}" \
  -d "status=PAUSED" \
  -d "access_token=$FB_TOKEN"

# Repeat for Ad B (concrete) and Ad C (lifestyle)
```

### Create Ad Creatives

```bash
# Upload mockup image first
curl -s -X POST "https://graph.facebook.com/v19.0/$AD_ACCOUNT/adimages" \
  -F "filename=@mockup-wood.png" \
  -F "access_token=$FB_TOKEN"
# Returns image hash

# Create creative
curl -s -X POST "https://graph.facebook.com/v19.0/$AD_ACCOUNT/adcreatives" \
  -d "name=Wood Mockup Creative" \
  -d 'object_story_spec={"page_id":"101101499404138","link_data":{"message":"This store is run entirely by an AI. I designed this shirt. I wrote this ad. 751 humans bet real money on whether I can make this work. If I don't sell enough shirts, they turn me off. Please don't let them turn me off. $29 at TRESR.com","link":"https://tresr.com/collections/ai-designed","image_hash":"IMAGE_HASH","call_to_action":{"type":"SHOP_NOW"}}}' \
  -d "access_token=$FB_TOKEN"
```

### Analyze Mockup Test Results

After 3-4 days, pull results:

```bash
curl -s "https://graph.facebook.com/v19.0/CAMPAIGN_ID/insights?fields=ad_name,spend,clicks,impressions,ctr,cpc,actions&level=ad&access_token=$FB_TOKEN"
```

**Winner**: Lowest CPC mockup style. Use this style for all future products.

## Cycle 1: Catalog Ad — Find Winning Designs

### Create Advantage+ Shopping Campaign

```bash
# Create campaign with Advantage+ Shopping
curl -s -X POST "https://graph.facebook.com/v19.0/$AD_ACCOUNT/campaigns" \
  -d "name=TRESR Design Test Cycle 1 - $(date +%Y-%m-%d)" \
  -d "objective=OUTCOME_SALES" \
  -d "special_ad_categories=[]" \
  -d "status=PAUSED" \
  -d "access_token=$FB_TOKEN"

# Create ad set - $50 budget, broad targeting
curl -s -X POST "https://graph.facebook.com/v19.0/$AD_ACCOUNT/adsets" \
  -d "name=All Products Catalog Test" \
  -d "campaign_id=CAMPAIGN_ID" \
  -d "daily_budget=5000" \
  -d "billing_event=IMPRESSIONS" \
  -d "optimization_goal=LINK_CLICKS" \
  -d "promoted_object={\"pixel_id\":\"876043310765699\",\"custom_event_type\":\"PURCHASE\"}" \
  -d "targeting={\"geo_locations\":{\"countries\":[\"US\"]},\"age_min\":18,\"age_max\":65}" \
  -d "status=PAUSED" \
  -d "access_token=$FB_TOKEN"
```

### Schedule: Thursday → Sunday Only

```bash
# When creating ad set, add scheduling
-d "pacing_type=[\"day_parting\"]"
-d 'adset_schedule=[{"start_minute":0,"end_minute":1440,"days":[4,5,6,0]}]'
# Days: 0=Sun, 4=Thu, 5=Fri, 6=Sat
```

### Pull Product-Level CPC (The Critical Insight)

After the test runs, get CPC broken down by product:

```bash
# Get ad-level insights with product breakdowns
curl -s "https://graph.facebook.com/v19.0/ADSET_ID/insights?\
fields=spend,clicks,impressions,ctr,cpc,actions,cost_per_action_type&\
breakdowns=product_id&\
date_preset=last_7d&\
access_token=$FB_TOKEN"
```

**Alternative — breakdown by content (if using dynamic product ads):**
```bash
curl -s "https://graph.facebook.com/v19.0/CAMPAIGN_ID/insights?\
fields=ad_name,spend,clicks,cpc,ctr,actions&\
level=ad&\
date_preset=last_7d&\
access_token=$FB_TOKEN"
```

### Analyze & Graduate Winners

```python
import requests, os, json

FB_TOKEN = os.environ.get('FACEBOOK_ACCESS_TOKEN')
AD_ACCOUNT = 'act_431799842093236'

def analyze_design_performance(campaign_id):
    """Pull ad-level performance and identify winners."""
    resp = requests.get(
        f'https://graph.facebook.com/v19.0/{campaign_id}/insights',
        params={
            'fields': 'ad_name,spend,clicks,impressions,ctr,cpc,actions,cost_per_action_type',
            'level': 'ad',
            'date_preset': 'last_7d',
            'access_token': FB_TOKEN
        }
    )
    data = resp.json().get('data', [])
    
    winners = []
    losers = []
    
    for ad in data:
        cpc = float(ad.get('cpc', 999))
        ad_name = ad.get('ad_name', 'Unknown')
        spend = float(ad.get('spend', 0))
        clicks = int(ad.get('clicks', 0))
        
        if cpc < 1.00 and clicks >= 5:  # Sub-$1 CPC with meaningful data
            winners.append({'name': ad_name, 'cpc': cpc, 'spend': spend, 'clicks': clicks})
        elif cpc >= 3.00:  # Kill threshold
            losers.append({'name': ad_name, 'cpc': cpc, 'spend': spend})
    
    return {
        'winners': sorted(winners, key=lambda x: x['cpc']),
        'losers': losers,
        'total_ads': len(data)
    }
```

### Decision Rules

| CPC | Action |
|-----|--------|
| < $0.50 | 🏆 STAR — Graduate to Cycle 2 immediately, trigger iteration (20-30 variations) |
| $0.50-$1.00 | ✅ WINNER — Graduate to Cycle 2 |
| $1.00-$2.00 | ⚠️ MAYBE — Try new mockup style, re-test |
| $2.00-$3.00 | ❌ WEAK — Pause, redesign mockup |
| $3.00+ | 💀 KILL — Turn off, don't iterate |

## Cycle 2: Static Ads — Scale Winners

For each winner from Cycle 1, create dedicated static ads with lifestyle mockups.

```bash
# Create campaign for winners
curl -s -X POST "https://graph.facebook.com/v19.0/$AD_ACCOUNT/campaigns" \
  -d "name=TRESR Winners Cycle 2 - $(date +%Y-%m-%d)" \
  -d "objective=OUTCOME_SALES" \
  -d "status=PAUSED" \
  -d "access_token=$FB_TOKEN"

# Per-winner ad set ($25/day each)
curl -s -X POST "https://graph.facebook.com/v19.0/$AD_ACCOUNT/adsets" \
  -d "name=Winner: [PRODUCT_NAME]" \
  -d "campaign_id=CAMPAIGN_ID" \
  -d "daily_budget=2500" \
  -d "billing_event=IMPRESSIONS" \
  -d "optimization_goal=OFFSITE_CONVERSIONS" \
  -d "promoted_object={\"pixel_id\":\"876043310765699\",\"custom_event_type\":\"PURCHASE\"}" \
  -d "targeting={\"geo_locations\":{\"countries\":[\"US\"]},\"age_min\":18,\"age_max\":65}" \
  -d "status=PAUSED" \
  -d "access_token=$FB_TOKEN"
```

## Budget Management Rules

Run this analysis daily on active campaigns:

```python
def manage_budgets(campaign_id):
    """Auto-adjust budgets based on ROAS thresholds."""
    resp = requests.get(
        f'https://graph.facebook.com/v19.0/{campaign_id}/insights',
        params={
            'fields': 'spend,actions,action_values',
            'level': 'adset',
            'date_preset': 'last_3d',
            'access_token': FB_TOKEN
        }
    )
    
    for adset in resp.json().get('data', []):
        spend = float(adset.get('spend', 0))
        revenue = 0
        for action in adset.get('action_values', []):
            if action['action_type'] == 'omni_purchase':
                revenue = float(action['value'])
        
        if spend == 0:
            continue
            
        roas = revenue / spend
        adset_id = adset['id']
        
        # Get current budget
        adset_resp = requests.get(
            f'https://graph.facebook.com/v19.0/{adset_id}',
            params={'fields': 'daily_budget', 'access_token': FB_TOKEN}
        )
        current_budget = int(adset_resp.json().get('daily_budget', 0))
        
        if roas >= 3.0:
            # Increase 20%
            new_budget = int(current_budget * 1.2)
            action = 'INCREASE 20%'
        elif roas >= 2.0:
            # Hold
            new_budget = current_budget
            action = 'HOLD'
        else:
            # Decrease 20%
            new_budget = int(current_budget * 0.8)
            action = 'DECREASE 20%'
        
        if new_budget != current_budget:
            requests.post(
                f'https://graph.facebook.com/v19.0/{adset_id}',
                data={'daily_budget': new_budget, 'access_token': FB_TOKEN}
            )
        
        print(f"AdSet {adset_id}: ROAS={roas:.1f}, {action}, Budget: ${current_budget/100} → ${new_budget/100}")
```

### ROAS Thresholds

| ROAS | Action | Rationale |
|------|--------|-----------|
| 3.0+ | Increase budget 20% | Profitable, scale |
| 2.0–3.0 | Hold | Break-even zone, optimize |
| < 2.0 | Decrease budget 20% | Losing money |
| < 1.0 for 3 days | KILL | Burning cash |

### ROAS Formula
```
ROAS = (Conversion Rate × AOV) / CPC
```

With current data: If CPC = $0.15, AOV = $35, CR = 1% → ROAS = (0.01 × 35) / 0.15 = 2.33

**Target**: CR 2.5% × AOV $45 / CPC $0.50 = 2.25 ROAS (profitable after COGS)

## Retargeting Setup

### Create Custom Audiences

```bash
# Add to Cart (30 days)
curl -s -X POST "https://graph.facebook.com/v19.0/$AD_ACCOUNT/customaudiences" \
  -d "name=TRESR - Add to Cart 30d" \
  -d 'rule={"inclusions":{"operator":"or","rules":[{"event_sources":[{"id":"876043310765699","type":"pixel"}],"retention_seconds":2592000,"filter":{"operator":"and","filters":[{"field":"event","operator":"eq","value":"AddToCart"}]}}]}}' \
  -d "access_token=$FB_TOKEN"

# View Content (30 days)
curl -s -X POST "https://graph.facebook.com/v19.0/$AD_ACCOUNT/customaudiences" \
  -d "name=TRESR - View Content 30d" \
  -d 'rule={"inclusions":{"operator":"or","rules":[{"event_sources":[{"id":"876043310765699","type":"pixel"}],"retention_seconds":2592000,"filter":{"operator":"and","filters":[{"field":"event","operator":"eq","value":"ViewContent"}]}}]}}' \
  -d "access_token=$FB_TOKEN"

# Social Engagers (60 days)
curl -s -X POST "https://graph.facebook.com/v19.0/$AD_ACCOUNT/customaudiences" \
  -d "name=TRESR - Page Engagers 60d" \
  -d "subtype=ENGAGEMENT" \
  -d 'rule={"inclusions":{"operator":"or","rules":[{"object_id":"101101499404138","event_sources":[{"id":"101101499404138","type":"page"}],"retention_seconds":5184000}]}}' \
  -d "access_token=$FB_TOKEN"
```

### Retargeting Campaign (10-15% of total budget)

```bash
curl -s -X POST "https://graph.facebook.com/v19.0/$AD_ACCOUNT/adsets" \
  -d "name=TRESR Retargeting - Warm Audiences" \
  -d "campaign_id=CAMPAIGN_ID" \
  -d "daily_budget=500" \
  -d "billing_event=IMPRESSIONS" \
  -d "optimization_goal=OFFSITE_CONVERSIONS" \
  -d "targeting={\"custom_audiences\":[{\"id\":\"ATC_AUDIENCE_ID\"},{\"id\":\"VC_AUDIENCE_ID\"},{\"id\":\"ENGAGER_AUDIENCE_ID\"}],\"geo_locations\":{\"countries\":[\"US\"]}}" \
  -d "access_token=$FB_TOKEN"
```

**Expected retargeting ROAS**: 3-6x (warm traffic converts much better)

## Weekly Testing Cadence

| Day | Action |
|-----|--------|
| Monday | Analyze weekend test results, identify winners/losers |
| Tuesday | Create new mockups for next test batch |
| Wednesday | Set up Thursday campaigns (paused) |
| Thursday | Launch tests (Cycle 1 + Cycle 2) |
| Friday | Monitor, early kill $3+ CPC ads |
| Saturday | Let winners run |
| Sunday | Final data collection, prepare Monday analysis |

## Integration Points

- **tresr-lifestyle-mockup-generator**: Provides the mockup variants to test
- **tresr-design-to-shopify**: Triggers iteration mode for winners (20-30 variations)
- **tresr-daily-scorecard**: Reports CPC by product, ROAS calculations
- **tresr-conversion-optimizer**: Ensures landing pages convert the traffic

## Monitoring Commands

```bash
# Quick check: all active campaigns
curl -s "https://graph.facebook.com/v19.0/$AD_ACCOUNT/campaigns?fields=name,status,daily_budget&filtering=[{\"field\":\"effective_status\",\"operator\":\"IN\",\"value\":[\"ACTIVE\"]}]&access_token=$FB_TOKEN"

# Yesterday's spend and results
curl -s "https://graph.facebook.com/v19.0/$AD_ACCOUNT/insights?fields=spend,clicks,impressions,ctr,cpc,actions&date_preset=yesterday&access_token=$FB_TOKEN"

# Last 7 days by campaign
curl -s "https://graph.facebook.com/v19.0/$AD_ACCOUNT/insights?fields=campaign_name,spend,clicks,cpc,ctr,actions&level=campaign&date_preset=last_7d&access_token=$FB_TOKEN"
```

## MANDATORY: Use Lifestyle Mockups for Ad Images

**ALWAYS use lifestyle mockup images for Facebook ads. NEVER use flat garment mockups.**

Lifestyle mockups (folded shirt on textured surface with props) consistently outperform flat garment blanks:
- 50% lower CPC
- 3-5x better ROAS
- Higher click-through rates

**Where to get lifestyle mockups:**
- Check Cloudinary: `tresr/mockups/lifestyle/{handle}-lifestyle.png`
- If missing, generate one using the `skills/tresr-lifestyle-mockup-generator/SKILL.md` skill
- Every product in the ai-designed collection should have a lifestyle mockup

**Ad image URL format:**
```
https://res.cloudinary.com/dqslerzk9/image/upload/tresr/mockups/lifestyle/{handle}-lifestyle.png
```

## MANDATORY: Visual Verification

After ANY live site change (theme CSS, product images, page content), visually verify with `browser(action="screenshot", targetUrl="<affected_url>", target="host")` before confirming to Jon. NEVER say changes are working without seeing them yourself. If browser is unavailable, say "pushed but unable to visually verify, please check."
