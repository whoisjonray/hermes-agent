---
name: tresr-design-research
description: Market validation for design concepts BEFORE creation. Research Etsy/Amazon bestsellers, validate keyword volume, analyze competitors, and output ranked concept lists. Prevents wasting Gemini credits on designs nobody wants to buy.
---

# Design Research

## Core Principle

**Never create a design without validating demand first.** Research → Validate → Create → Test → Iterate.

## Step 1: Etsy/Amazon Bestseller Research

### Search Etsy for Trending Designs

```python
# Use web_search to find bestsellers on Etsy
queries = [
    "site:etsy.com bestselling {CATEGORY} t-shirt",
    "site:etsy.com {CATEGORY} funny shirt best seller",
    "etsy bestseller {CATEGORY} tee 2026",
]
# Execute via web_search tool
```

**What to extract from results:**
- Design themes that appear repeatedly
- Review counts (higher = validated demand)
- Price points (where does market cluster?)
- Listing titles (keyword patterns)

### Scrape Competitor Listings

```python
# Use web_fetch to get details from top Etsy/Amazon listings
# Example: Etsy listing page
url = "https://www.etsy.com/listing/LISTING_ID"
# web_fetch extracts: title, price, reviews, description, tags
```

### Amazon Best Sellers

```python
# Search Amazon novelty t-shirts in target categories
queries = [
    "site:amazon.com best seller {CATEGORY} t-shirt",
    "amazon best sellers novelty t-shirts {CATEGORY}",
]
```

**Extract from Amazon:**
- BSR (Best Seller Rank) — lower = more sales
- Review counts and ratings
- Price points
- Design themes and text

## Step 2: Keyword Volume Validation (DataForSEO)

```bash
export DATAFORSEO_USER=$(grep DATAFORSEO_USERNAME .env | cut -d= -f2)
export DATAFORSEO_PASS=$(grep DATAFORSEO_PASSWORD .env | cut -d= -f2)

# Check search volume for design concept
curl -s -X POST "https://api.dataforseo.com/v3/keywords_data/google_ads/search_volume/live" \
  -H "Content-Type: application/json" \
  -u "$DATAFORSEO_USER:$DATAFORSEO_PASS" \
  -d '[{
    "keywords": [
      "funny developer shirt",
      "coding humor t-shirt", 
      "programmer gift tee",
      "cat mom shirt funny",
      "coffee lover t-shirt"
    ],
    "location_code": 2840,
    "language_code": "en"
  }]'
```

**Interpretation:**
- 100-1,000 monthly searches = niche BOFU (good for POD)
- 1,000-10,000 = competitive but doable
- 10,000+ = too broad, saturated

## Step 3: Google Trends Check

```python
# Use web_search to check Google Trends
queries = [
    "google trends {DESIGN_CONCEPT} t-shirt",
    "google trends {CATEGORY} merch 2026",
]
# Look for: rising/stable trends (good), declining trends (avoid)
```

## Step 4: Competitor Design Analysis

### Framework: The 5-Point Check

For each competitor design found:

1. **Theme**: What's the joke/message? (e.g., "I code therefore I drink coffee")
2. **Style**: Illustration, typography-only, minimalist, maximalist?
3. **Colors**: Dark shirts dominate? Light? What accent colors?
4. **Reviews**: How many? (proxy for sales volume)
5. **Gap**: What's missing? What do negative reviews say? ("I wish it came in...")

### Competitor Store Tracking

| Store | URL | Niche | Est. Revenue | Notes |
|-------|-----|-------|-------------|-------|
| TBD | TBD | Developer | TBD | Research needed |

Use Facebook Ad Library to find active POD advertisers in our niches:
```
https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q={CATEGORY}%20t-shirt
```

## Step 5: Output — Ranked Concept List

After research, produce a scored list:

```markdown
## Design Concepts — [Category] — [Date]

### Tier 1 (High Confidence — Make These)
| Concept | Keyword Vol | Etsy Competitors | Avg Reviews | Gap/Angle | Score |
|---------|-------------|-----------------|-------------|-----------|-------|
| "I code therefore I caffeinate" | 2,400 | 15 | 500+ | None do chibi robot style | 9/10 |

### Tier 2 (Medium Confidence — Test 1-2)
| Concept | Keyword Vol | Etsy Competitors | Avg Reviews | Gap/Angle | Score |
|---------|-------------|-----------------|-------------|-----------|-------|

### Tier 3 (Low Confidence — Skip Unless Easy)
| Concept | Keyword Vol | Etsy Competitors | Avg Reviews | Gap/Angle | Score |
|---------|-------------|-----------------|-------------|-----------|-------|
```

### Scoring Criteria (1-10)

| Factor | Weight | 10 = | 1 = |
|--------|--------|------|-----|
| Keyword volume | 25% | 1,000+ searches/mo | <50 searches |
| Competitor validation | 25% | 5+ sellers with 100+ reviews | Nobody selling it |
| Gap opportunity | 25% | No one doing our style (chibi robot) | Saturated with identical designs |
| Trend direction | 15% | Rising in Google Trends | Declining |
| TRESR brand fit | 10% | Perfect for our categories | Off-brand |

## Step 6: Feed into Design Pipeline

Once concepts are validated and ranked:

1. Top-scored concepts go to `tresr-design-to-shopify` skill
2. Include research notes in the design prompt for better output
3. Generate in batches of 10-15 per session
4. After launch, track CPC in `tresr-meta-ads-testing` to validate further

## Research Cadence

- **Weekly**: Research 1-2 categories, produce ranked concept list
- **Before any batch**: Quick validation of each concept
- **After ad results**: Re-research categories where winners emerged (go deeper)

## Category Research Queue

| Category | Last Researched | Concepts Found | Winners |
|----------|----------------|----------------|---------|
| Developer | Never | 0 | 0 |
| Coffee Lovers | Never | 0 | 0 |
| Meme/Humor | Never | 0 | 0 |
| Cat Lovers | Never | 0 | 0 |
| Dog Lovers | Never | 0 | 0 |
| Entrepreneur | Never | 0 | 0 |
| Introvert | Never | 0 | 0 |
| Crypto/Web3 | Never | 0 | 0 |
| OpenClaw | N/A (original) | N/A | N/A |

## Integration Points

- **tresr-design-to-shopify**: Pre-generation research step feeds validated concepts
- **tresr-meta-ads-testing**: Post-launch CPC data validates research accuracy
- **tresr-competitor-monitor**: Ongoing competitor tracking feeds back into research
- **tresr-seo-compact-keywords**: Keyword data from research informs SEO targeting
