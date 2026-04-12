# TRESR Bot - Claude Code Instructions

## Project Overview
Telegram bot for POD (Print on Demand) t-shirt automation. Generates designs based on market research, creates mockups, and publishes to Shopify.

## Mockup Generation Settings (LOCKED - 2026-01-11)

### IMPORTANT: These parameters are LOCKED in `config/lifestyle-mockup-settings.json`
Do NOT modify without A/B testing. Based on high-converting Facebook ad research.

### Lifestyle Mockup Parameters
```json
{
  "shirtWidthPercent": 1.0,      // Shirt fills entire frame
  "shirtYOffset": 0,             // Centered vertically
  "designWidthPercent": 0.35,    // Design 35% of shirt width
  "designYOffset": 510,          // Design at chest level
  "outputSize": 1024,            // Always 1:1 square
  "bgThreshold": 50              // Removes dark grey backgrounds
}
```

### Visual Reference
See `output/coffee-lifestyle-v4.png` as the gold standard:
- Shirt fills frame (sleeves nearly touch edges)
- Dark background (charcoal/slate/dark wood)
- Props frame EDGES only (coffee beans, cup in corner)
- Clear center area for shirt

### Design Requirements (CRITICAL)
Designs MUST follow POD guidelines to avoid artifacts:
- NO borders, frames, boxes, or outlines
- Pure black background (#000000 or close)
- If design has decorative frame, it will show as rectangular artifact on mockup

### Background Generation Rules
All backgrounds MUST be:
- DARK (charcoal, slate, dark wood, dark concrete)
- Props on EDGES and CORNERS only
- Center 60% completely empty for shirt
- Top-down flatlay perspective

### Shirt Template
- Use: `backgrounds/blank-black-tee-transparent.png`
- Source: BALLN project template
- Size: 2048x2048 pixels

### CLI Usage (with correct params)
```bash
python3 scripts/mockup_generator.py <design> --lifestyle \
  -b <background> \
  -o <output> \
  -w 0.35 \
  -y 510 \
  --shirt-width 1.0 \
  --shirt-y 0 \
  --threshold 50
```

## Design Generation

### POD Guidelines (Always Applied)
All designs MUST follow these rules:
- **Format**: Single centered design, white on pure black (#000000) background
- **Typography**: Bold sans-serif, athletic block letters, stacked vertically (one word per line)
- **Text**: 2-4 words max, all caps, each word on separate line
- **Restrictions**:
  - NO borders, frames, boxes, or outlines
  - NO t-shirt mockup - isolated graphic only
  - NO duplicate/mirrored/tiled designs - ONE single design
  - NO side-by-side comparisons or variations
  - NO photorealistic elements - vector/graphic style only

### Custom Prompt Processing
Any user input is processed through `processCustomPrompt()` which:
1. Extracts design intent from natural language
2. Converts to 2-4 word POD-compliant text
3. Generates design brief following all POD rules
4. Passes to standard design pipeline

Example: "Make me a shirt about hodling through bear markets" → "BEAR MARKET SURVIVOR"

### Research Flow
1. DataForSEO Amazon API - sales data (what's selling)
2. Google Images - visual patterns (what it looks like)
3. Gemini - combine insights into design brief
4. Gemini 3 Pro Image Preview - generate design

## Category Backgrounds
Located in `backgrounds/` folder:
- `crypto-dark-tech-bg.png` - Blue glow + tech aesthetic
- `crypto-minimal-dark-bg.png` - Clean dark look
- `crypto-neon-gradient-bg.png` - Purple/blue cyberpunk
- `coffee-rustic-dark-nobg.png` - Dark wood + coffee beans
- `fitness-gym-floor.png` - Concrete + kettlebell
- `developer-desk.png` - Tech desk setup

## Key Files
- `scripts/mockup_generator.py` - Core mockup generation
- `scripts/generate_lifestyle_templates.js` - Background generation
- `src/services/designGenerator.js` - Design prompt building
- `src/services/designResearch.js` - Hybrid research flow
- `src/bot/commands/backgrounds.js` - Category background mappings
- `test-research.js` - Full flow test script

## Commands
```bash
# Test full research + design flow
node test-research.js <category>

# Test custom prompt -> POD pipeline
node test-custom-prompt.js "your custom prompt here" <category>

# Generate category backgrounds
node scripts/generate_lifestyle_templates.js <category>

# Create single mockup
python3 scripts/mockup_generator.py <design> --lifestyle -b <background> -o <output>

# Run ralph autonomous loop (macOS requires gnubin PATH)
PATH="/opt/homebrew/opt/coreutils/libexec/gnubin:$PATH" ralph --monitor
```

## Ralph Autonomous Development

Ralph is installed at `~/.ralph/` for autonomous code development loops.
On macOS, requires coreutils: `brew install coreutils tmux`

Usage:
1. Create PROMPT.md in project root with requirements
2. Run: `PATH="/opt/homebrew/opt/coreutils/libexec/gnubin:$PATH" ralph --monitor`
3. Monitor progress via tmux dashboard
