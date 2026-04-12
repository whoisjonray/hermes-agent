# TRESR.com Full Automation System

## Overview

Self-improving POD automation that:
1. **Deep customer research** - Find confessions, not complaints
2. Finds trending opportunities (X API + Google Images)
3. Generates designs using THEIR language (not ours)
4. Creates mockups with researched backgrounds
5. Gets human approval via Telegram
6. Publishes to Shopify
7. Runs Facebook ads with research-driven copy
8. Self-corrects based on performance data
9. Scales winners, cuts losers automatically

## The Research-First Principle

> **The ad's performance is a direct reflection of how deeply you understand your customer. Nothing more.**

See: `/strategies/28-deep-customer-research-methodology.md`

### Why Most Ads Fail
- Surface-level research = generic ads
- "Coffee lovers, age 25-55" describes millions of people
- Nothing makes anyone specifically FEEL seen
- They scroll past without a second thought

### What We Do Instead
For each category (coffee, fitness, gaming, etc.):

1. **Find Confessions** - Raw 2am vents in Reddit, Facebook groups, YouTube comments
2. **Look for Proof** - Posts with 200+ upvotes and "omg this is me" replies
3. **Find Root Cause** - The WHY behind the surface complaint
4. **Validate Purchase Intent** - Check competitor ads, reviews
5. **Build Language Bank** - Their exact words, not marketing speak

### Example: Coffee Niche

**Surface research (what NOT to do):**
- "Coffee lovers"
- "Wants caffeine"
- "Likes mornings"

**Deep research (what we do):**
- "I judge people by their coffee order and I'm not sorry"
- "My personality is 90% coffee and 10% anxiety"
- "Don't talk to me until I've had my third cup"
- "I've spent $6 on coffee every day for 5 years and I'm afraid to do the math"

**The root cause:**
- Coffee isn't just a drink - it's their entire identity
- It's how they cope with adulting
- It's their one non-negotiable self-care ritual

**Design text that HITS:**
- "Espresso yourself" → Generic
- "Third cup? Now we can talk." → From confession
- "I'm not addicted. I'm committed." → Their exact words

## The Complete Flow

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        TELEGRAM BOT: @tresr_pod_bot                      │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  /research   → Deep dive customer research for a category                │
│  /trends     → Shows trending opportunities from X API + Google          │
│  /design     → Starts design workflow for selected trend                 │
│  /products   → Shows current products and performance                    │
│  /ads        → Shows ad performance, winners/losers                      │
│  /scale      → Manually scale a winning product                          │
│  /cut        → Manually cut an underperformer                            │
│  /report     → Daily/weekly performance summary                          │
│                                                                          │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                       STEP 0: DEEP CUSTOMER RESEARCH                     │
│                       (One-time per category setup)                      │
│                                                                          │
│  0a. Scan Reddit, Facebook groups, YouTube comments, Amazon reviews      │
│  0b. Find CONFESSIONS - the raw vents, not surface complaints            │
│  0c. Look for PROOF - 200+ upvotes, "omg this is me" replies            │
│  0d. Identify ROOT CAUSE - the why behind the what                       │
│  0e. Build LANGUAGE BANK - 20+ phrases in their exact words              │
│  0f. Validate PURCHASE INTENT - check competitor ads, reviews            │
│                                                                          │
│  Output per category:                                                    │
│  - 10+ validated confessions with engagement proof                       │
│  - 3-5 root cause insights                                               │
│  - 20+ language bank phrases                                             │
│  - Competitor ad analysis                                                │
│                                                                          │
│  This research powers ALL designs and ads for this category              │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                              STEP 1: CONCEPT                             │
│                                                                          │
│  1a. /trends command → Scan X API for trending topics in categories      │
│  1b. Search Google Images for best-selling designs in that category      │
│  1c. Analyze patterns with Gemini Vision                                 │
│  1d. Generate 3-5 concept briefs combining trend + proven patterns       │
│  1e. Send concepts to Telegram for selection                             │
│                                                                          │
│  User selects: "Concept #2 - Espresso Yourself typography"               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                           STEP 2: QUICK MOCKUP                           │
│                                                                          │
│  2a. Generate isolated design with Gemini (BALLN-style prompt)           │
│  2b. Remove black background                                             │
│  2c. Composite onto t-shirt template at y=440                            │
│  2d. Use default background for quick preview                            │
│  2e. Send to Telegram for approval                                       │
│                                                                          │
│  User options:                                                           │
│  [✅ Approve] [✏️ Text feedback] [🎤 Voice feedback] [❌ Reject]          │
│                                                                          │
│  If feedback → Integrate into new design prompt → Loop back to 2a        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                        STEP 3: BACKGROUND OPTIONS                        │
│                                                                          │
│  3a. Based on category, generate 3 background options from research      │
│      - Option A: Lifestyle flat-lay                                      │
│      - Option B: Minimalist clean                                        │
│      - Option C: Contextual themed                                       │
│  3b. Composite design on all 3 backgrounds                               │
│  3c. Send comparison to Telegram                                         │
│                                                                          │
│  User selects: "Option B"                                                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          STEP 4: FINAL MOCKUP                            │
│                                                                          │
│  4a. Generate high-res final mockup                                      │
│  4b. Create variants: Black tee, White tee, Hoodie                       │
│  4c. Send to Telegram for final approval                                 │
│                                                                          │
│  User: [✅ Approve] [❌ Back to design]                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         STEP 5: SHOPIFY PRODUCT                          │
│                                                                          │
│  5a. Generate SEO-optimized title (keyword + category + transformation)  │
│  5b. Generate description with benefits, sizing, care instructions       │
│  5c. Send title/description to Telegram for review                       │
│                                                                          │
│  User: [✅ Publish] [✏️ Edit title] [✏️ Edit description]                 │
│                                                                          │
│  5d. On approval: Create Shopify product via Admin API                   │
│      - Upload mockup images                                              │
│      - Set variants (sizes, colors)                                      │
│      - Set price ($29.99 tees, $49.99 hoodies)                           │
│      - Add to category collection                                        │
│  5e. Send published link to Telegram                                     │
│                                                                          │
│  User: [✅ Looks good] [✏️ Fix something]                                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                          STEP 6: FACEBOOK AD                             │
│                                                                          │
│  6a. Create campaign structure:                                          │
│      Campaign: [Category] - [Month] - Prospecting                        │
│      └── Ad Set: [Product Name] - Interest Targeting                     │
│          ├── Ad 1: Lifestyle mockup                                      │
│          ├── Ad 2: Flat lay mockup                                       │
│          └── Ad 3: Product focus mockup                                  │
│                                                                          │
│  6b. Set targeting based on category:                                    │
│      coffee → Coffee, Espresso, Barista, Coffee culture                  │
│      fitness → Gym, Fitness, CrossFit, Bodybuilding                      │
│                                                                          │
│  6c. Set initial budget: $25 test (Thursday-Sunday window)               │
│                                                                          │
│  6d. Send ad preview to Telegram                                         │
│      User: [✅ Launch] [❌ Don't run ads]                                  │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    STEP 7: SELF-CORRECTING AD OPTIMIZER                  │
│                                                                          │
│  Runs every 12 hours automatically:                                      │
│                                                                          │
│  7a. Pull metrics from Meta Ads API:                                     │
│      - Spend, Impressions, Clicks, Purchases                             │
│      - CPC, CTR, ROAS, Cost per purchase                                 │
│                                                                          │
│  7b. Apply decision rules:                                               │
│                                                                          │
│      CUT (auto-execute):                                                 │
│      - Spend > $25 AND ROAS < 1.0 → Pause immediately                    │
│      - Spend > $50 AND ROAS < 1.5 → Pause immediately                    │
│      - CPC > $2.00 after 500 impressions → Pause                         │
│                                                                          │
│      SCALE (require approval):                                           │
│      - Spend > $25 AND ROAS > 2.5 → Propose scale to $50/day             │
│      - Spend > $50 AND ROAS > 3.0 → Propose scale to $100/day            │
│      - Consistent 7-day ROAS > 2.5 → Propose doubling budget             │
│                                                                          │
│  7c. Send performance update to Telegram:                                │
│                                                                          │
│      📊 AD PERFORMANCE UPDATE                                            │
│                                                                          │
│      🏆 WINNER - Scale Recommended                                       │
│      Product: "Espresso Yourself" Coffee Tee                             │
│      Spend: $27.50 | Revenue: $89.97 | ROAS: 3.27x                       │
│      [✅ Scale to $50/day] [⏸️ Hold]                                      │
│                                                                          │
│      ⚠️ CUT - Auto-paused                                                │
│      Product: "Gym Goblin" Fitness Tee                                   │
│      Spend: $31.20 | Revenue: $0 | ROAS: 0x                              │
│      Status: Paused automatically                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    STEP 8: PRODUCT LIFECYCLE MANAGEMENT                  │
│                                                                          │
│  Weekly analysis (Sunday 9pm):                                           │
│                                                                          │
│  8a. Products with 7-day ROAS > 2.5:                                     │
│      → Keep running, suggest scaling                                     │
│      → Add to "winners" collection on Shopify                            │
│      → Consider creating variations (colors, designs)                    │
│                                                                          │
│  8b. Products with 7-day ROAS 1.5-2.5:                                   │
│      → Keep testing for another week                                     │
│      → Try different ad creatives                                        │
│      → Test different audiences                                          │
│                                                                          │
│  8c. Products with 7-day ROAS < 1.5:                                     │
│      → Pause ads completely                                              │
│      → Keep product live (organic sales)                                 │
│      → Mark as "tested - not scaling"                                    │
│                                                                          │
│  8d. Products never tested:                                              │
│      → Queue for next test cycle                                         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                         STEP 9: LEARNING LOOP                            │
│                                                                          │
│  Monthly analysis feeds back into trend detection:                       │
│                                                                          │
│  9a. Analyze all winners:                                                │
│      - Which categories performed best?                                  │
│      - Which design styles converted best?                               │
│      - Which backgrounds drove more clicks?                              │
│      - Which audiences had best ROAS?                                    │
│                                                                          │
│  9b. Update scoring weights:                                             │
│      - If coffee > fitness → weight coffee trends higher                 │
│      - If typography > illustration → prioritize typography designs      │
│      - If flat-lay > lifestyle → use more flat-lay backgrounds           │
│                                                                          │
│  9c. Feed insights into design generation:                               │
│      - "Based on 30-day performance, typography designs in coffee        │
│         category with minimalist backgrounds have 3.5x ROAS vs others"   │
│      - Next coffee design → prioritize typography + minimalist bg        │
│                                                                          │
│  This is the SELF-IMPROVING part - each month system gets smarter        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

## Key Metrics (From Transcripts)

### Ad Testing (Transcript 22-24)
- **Initial budget**: $25 per design test
- **Test window**: Thursday-Sunday (4 days, best buying window)
- **Target CPC**: < $1.00
- **Scale threshold**: ROAS > 2.0 after $50 spend
- **Cut threshold**: ROAS < 1.0 after $25 spend (auto-pause)
- **Full catalog test**: $100 over 2 weeks (Cycle 1: Catalog ads, Cycle 2: Static ads)

### Simultaneous Testing Capacity (Budget Dependent)
- $25/design over 4 days = ~$6/day/design
- **$50/day budget** → 8 designs testing at once
- **$100/day budget** → 16 designs testing at once
- **$200/day budget** → 32 designs testing at once
- Unlimited products on Shopify, but only actively test what budget allows

### Cost of Goods (Transcript 27)
- **Target COGS**: 40-50% of price
- **Pricing**: $29.99 tees, $49.99 hoodies
- **Printify cost**: ~$12-15 per tee with shipping
- **Profit margin target**: 15-25%

### Email Marketing (Resend API - Full Control)
- **Goal**: 20-30% of revenue from email
- **Welcome flow**: 10% discount for signup
- **Abandoned cart**: 3-email sequence (1hr, 24hr, 48hr)
- **Win-back**: Re-engage after 30 days inactive

## Learning Loop Speed

### Every 12 Hours (Auto-Execute)
- Pull Meta Ads metrics
- Auto-pause: spend > $25 AND ROAS < 1.0
- Auto-pause: CPC > $2.00 after 500 impressions
- Notify Telegram of actions taken

### Daily (6pm Review)
- Full performance summary to Telegram
- Queue scaling decisions for approval
- Identify test completions (4-day cycles done)

### Every 4 Days (Test Cycle Complete)
- Analyze completed tests
- Winners (ROAS > 2.0) → Queue for scaling
- Losers already paused → Archive
- Middle performers → Extend test OR cut

### Weekly (Sunday 9pm)
- Aggregate all learnings
- Update category weights (which niches perform best)
- Update style weights (which design types convert)
- Update background weights (which mockup styles work)
- Feed insights into next week's trend detection

## Technical Implementation

### Services to Build

```
tresr-bot/
├── src/
│   ├── services/
│   │   ├── customerResearch.js    ← Deep research methodology (NEW)
│   │   ├── trendDetector.js       ← X API + Google trends
│   │   ├── designResearch.js      ← Google Image + Gemini Vision (DONE)
│   │   ├── mockupResearch.js      ← Category mockup patterns (DONE)
│   │   ├── designGenerator.js     ← Gemini image generation (DONE)
│   │   ├── mockupService.js       ← PIL compositing (DONE)
│   │   ├── shopifyService.js      ← Product creation (DONE)
│   │   ├── metaAdsService.js      ← Facebook Ads API (DONE)
│   │   ├── adOptimizer.js         ← Self-correcting rules (DONE)
│   │   ├── emailService.js        ← Resend email flows (DONE)
│   │   ├── lifecycleManager.js    ← Product lifecycle management (DONE)
│   │   ├── performanceTracker.js  ← Metrics collection
│   │   └── learningLoop.js        ← Pattern analysis + weight updates
│   ├── bot/
│   │   ├── commands/
│   │   │   ├── trends.js          ← /trends command
│   │   │   ├── design.js          ← Design workflow
│   │   │   ├── products.js        ← Product management
│   │   │   └── ads.js             ← Ad performance
│   │   ├── handlers/
│   │   │   ├── conceptSelection.js
│   │   │   ├── designApproval.js
│   │   │   ├── voiceFeedback.js
│   │   │   ├── backgroundSelection.js
│   │   │   └── adDecisions.js
│   │   └── notifications/
│   │       ├── performanceAlerts.js
│   │       └── dailyReport.js
│   └── db/
│       ├── schema.sql
│       └── models/
├── scripts/
│   ├── mockup_generator.py        ← PIL compositor (DONE)
│   └── setup_meta_api.js
├── backgrounds/                    ← Category backgrounds (GENERATING)
├── config/
│   ├── categories.json            ← Niche configurations
│   ├── targeting.json             ← Ad targeting templates
│   └── ad-rules.json              ← Optimization rules
└── docs/
    └── TRESR-FULL-AUTOMATION.md   ← This file
```

### Database Schema

```sql
-- Categories
CREATE TABLE categories (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  targeting JSON,           -- FB targeting interests
  weight REAL DEFAULT 1.0,  -- Learning loop weight
  avg_roas REAL,
  total_products INTEGER DEFAULT 0,
  total_revenue REAL DEFAULT 0
);

-- Customer Research (Deep Research Methodology)
CREATE TABLE customer_research (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES categories(id),
  type TEXT NOT NULL,       -- 'confession', 'root_cause', 'language'
  source TEXT,              -- 'reddit', 'facebook', 'youtube', 'amazon', 'tiktok'
  source_url TEXT,
  content TEXT NOT NULL,    -- The actual quote/insight
  engagement_proof JSON,    -- { upvotes: 200, replies: 107, "me_too_count": 45 }
  validated BOOLEAN DEFAULT FALSE,
  used_in_ads INTEGER DEFAULT 0,
  conversion_rate REAL,     -- Track which confessions convert best
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Language Bank (Their exact words)
CREATE TABLE language_bank (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES categories(id),
  phrase TEXT NOT NULL,
  context TEXT,             -- Where/when they'd say this
  emotion TEXT,             -- 'frustration', 'pride', 'humor', 'confession'
  source_confession_id TEXT REFERENCES customer_research(id),
  times_used INTEGER DEFAULT 0,
  avg_ctr REAL,             -- Track which phrases get clicks
  avg_conversion REAL,      -- Track which phrases convert
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Root Causes (The Why Behind The What)
CREATE TABLE root_causes (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES categories(id),
  surface_complaint TEXT,   -- "Can't finish coffee"
  root_cause TEXT,          -- "Lost sense of identity outside being mum"
  emotional_core TEXT,      -- "Wants to feel like herself again"
  proof_confessions JSON,   -- Array of confession IDs that validate this
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Trends
CREATE TABLE trends (
  id TEXT PRIMARY KEY,
  category_id TEXT REFERENCES categories(id),
  concept TEXT NOT NULL,
  sources JSON,
  score INTEGER,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Designs
CREATE TABLE designs (
  id TEXT PRIMARY KEY,
  trend_id TEXT REFERENCES trends(id),
  style TEXT,
  prompt TEXT,
  image_path TEXT,
  mockup_path TEXT,
  background_id TEXT,
  feedback TEXT,
  status TEXT DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Products
CREATE TABLE products (
  id TEXT PRIMARY KEY,
  design_id TEXT REFERENCES designs(id),
  shopify_id TEXT,
  shopify_url TEXT,
  title TEXT,
  price INTEGER,
  status TEXT DEFAULT 'draft',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Campaigns
CREATE TABLE campaigns (
  id TEXT PRIMARY KEY,
  product_id TEXT REFERENCES products(id),
  meta_campaign_id TEXT,
  meta_adset_id TEXT,
  daily_budget INTEGER,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Performance (daily snapshots)
CREATE TABLE performance (
  id TEXT PRIMARY KEY,
  campaign_id TEXT REFERENCES campaigns(id),
  date DATE,
  spend REAL,
  impressions INTEGER,
  clicks INTEGER,
  purchases INTEGER,
  revenue REAL,
  roas REAL,
  cpc REAL
);

-- Decisions (audit trail)
CREATE TABLE decisions (
  id TEXT PRIMARY KEY,
  campaign_id TEXT REFERENCES campaigns(id),
  type TEXT,          -- 'scale', 'pause', 'test'
  reason TEXT,
  auto_executed BOOLEAN,
  approved_by TEXT,
  executed_at TIMESTAMP
);
```

## Proven Settings

### Design Position
- **y_offset**: 440 (on 2048x2048 t-shirt template)
- **design_width**: 35% of template width
- **bg_threshold**: 35 (for black background removal)

### Background Requirements
- **Format**: Square (1024x1024)
- **Center**: 70% empty for product
- **Props**: Edges/corners only

### T-Shirt Scale on Background
- **Scale**: 100% of background size
- **Position**: Centered

## API Keys Required

```env
# Telegram
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_CHAT_ID=xxx

# AI
GEMINI_API_KEY=xxx
ANTHROPIC_API_KEY=xxx

# Research
GOOGLE_SEARCH_API_KEY=xxx
GOOGLE_SEARCH_ENGINE_ID=xxx
X_BEARER_TOKEN=xxx

# E-commerce
SHOPIFY_STORE_URL=xxx
SHOPIFY_ACCESS_TOKEN=xxx

# Ads (Multi-Client via Awaken Local Business Manager)
# Shared token with access to all client ad accounts
FACEBOOK_ACCESS_TOKEN=EAAUTbGWcYOgBO...  # System User token

# TRESR Client
TRESR_AD_ACCOUNT_ID=act_XXXXXXXXX
TRESR_PIXEL_ID=XXXXXXXXX
TRESR_PAGE_ID=XXXXXXXXX

# DoorGrow Client (existing)
DOORGROW_AD_ACCOUNT_ID=act_40688230
DOORGROW_PIXEL_ID=XXXXXXXXX
DOORGROW_PAGE_ID=XXXXXXXXX

# Legacy single-client vars (fallback)
META_AD_ACCOUNT_ID=xxx
META_PIXEL_ID=xxx

# Email (Resend - full control)
RESEND_API_KEY=xxx
FROM_EMAIL=TRESR <hello@tresr.com>
```

## Implementation Status

### COMPLETED ✅
1. ✅ Generate 5 backgrounds per category (coffee, fitness)
2. ✅ Document full automation workflow
3. ✅ Build Telegram concept selection flow (trends.js)
4. ✅ Build design approval with voice feedback (design.js)
5. ✅ Build 3-background selection (backgrounds.js)
6. ✅ Build Shopify product creation (shopify.js, shopifyService.js)
7. ✅ Integrate Facebook Ads API (metaAdsService.js)
8. ✅ Build self-correcting optimizer (adOptimizer.js)
9. ✅ Integrate deep customer research methodology (customerResearch.js)
10. ✅ Create main bot entry point (bot/index.js)
11. ✅ Add Resend email integration (emailService.js)
12. ✅ Build product lifecycle management (lifecycleManager.js)

### REMAINING 🔄
1. **performanceTracker.js** - Centralized metrics collection and storage
2. **learningLoop.js** - Pattern analysis and weight updates
3. **Database setup** - SQLite or PostgreSQL for production
4. **Webhook server** - Handle Shopify webhooks for abandoned cart/orders
5. **Image generation integration** - Connect to Imagen/DALL-E for actual design generation
6. **Testing and deployment**
