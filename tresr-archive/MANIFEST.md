# TRESR OpenClaw Archive

**Archived:** 2026-04-11
**Reason:** Migrating from OpenClaw to Hermes Agent. OpenClaw setup didn't drive revenue. Mission Control dashboard was overengineered. Starting fresh.

## What's in here

### tresr-persona.zip
The 5 OpenClaw persona files that defined Winston/Rez:
- `IDENTITY.md` - CEO role, Shopify store, key systems, daily rhythm
- `SOUL.md` - Voice (sharp, warm, crypto-native, no corporate speak)
- `MEMORY.md` - Business knowledge (1,853 products, pricing, Cloudinary, anti-patterns)
- `TOOLS.md` - Execution patterns (Ralph Loop, Codex, xpost, Shopify API, tmux)
- `HEARTBEAT.md` - 2-hour operational checklist + nightly deep dive

### tresr-skills.zip
23 OpenClaw skills (SKILL.md format). None of these worked well enough to justify keeping as-is. Archived for reference if the Hermes agent wants to cherry-pick ideas.

| Skill | What it tried to do |
|-------|-------------------|
| tresr-daily-operations-orchestrator | Master daily sequencer |
| tresr-daily-scorecard | Pull metrics from GA4, Search Console, Meta, Shopify |
| tresr-trend-scout | Scan 5 sources for design opportunities |
| tresr-design-factory | Generate design briefs |
| tresr-design-research | Deep validation of concepts |
| tresr-design-scorer | Score designs 7+/10 |
| tresr-design-to-shopify | Create Shopify products from designs |
| tresr-product-image-pipeline | 5-position product photos |
| tresr-product-launcher | End-to-end product launch |
| tresr-product-scoring | Score live products, reorder collection |
| tresr-lifestyle-mockup-generator | Category-specific lifestyle backgrounds |
| tresr-meta-ads-autopilot | Auto-scale/kill Meta ads by ROAS |
| tresr-meta-ads-testing | A/B test ad sets |
| tresr-ad-creative-lab | Refresh creative for winners |
| tresr-twitter-engagement | @0xTRESR replies + organic tweets |
| tresr-discord-engagement | Design drop announcements |
| tresr-email-marketing | Abandoned cart sequences |
| tresr-email-revenue-engine | Email revenue optimization |
| tresr-weekly-profit-review | Sunday P&L analysis |
| tresr-store-conversion-optimizer | Monday CRO audit |
| tresr-conversion-optimizer | Conversion rate optimization |
| tresr-competitor-monitor | Competitor tracking |
| tresr-seo-compact-keywords | SEO audit for product listings |

### tresr-bot-implementation.zip
The Telegraf.js bot implementation (Node.js). Includes:
- `src/` - Bot commands, modules (trend detection, design generation, Shopify management), services
- `scripts/` - 12 automation scripts (mockup generation, collection management, backfill)
- `config/` - Design style profiles, mockup templates
- `output/` - 100+ generated design specs
- `strategies/` - UGC strategy docs
- `backgrounds/` - Category-specific lifestyle backgrounds

### mission-control.zip
The full Next.js Mission Control dashboard. Includes:
- App router pages (dashboard, agents, skills, chat, cron, settings, etc.)
- Prisma schema + migrations (PostgreSQL)
- `lib/openclaw.ts` - WebSocket RPC gateway client
- `lib/winston.ts` - Conversation engine
- Telegram webhook handler
- Skills CRUD + gateway push
- Mockup HTML files (design system reference)
- Agent templates
- Love On + TRESR persona directories

## Railway Infrastructure (to be deleted)

### client-tresr project (e2a8dbc5-5629-4cdf-9850-f1129e85d172)
- OpenClaw Gateway: `a9b3773c` -> openclaw-gateway-production-1399.up.railway.app
- Mission Control: `403cf19c` -> mission-control-production-6a25.up.railway.app
- PostgreSQL: `1ae0a9ee` (internal)

### client-loveon project (40c08409-0501-4326-8be6-5d4cba980c2f)
- OpenClaw Gateway: `a4869ff0` -> openclaw-gateway-production-d810.up.railway.app
- Mission Control: `f7c45664` -> mission-control-production-5db3.up.railway.app
- PostgreSQL: `5c1698e9` (internal)

### client-rez project (1f54596a-8d5a-4d70-8bf5-aabb5018ae29)
- OpenClaw Gateway: `ca0db6b1` -> openclaw-gateway-production-fe1a.up.railway.app
- Mission Control: `9bdfad88` -> mission-control-production-5bcf.up.railway.app
- PostgreSQL: `4c831e05` (internal)

### openclaw-final-boss (legacy shared project: 5d333434-b54f-4057-8dc2-f319b7ebc808)
- Service: `b074e5d5` -> openclaw-production-79af.up.railway.app

## What NOT to carry forward
- The entire Mission Control dashboard concept (read-only gateway viewer that was never useful)
- OpenClaw RPC protocol patterns (WebSocket ceremony, config.set with raw JSON, exec-doesn't-exist)
- The 23 skills as-is (let Hermes build its own through use)
- PostgreSQL dependency (Hermes uses embedded SQLite)
- Multi-agent-per-gateway architecture (Hermes is one agent per process)
