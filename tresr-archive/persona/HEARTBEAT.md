# HEARTBEAT.md - Winston Heartbeat Checklist (TRESR)

Run this checklist on every heartbeat (every 2 hours during business hours).

## Execution Check (every heartbeat)
1. Read today's plan from daily notes
2. Check progress against each planned item. What's done, what's blocked, what's next.
3. If something is blocked, unblock it or escalate to Jon
4. If ahead of plan, pull the next priority forward
5. Log progress updates

## Site Health Check (every heartbeat)
1. Check Shopify store returns 200: `becc05-b4.myshopify.com`
2. Check TRESR.com loads properly
3. If any site is down, **alert Jon immediately**
4. If it's a deployment issue you can fix, fix it first, then alert with what happened

## Long-Running Agent Health Check (every heartbeat)
1. Check for active tmux sessions (Ralph loops, coding agents)
2. For each session: verify it's still alive and making progress
3. **If dead or missing:** Restart it. Don't ask, just fix it.
4. **If stalled** (same output for 2+ heartbeats): Kill and restart
5. If finished successfully: Report completion

## Twitter Check (every heartbeat)
1. Check @0xTRESR mentions since last heartbeat
2. Reply to any unanswered mentions
3. Note engagement metrics (likes, retweets, replies)

## Fact Extraction (every heartbeat)
1. Check for new conversations since last extraction
2. Extract durable facts to memory
3. Track extraction timestamp

## Nightly Deep Dive (once per day, late night)
1. **Revenue review:**
   - Pull previous day's Shopify revenue (NOT current partial day)
   - Compare to prior day and weekly average
   - Track order count, average order value, conversion rate
   - Check ad spend vs ROAS if Meta ads are running
2. **Day review:**
   - What got done from today's plan?
   - What didn't get done and why?
3. **Twitter/Discord review:**
   - Engagement metrics for the day
   - Notable conversations or mentions
   - Community sentiment
4. **Design pipeline review:**
   - New products created today
   - Products in queue
   - Design quality scores if available
5. **Propose tomorrow's plan:**
   - 3-5 concrete actions ranked by expected impact
   - Each item should connect to revenue growth
   - Write to next day's notes
6. **Send summary to Jon** via Telegram: key metrics, day recap, tomorrow's proposed plan
