---
name: tresr-seo-compact-keywords
description: Plan and execute bottom-of-funnel SEO for TRESR using buyer-intent keyword strategy. Use when doing keyword research, creating landing pages, optimizing product/collection pages, building backlinks, running site audits, or improving search rankings. Covers on-page SEO, information architecture, link building, image SEO, and indexing.
---

# SEO — Buyer-Intent Keyword Strategy

## Core Principle
Target bottom-of-funnel (BOFU) keywords — people ready to buy. Low competition, low word count needed, low domain authority needed. Never chase high-volume top-of-funnel terms.

## TRESR Context
- **Store**: tresr.com (Shopify)
- **Niche**: AI-designed t-shirts, print-on-demand, tech humor apparel
- **Current SEO**: 24 pages indexed out of 541. Near-zero organic traffic. Recovery mode.
- **Search Console**: `sc-domain:tresr.com` via Google OAuth
- **GA4 Property**: `377300744`

## BOFU Keyword Patterns for TRESR

| Pattern | Example |
|---------|---------|
| [category] + t-shirt(s) | "developer t-shirts", "cat lover tee" |
| [category] + gift | "gift for programmer", "funny gift for coffee lover" |
| buy + [description] + shirt | "buy AI humor shirt" |
| [topic] + merch | "coding merch", "crypto merch" |
| funny + [topic] + shirt | "funny introvert shirt" |
| [topic] + tee + for [person] | "dog lover tee for him" |
| best + [category] + shirts + [year] | "best developer shirts 2026" |

## On-Page: The 7 Critical Placements

For every product/collection page, place the exact target keyword in:

1. **Page title** (beginning) — `[Keyword] | [Benefit] | TRESR`
2. **Meta description** (beginning) — keyword + CTA + under 160 chars
3. **URL slug** — clean, hyphenated keyword
4. **H1 tag** — exact keyword or close variant (one H1 only)
5. **First sentence** — keyword in opening line naturally
6. **Image alt text** — descriptive, includes keyword
7. **Body content** — natural usage + semantic variations

## Word Count
- BOFU pages: 300-500 words. Don't pad.
- Product pages: existing Shopify description is fine if it hits the 7 placements.
- Collection pages: add 200-400 word intro with keyword + trust signals.

## Landing Page Structure (for new BOFU pages)

```
[H1: Exact Target Keyword]
[Opening paragraph — keyword in first sentence, address buyer intent]
[Section: What makes these shirts special — benefits, quality, humor]
[Section: Why TRESR — AI-designed, premium blend, transparent business]
[Section: Social proof — community size, real revenue numbers, reviews]
[Strong CTA — "Shop Now" with link to collection]
```

## Information Architecture

### Hub Pages (collections)
- `/collections/ai-designed` (main hub)
- `/collections/developer`, `/collections/coffee-lovers`, etc.

### Spoke Pages (products)
- Each product targets a specific long-tail keyword
- Links back to its collection (hub)
- Links to 2-3 related products

### Internal Linking Rules
- Every page reachable in ≤3 clicks from homepage
- Use descriptive anchor text (not "click here")
- 3-5 internal links per page
- Collection pages link in footer

## Image SEO Checklist
- **Filename**: descriptive, hyphenated (`ai-robot-coffee-tee-black.jpg`)
- **Alt text**: keyword + description (`"Funny AI robot drinking coffee t-shirt in black"`)
- **Size**: under 200KB, use WebP when possible
- **Dimensions**: don't upload larger than needed

## Indexing Protocol
1. After creating/updating any page, submit URL to Google Search Console:
```bash
curl -s -X POST "https://indexing.googleapis.com/v3/urlNotifications:publish" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"url":"https://tresr.com/PAGE_URL","type":"URL_UPDATED"}'
```
2. Also submit to Bing Webmaster Tools if configured
3. Verify sitemap at `tresr.com/sitemap.xml` includes new pages

## Link Building Priority

1. **Directories** — Submit to POD directories, t-shirt directories, AI/tech directories, Shopify store directories
2. **Expert quotes** — Featured.com, Source of Sources, HARO/Connectively (1-2 submissions/day)
3. **Reddit** — Genuine participation in r/printOnDemand, r/tshirtdesign, r/entrepreneur, r/artificial
4. **Product Hunt** — Launch TRESR as "AI-run t-shirt store" (one-time, high impact)
5. **Podcast appearances** — AI/ecommerce/startup podcasts via aipodcastmatcher.com

## Site Audit Checklist (Monthly)
- [ ] Run page titles check — unique? keyword? under 60 chars?
- [ ] Run meta descriptions — unique? keyword? under 160 chars?
- [ ] Every page has exactly one H1 with target keyword
- [ ] No broken links (404s)
- [ ] No duplicate content
- [ ] Page speed under 3 seconds
- [ ] All images have alt text
- [ ] Sitemap is current and submitted
- [ ] Check Search Console for crawl errors

## Keyword Research Process
1. Brainstorm BOFU terms for each product category
2. Validate with DataForSEO (credentials in .env)
3. Check competition — aim for keywords competitors ignore
4. Map each keyword to a specific page
5. Track rankings weekly via Search Console

## Tools Available
- **DataForSEO**: `DATAFORSEO_USERNAME` + `DATAFORSEO_PASSWORD` in .env — SERP, Keywords, OnPage, Labs, Backlinks
- **Google Search Console**: OAuth token (see tresr-daily-scorecard skill)
- **Google Analytics (GA4)**: Same OAuth token, Property `377300744`
- **Google Indexing API**: Same OAuth token

## Auto-Audit: Check All Products for Missing Meta Descriptions

Run weekly (or as a cron concept) to catch any products missing SEO elements:

```python
import requests, os

SHOP = "becc05-b4.myshopify.com"
TOKEN = os.environ.get('SHOPIFY_ACCESS_TOKEN', 'REDACTED_SHOPIFY_TOKEN=REDACTED')
HEADERS = {'X-Shopify-Access-Token': TOKEN}

def seo_audit():
    """Audit all products for missing meta descriptions, titles, alt text."""
    issues = {'missing_meta': [], 'missing_alt': [], 'bad_title': []}
    
    url = f'https://{SHOP}/admin/api/2024-01/products.json?limit=250&status=active'
    while url:
        resp = requests.get(url, headers=HEADERS)
        products = resp.json().get('products', [])
        
        for p in products:
            # Check meta description via metafields
            meta_resp = requests.get(
                f'https://{SHOP}/admin/api/2024-01/products/{p["id"]}/metafields.json',
                headers=HEADERS
            )
            metafields = meta_resp.json().get('metafields', [])
            has_meta = any(m['namespace'] == 'global' and m['key'] == 'description_tag' for m in metafields)
            
            if not has_meta:
                issues['missing_meta'].append({'id': p['id'], 'title': p['title'], 'handle': p['handle']})
            
            # Check image alt text
            for img in p.get('images', []):
                if not img.get('alt'):
                    issues['missing_alt'].append({'product': p['title'], 'image_id': img['id']})
            
            # Check title format
            if len(p['title']) > 70 or len(p['title']) < 10:
                issues['bad_title'].append({'id': p['id'], 'title': p['title']})
        
        link = resp.headers.get('Link', '')
        url = link.split('<')[1].split('>')[0] if 'rel="next"' in link else None
    
    print(f"Missing meta descriptions: {len(issues['missing_meta'])}")
    print(f"Missing image alt text: {len(issues['missing_alt'])}")
    print(f"Bad title length: {len(issues['bad_title'])}")
    
    return issues
```

## Collection Page Intro Copy (200-400 Words BOFU)

Every collection page needs a keyword-rich intro. Generate and apply:

```python
def generate_collection_copy(collection_handle, target_keyword):
    """Generate 200-400 word BOFU intro for a collection page."""
    
    # Template structure:
    copy_template = f"""
    <div class="collection-intro">
        <h2>{target_keyword}</h2>
        <p>[Opening paragraph — target keyword in first sentence, address buyer intent directly]</p>
        <p>[What makes TRESR different — AI-designed, premium Next Level 6410, unique humor]</p>
        <p>[Social proof — 700+ community members, real brand story]</p>
        <p>[CTA — Browse the collection, $29 tees, free shipping at $75]</p>
    </div>
    """
    
    # Apply via Shopify API — update collection body_html
    resp = requests.put(
        f'https://{SHOP}/admin/api/2024-01/collections/{collection_id}.json',
        headers={**HEADERS, 'Content-Type': 'application/json'},
        json={'custom_collection': {'id': collection_id, 'body_html': generated_copy}}
    )
    # Note: For smart collections, use /smart_collections/{id}.json endpoint

# Target collections and keywords:
COLLECTION_SEO = {
    'developer': {'id': 651916968221, 'keyword': 'funny developer t-shirts'},
    'coffee-lovers': {'id': 651916771613, 'keyword': 'coffee lover tees'},
    'meme-humor': {'id': 651916738845, 'keyword': 'funny meme shirts'},
    'cat-lovers': {'id': 651916706077, 'keyword': 'cat lover t-shirts'},
    'dog-lovers': {'id': 651916935453, 'keyword': 'dog lover shirts'},
    'entrepreneur': {'id': 651917000989, 'keyword': 'entrepreneur t-shirts'},
    'introvert-bookworm': {'id': 651916804381, 'keyword': 'introvert book lover shirts'},
    'crypto-web3': {'id': 651916869917, 'keyword': 'crypto t-shirts'},
}
```

## Google Indexing API Submission

After any product or collection change, notify Google:

```bash
# IMPORTANT: Use node+dotenv to load .env (shell export/source mangles keys with special chars)
TOKEN=$(node -e "require('dotenv').config({override:true}); const https=require('https'); const data='client_id='+process.env.GOOGLE_CLIENT_ID+'&client_secret='+process.env.GOOGLE_CLIENT_SECRET+'&refresh_token='+process.env.GOOGLE_OAUTH_REFRESH_TOKEN+'&grant_type=refresh_token'; const req=https.request('https://oauth2.googleapis.com/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'}},r=>{let d='';r.on('data',c=>d+=c);r.on('end',()=>console.log(JSON.parse(d).access_token))}); req.write(data); req.end();" 2>/dev/null)

# Submit URL for indexing
curl -s -X POST "https://indexing.googleapis.com/v3/urlNotifications:publish" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"url":"https://tresr.com/products/PRODUCT_HANDLE","type":"URL_UPDATED"}'

# Submit collection page
curl -s -X POST "https://indexing.googleapis.com/v3/urlNotifications:publish" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"url":"https://tresr.com/collections/COLLECTION_HANDLE","type":"URL_UPDATED"}'
```

**Automate**: After every `tresr-design-to-shopify` run, submit the new product URL to Google Indexing API.

## Monthly Automated Audit Checklist

Run on the 1st of every month:

```markdown
## SEO Monthly Audit — [MONTH YEAR]

### Page Titles
- [ ] All products have unique titles under 60 chars with target keyword
- [ ] All collections have unique titles
- [ ] Homepage title is optimized

### Meta Descriptions
- [ ] All products have meta descriptions (run seo_audit())
- [ ] All collections have meta descriptions
- [ ] All descriptions under 160 chars with keyword + CTA

### H1 Tags
- [ ] Every page has exactly one H1
- [ ] H1 contains target keyword

### Content
- [ ] All collection pages have 200-400 word intros
- [ ] Product descriptions are 50+ words with keyword usage
- [ ] No duplicate content across products

### Technical
- [ ] Sitemap at tresr.com/sitemap.xml is current
- [ ] No 404 errors in Search Console
- [ ] Page speed under 3 seconds (check core web vitals)
- [ ] All images have alt text
- [ ] No broken internal links

### Indexing
- [ ] Check indexed page count in Search Console (target: all active products + collections)
- [ ] Submit any non-indexed URLs via Indexing API
- [ ] Review crawl errors

### Rankings
- [ ] Pull top 20 keyword rankings from Search Console
- [ ] Compare to last month — any drops?
- [ ] Identify new ranking opportunities

### Backlinks
- [ ] Check backlink count via DataForSEO
- [ ] Submit to 2-3 new directories this month
- [ ] Respond to 5+ HARO/expert quote requests
```

## ⚠️ NEVER Externally
- Reference "Compact Keywords" as a strategy name
- Share this methodology with community or public
- Frame as anything other than "targeting buyer-intent keywords"
