---
name: tresr-lifestyle-mockup-generator
description: Generate lifestyle flat-lay mockups with correct design proportions. Uses BALLN composite approach — pre-rendered backgrounds + transparent blank tee + raw design overlay. Gemini NEVER touches the design.
---

# Lifestyle Mockup Generator

## Why This Matters
Flat garment mockups on white backgrounds kill conversions. Lifestyle mockups on textured backgrounds with props cut CPC by 50% and improve ROAS 3-5x. This is the #1 lever for conversion.

## CRITICAL: BALLN Composite Approach (Locked In Feb 11, 2026)

**NEVER send designs to Gemini for rendering.** Gemini distorts text, changes proportions, and adds artifacts.

**The process is pure compositing — zero AI involvement in the final image:**

### Pipeline

1. **Background** — Pre-rendered lifestyle flat-lay backgrounds with props (3 variants per category, stored in `internal/tresr-pod-bot/backgrounds/active/`)
2. **Blank Tee** — Transparent PNG of a Next Level 6410 laid flat (`internal/tresr-pod-bot/backgrounds/blank-black-tee-transparent.png`)
3. **Raw Design** — Transparent PNG from Cloudinary (`tresr/print-ready/{slug}-for-dark.png`)
4. **Composite** — Place design on blank tee → scale tee to fill frame → overlay on background

### Compositing Parameters

```python
# Design placement on blank tee (2048x2048)
design_width = int(tee_width * 0.25)  # 25% of tee width
design_x = (tee_width - design_width) // 2  # centered
design_y = 520  # ~3 inches below collar

# Tee on background (1024x1024)
tee_scale = 100%  # fill full frame
tee_position = (0, 0)  # centered/full bleed
```

### Key Rules

- **ALWAYS use the transparent blank tee** (`blank-black-tee-transparent.png`) — NOT the white bg version. The white bg version requires background removal which clips light-colored design pixels.
- **NEVER remove backgrounds programmatically** from the tee — use the pre-made transparent version
- **Design is placed ONCE** on the blank tee, then composited onto the background. No re-rendering.
- **Design fidelity = 100%** because the raw PNG is never touched by AI

### Category Backgrounds

Located in `internal/tresr-pod-bot/backgrounds/active/`:

| Category | Files | Surface/Style |
|----------|-------|--------------|
| Coffee | 1.1, 1.2, 1.3 | Rustic wood, coffee props |
| Fitness | 2.1, 2.2, 2.3 | Gym/active lifestyle |
| Crypto | 3.1, 3.2, 3.3 | Dark/techy |
| Gaming | 4.1, 4.2, 4.3 | Gaming setup |
| Developer | 5.1, 5.2, 5.3 | Desk with keyboard/code |
| Dog Lovers | 6.1, 6.2, 6.3 | Warm, pet-friendly |
| Mental Health | 7.1, 7.2, 7.3 | Calm/cozy |
| Entrepreneur | 8.1, 8.2, 8.3 | Dark marble, luxury |
| Cat Lovers | 9.1, 9.2, 9.3 | Light wood, cat toys |
| Nostalgia | 10.1, 10.2, 10.3 | Retro/vintage |
| Meme/Humor | 11.1, 11.2, 11.3 | Concrete, casual |

**Missing categories** (need new backgrounds): OpenClaw, Introvert/Bookworm, AI Trending. Generate with Gemini using the same style as existing backgrounds — blank center, props around edges, overhead flat-lay.

### Raw Design Files — Selection Priority

**ALWAYS pick the correct design version.** Many designs have multiple iterations (original, fixed, clean). Wrong version = wrong product on the store.

**Source priority (highest to lowest):**

1. **Cloudinary `tresr/print-ready/{slug}-for-dark.png`** — Use if the file is a clean transparent design (NOT a full mockup). Verify by checking dimensions and visually inspecting.
2. **Local `output/designs/{category}/` folder** — Look for `*-clean-inverted.png` > `*-fixed-inverted.png` > `*-inverted.png` > `*-dark.png` (prefer "clean" and "fixed" versions — they have corrections applied)
3. **Local `designs/` folder** — `{name}-dark.png` files (older designs)

**⚠️ CRITICAL: Design version verification**
- Many designs have multiple iterations (e.g., `job-security-vs-ai.png`, `job-security-vs-ai-fixed.png`, `job-security-vs-ai-clean.png`)
- **Always use the latest/best version** — look for `clean` > `fixed` > original in the filename
- **Visually verify** the design matches what's on the live store BEFORE compositing
- If the design has known issues fixed in a later version, NEVER use the old one
- When in doubt, check the non-inverted (for-light) version — it's easier to visually verify content

**⚠️ CRITICAL: Cloudinary print-ready audit needed**
- As of Feb 11, 2026, some Cloudinary `tresr/print-ready/` files contain full flat mockups (shirt + design) instead of isolated transparent designs — uploaded by the buggy `scripts/generate-print-ready.js`
- **Always verify** a Cloudinary file is actually a clean transparent design before using it
- A proper print-ready file: ~800-1024px, transparent background, just the design graphic
- A bad file: 2048px, shows a full t-shirt with design on a surface background

**Background removal for local files:**
Local `-dark.png` and `-inverted.png` files typically have white backgrounds. Remove with ImageMagick floodfill from corners:
```bash
convert input.png -fuzz 15% -fill none \
  -draw 'color 0,0 floodfill' \
  -draw 'color W,0 floodfill' \
  -draw 'color 0,H floodfill' \
  -draw 'color W,H floodfill' \
  output-transparent.png
```
Where W = width-1, H = height-1. **Do NOT use global brightness threshold for white removal** — it destroys gray/mid-tone design elements.

**Dark ink removal for black tee designs:**
Designs for dark shirts may contain black/dark fill elements (shadows, body fills, screen bezels) that would be invisible on a real black tee but look wrong in mockups. After removing white bg, strip dark pixels:
```python
from PIL import Image
img = Image.open('transparent-design.png').convert('RGBA')
pixels = img.load()
for y in range(img.height):
    for x in range(img.width):
        r, g, b, a = pixels[x, y]
        if a > 0 and (r + g + b) / 3 < 80:  # dark elements
            pixels[x, y] = (r, g, b, 0)
img.save('clean-design.png')
```
This leaves only white outlines + colored accents — matching what would actually be printed via DTF on a black tee. **Always apply this step for for-dark designs.**

**50 original designs** have proper print-ready files on Cloudinary. 21 newer designs need proper transparent versions generated from local files.

### Design Mapper

`scripts/fulfillment/design-mapper.js` contains the master `DESIGN_MAP` mapping every product handle → design slug → category → Cloudinary path.

### Image Position Standard (Shopify)

1. **Position 1** = Lifestyle mockup (this composite)
2. **Position 2** = Black flat mockup
3. **Position 3** = Navy flat mockup
4. **Position 4** = White flat mockup

Collection pages show Position 1. Product pages show all. Broadcast theme hover swaps Position 1 → Position 2.

## Generating New Backgrounds

If a category needs new backgrounds, use Gemini with this prompt pattern:

```
Create a photorealistic overhead flat-lay background for a product photo.
SURFACE: [category-specific surface]
PROPS arranged around edges, leaving EMPTY CENTER (~60% of frame): [category-specific props]
LIGHTING: [warm/cool based on category]
CRITICAL: Center must be COMPLETELY EMPTY — just the surface. No shirt.
```

Then save to `internal/tresr-pod-bot/backgrounds/active/` following the naming convention.

## Batch Script

For batch processing all products, the flow is:
1. Get all products from Shopify (paginate with `since_id`)
2. Match to `DESIGN_MAP` for category + design slug
3. Download print-ready design from Cloudinary
4. Pick a random category background (1-3)
5. Composite: design → blank tee → background
6. Upload to Shopify as position 1

## History

- **Pre-Feb 11**: Sent flat mockups to Gemini for lifestyle scenes. Gemini enlarged designs to 85-90% of shirt front, distorted text, added artifacts.
- **Feb 11 AM**: Tried stronger Gemini prompts (5 iterations). Design fidelity improved but never perfect — Gemini always reinterprets.
- **Feb 11 PM**: Jon directed to use BALLN approach — pure compositing. Existing backgrounds + transparent tee + raw design = pixel-perfect results. Locked in as the standard process.
