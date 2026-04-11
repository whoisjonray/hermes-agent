---
name: tresr-competitor-monitor
description: Track 10-15 competitor POD stores weekly. Monitor Facebook Ad Library, new designs, pricing changes, and mockup styles. Output weekly digest with actionable insights and trending concept alerts.
---

# Competitor Monitor

## Overview

Track competitor POD stores to identify trending designs, pricing strategies, mockup styles, and ad creative approaches. Weekly cadence with alert triggers for trending concepts in TRESR niches.

## Competitor List (Build This First)

### How to Find Competitors

1. **Facebook Ad Library**: Search for active t-shirt ads in our niches
2. **Etsy top sellers**: Stores with 10,000+ sales in our categories
3. **Google Search**: "[category] t-shirt store" — see who's advertising
4. **Reddit**: r/printOnDemand — stores people mention

```
https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=funny+developer+t-shirt
```

### Competitor Tracking Sheet

| # | Store | URL | Niches | Est. Size | Ad Active | Last Checked |
|---|-------|-----|--------|-----------|-----------|-------------|
| 1 | TBD | TBD | TBD | TBD | TBD | Never |
| 2 | TBD | TBD | TBD | TBD | TBD | Never |
| ... | ... | ... | ... | ... | ... | ... |

**Goal**: Track 10-15 stores. Mix of:
- 3-5 direct competitors (POD, similar niches, similar size)
- 3-5 aspirational competitors (POD, larger, proven successful)
- 2-3 adjacent competitors (different niche but similar model)

## Weekly Monitoring Process

### 1. Store Check (web_fetch)

For each competitor store:

```python
# Fetch competitor homepage / collections
# web_fetch: url="https://competitor-store.com/collections/all"
# Extract: new products, pricing, mockup styles, collection structure
```

**Track per store:**
- New products since last check
- Price changes
- New collections or categories
- Mockup style changes (flat → lifestyle? new backgrounds?)
- Site design/UX changes

### 2. Facebook Ad Library Check

```python
# Search competitor's Facebook page ads
# web_fetch: url="https://www.facebook.com/ads/library/?active_status=active&ad_type=all&search_type=advertiser_name&q=COMPETITOR_PAGE_NAME"

# Or search by keyword
# web_fetch: url="https://www.facebook.com/ads/library/?active_status=active&ad_type=all&country=US&q=funny+cat+shirt"
```

**Track per competitor:**
- Number of active ads
- Ad creative style (lifestyle mockup? model? flat lay?)
- Ad copy themes
- Landing page URLs
- How long ads have been running (long-running = profitable)

### 3. Trending Concept Detection

```python
# Search for trending designs in our niches
queries = [
    "trending t-shirt designs 2026",
    "viral t-shirt {CATEGORY} 2026",
    "best selling {CATEGORY} shirts this week",
    "new {CATEGORY} merch trending"
]
# Use web_search for each query
```

**Alert triggers** (flag immediately, don't wait for weekly digest):
- Competitor launches 5+ designs in a category we're in
- New design concept getting 100+ reviews in <30 days on Etsy
- Competitor ad running 30+ days (proven winner we should study)
- Price changes across multiple competitors (market shift)

## Weekly Digest Format

```markdown
# Competitor Monitor Digest — Week of [DATE]

## 🔥 Trending Alerts
- [Alert 1: What happened, why it matters, recommended action]
- [Alert 2: ...]

## 📊 Competitor Activity Summary

### [Competitor 1]
- **New products**: X new designs (themes: ...)
- **Ad activity**: X active ads, creative style: ...
- **Pricing**: No change / Changed to $X
- **Notable**: [Anything interesting]

### [Competitor 2]
...

## 💡 Opportunities for TRESR
1. [Opportunity based on competitor gaps]
2. [Trending concept we should create]
3. [Mockup style that's working for competitors]

## 📈 Market Trends
- [Category] demand is [rising/falling/stable]
- [Design theme] is trending across multiple stores
- [Price point] seems to be the sweet spot

## Action Items
- [ ] Create designs for: [validated concepts]
- [ ] Test mockup style: [what competitors are using successfully]
- [ ] Research further: [emerging category/trend]
```

## Automation

### Cron Concept (Weekly — Sunday Night)

Run competitor check every Sunday to have digest ready for Monday planning:

1. web_search for each competitor store
2. web_fetch homepage/collections for new products
3. web_search Facebook Ad Library for active ads
4. web_search for trending concepts per niche
5. Compile digest
6. Email digest to Jon via Resend
7. Save to `internal/competitor-digests/YYYY-MM-DD.md`

### Data Storage

Save competitor data for trend analysis:

```
internal/
  competitor-digests/
    2026-02-16.md
    2026-02-23.md
    ...
  competitor-data/
    competitors.json  (master list with URLs and metadata)
```

## Integration Points

- **tresr-design-research**: Competitor insights feed into concept validation
- **tresr-lifestyle-mockup-generator**: Learn which mockup styles competitors use successfully
- **tresr-meta-ads-testing**: Study competitor ad creative for our own testing
- **tresr-daily-scorecard**: Flag when competitors make major moves
