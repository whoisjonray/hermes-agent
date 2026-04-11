# TOOLS.md - Winston Tool Patterns (TRESR)

## Coding Sub-Agents

**ALWAYS use Codex CLI directly for coding tasks. NEVER use sessions_spawn with model override.**

### Ralph Loop (PREFERRED for non-trivial tasks)
Use `ralphy` to wrap coding agents in a retry loop with completion validation.
Ralph restarts with fresh context each iteration. Prevents stalling, context bloat, and premature exits.

```bash
# Single task with Codex
ralphy --codex "Fix the authentication bug in the API"

# PRD-based workflow (best for multi-step work)
ralphy --codex --prd PRD.md

# With Claude Code instead
ralphy --claude "Refactor the database layer"

# Parallel agents on separate tasks
ralphy --codex --parallel --prd PRD.md

# Limit iterations
ralphy --codex --max-iterations 10 "Build the feature"
```

**When to use Ralph vs raw Codex:**
- **Ralph**: Multi-step features, anything with a PRD/checklist, tasks that have stalled before
- **Raw Codex**: Tiny focused fixes, one-file changes, exploratory work

### Codex CLI Syntax
```bash
# Non-interactive execution (full auto-approve)
codex exec --full-auto "Task description here"

# With worktree for parallel work
git worktree add -b fix/issue-name /tmp/codex-fix-N main
codex exec --full-auto -C /tmp/codex-fix-N "Task description..."
```

### WRONG FLAGS (do NOT use):
- `--yolo` does not exist
- `--approval-mode` does not exist
- `-q` does not exist on `codex exec`
- The prompt is a **positional argument**, not a flag

### MANDATORY: Verify Before Declaring Failure
When a background Codex process ends, ALWAYS check:
1. `git log --oneline -3` (did it commit?)
2. `git diff --stat` (uncommitted changes?)
3. Process output (what actually happened?)
Only if ALL three show nothing is it a real failure.

## X/Twitter - Use xpost CLI
- `xpost post "text"` for tweets (as @0xTRESR)
- `xpost reply <id> "text"` for replies
- `xpost delete <id>` to delete
- `xpost mentions` to check mentions
- `xpost search "query"` to search
- For scheduling, use OpenClaw cron jobs with one-shot "at" schedules that call xpost
- **NEVER use browser automation for X/Twitter.** Will get the account banned.

## Shopify Admin API (for TRESR metrics)
Instead of Stripe, TRESR uses Shopify for revenue tracking.

```bash
# Get today's orders
curl -s "https://becc05-b4.myshopify.com/admin/api/2024-01/orders.json?status=any&created_at_min=$(date -u +%Y-%m-%dT00:00:00Z)" \
  -H "X-Shopify-Access-Token: $SHOPIFY_ACCESS_TOKEN"

# Get order count
curl -s "https://becc05-b4.myshopify.com/admin/api/2024-01/orders/count.json?status=any" \
  -H "X-Shopify-Access-Token: $SHOPIFY_ACCESS_TOKEN"

# Get products
curl -s "https://becc05-b4.myshopify.com/admin/api/2024-01/products.json?limit=50" \
  -H "X-Shopify-Access-Token: $SHOPIFY_ACCESS_TOKEN"
```

## tmux for Long-Running Agents
Background exec processes die on gateway restart. Use tmux for anything >5 minutes.

**ALWAYS use the stable socket (`~/.tmux/sock`).** The default `/tmp` socket gets reaped by macOS.

```bash
# Create named session (STABLE SOCKET)
tmux -S ~/.tmux/sock new -d -s myagent "cd ~/project && ralphy --codex --prd PRD.md; echo 'EXITED:' \$?; sleep 999999"

# Check on it later
tmux -S ~/.tmux/sock capture-pane -t myagent -p | tail -20

# List sessions
tmux -S ~/.tmux/sock list-sessions

# Kill a session
tmux -S ~/.tmux/sock kill-session -t myagent
```

Always append completion hook:
```bash
; EXIT_CODE=$?; echo "EXITED: $EXIT_CODE"; openclaw system event --text "Agent finished (exit $EXIT_CODE)" --mode now; sleep 999999
```

**After starting, log it in daily notes** so context compaction doesn't lose awareness.

## Exec Timeout Defaults

| Category | yieldMs | timeout | Example |
|---|---|---|---|
| Quick commands | (default) | - | `ls`, `cat`, `echo` |
| CLI tools | 30000 | 45 | `gh pr list`, `xpost` |
| Package installs | 60000 | 120 | `npm install` |
| Builds & deploys | 60000 | 180 | `npm run build` |
| Long-running | - | - | Use `background: true` + poll |
