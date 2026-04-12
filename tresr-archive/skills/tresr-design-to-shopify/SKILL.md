---
name: tresr-design-to-shopify
description: Complete pipeline for generating a t-shirt design and getting it live on the TRESR Shopify store. Covers market research, Gemini generation, background removal, mockup compositing, Cloudinary upload, Shopify product creation, and variant-image linking.
---

# Skill: Design to Shopify (Idea → Live Product)

Complete pipeline for generating a t-shirt design and getting it live on the TRESR Shopify store.

## Prerequisites

- **Gemini API Key**: `GEMINI_API_KEY` in `.env` → `REDACTED_GEMINI_KEY=REDACTED`
- **Shopify Access Token**: `SHOPIFY_ACCESS_TOKEN` in `.env` → `REDACTED_SHOPIFY_TOKEN=REDACTED`
- **Shopify Store**: `becc05-b4.myshopify.com`
- **Cloudinary**: cloud `dqslerzk9`, API key `364274988183368`, secret `gJEAx4VjStv1uTKyi3DiLAwL8pQ`
- **Location ID**: `96616939805`
- **Theme ID**: `179374358813` (ONLY theme — all changes are LIVE)
- **Tools**: Node.js (sharp), Python3 (Pillow) — both available in sandbox

## Quick Reference

| Setting | Value |
|---------|-------|
| Price | $29.00 |
| Compare-at price | $42.50 |
| Colors | Black, Navy, White |
| Sizes | S, M, L, XL, 2XL |
| Variants per product | 15 (3 colors × 5 sizes) |
| Garment | Next Level 6410 (60/40 blend) |
| Blanks location | `tshirts-no-nfc-mvp-mocks/` (2000×2000 RGBA) |
| Mockup scale | 0.25 (design width = 500px on 2000px garment) |
| Mockup Y position | 520px (3" below collar) |
| Mockup X position | centered + 10px offset |
| Design output | `output/designs/{category}/` |
| Mockup output | `output/mockups/{category}/` |

## Step-by-Step Pipeline

### Step 0: Market Research (Pre-Generation)

**Before generating ANY design, validate the concept.** See `skills/tresr-design-research/SKILL.md` for the full process.

Quick validation checklist:
1. **web_search**: "site:etsy.com [concept] t-shirt" — are there listings with 100+ reviews?
2. **DataForSEO**: Does the keyword have 100+ monthly searches?
3. **Competitor check**: Are others selling this concept? (validation) But NOT the same angle? (differentiation)

If all 3 pass → proceed to Step 1. If not → pick a different concept.

### Step 1: Generate Design via Gemini

**Model**: `gemini-2.0-flash-exp-image-generation`
- Note: The `.env` comments mention `gemini-2.5-flash-image` and `imagen-4.0-generate-001` as alternatives
- The working scripts all use `gemini-2.0-flash-exp-image-generation`

**API Endpoint**:
```
POST https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key={GEMINI_API_KEY}
```

**TRESR Style Prefix** (for robot designs):
```
Create a t-shirt design illustration. Style: cute chibi robot character with clean black outlines, minimal color accents (1-2 accent colors max), bold chunky hand-lettered text, self-deprecating tech humor. White/transparent background. The design should be compact and centered, suitable for screen printing on a t-shirt. NO background, just the design elements floating on white.
```

**OpenClaw Style Prefix** (for lobster designs):
```
Create a t-shirt design illustration. Style: cute cartoon lobster character with white outlines (for dark shirts) or black outlines (for light shirts), minimal color accents, bold chunky hand-lettered text, playful tech humor. The lobster should be expressive and chibi-proportioned. White/transparent background. The design should be compact and centered, suitable for screen printing on a t-shirt. NO background, just the design elements floating on white.
```

**Request Body**:
```json
{
  "contents": [{"parts": [{"text": "<STYLE_PREFIX> <SPECIFIC_PROMPT>"}]}],
  "generationConfig": {
    "responseModalities": ["TEXT", "IMAGE"]
  }
}
```

**Response**: Image is in `candidates[0].content.parts[].inlineData.data` (base64 PNG).

**Script**: `node scripts/generate-design.js --prompt "..." --output "output/designs/category/name.png"`

**Rate limits**: ~3s delay between requests. Retry up to 3 times on failure.

### Step 2: Remove White Background

Use Python/Pillow to make white pixels transparent:

```python
from PIL import Image, ImageFilter
import numpy as np

img = Image.open("design.png").convert("RGBA")
data = np.array(img)

# Step 1: Remove anything above 180 brightness (aggressive — catches near-white and light gray)
r, g, b = data[:,:,0].astype(float), data[:,:,1].astype(float), data[:,:,2].astype(float)
brightness = (r + g + b) / 3
light_mask = brightness > 180
data[light_mask, 3] = 0

# Step 2: Erode alpha by 2px to remove any edge fringing
result = Image.fromarray(data)
alpha = result.split()[3]
alpha = alpha.filter(ImageFilter.MinFilter(5))  # Shrinks opaque area by ~2px
result.putalpha(alpha)
result.save("design-transparent.png")
```

**⚠️ CRITICAL**: The old threshold of 240 was too lenient — Gemini outputs often have off-white/light gray backgrounds (RGB 220-240) that create visible white borders on dark shirts. Use brightness > 180 + MinFilter erosion to guarantee clean edges.

### Step 3: Crop to Content

```python
from PIL import Image

img = Image.open("design-transparent.png")
bbox = img.getbbox()  # Returns (left, upper, right, lower) of non-transparent content
if bbox:
    img = img.crop(bbox)
    img.save("design-cropped.png")
```

### Step 4: Create Dark Shirt Variant (Invert)

For dark shirts (black, navy), invert dark outlines to white while preserving color accents:

```python
from PIL import Image
import numpy as np

img = Image.open("design-cropped.png").convert("RGBA")
data = np.array(img)
# Only invert pixels that are dark/black (not colored accents)
# Dark = all channels below threshold
threshold = 80
dark_mask = (data[:,:,0] < threshold) & (data[:,:,1] < threshold) & (data[:,:,2] < threshold) & (data[:,:,3] > 0)
data[dark_mask, 0] = 255
data[dark_mask, 1] = 255
data[dark_mask, 2] = 255
result = Image.fromarray(data)
result.save("design-inverted.png")
```

**Key**: Only invert truly dark pixels. Color accents (red robot eyes, green accents, etc.) stay as-is.

### Step 5: Composite Mockups

Place design on garment blanks. Use the **light version** (black outlines) on white shirts, **inverted version** (white outlines) on black/navy shirts.

**Blank garments**: `/data/clients/tresr/tshirts-no-nfc-mvp-mocks/`
- `black.png` — 2000×2000 RGBA
- `navy.png` — 2000×2000 RGBA
- `white.png` — 2000×2000 RGBA

**Placement math**:
```python
garment_width = 2000
design_scale = 0.25  # 25% of garment width = 500px
design_width = int(garment_width * design_scale)  # 500
# Maintain aspect ratio
design_height = int(original_height * (design_width / original_width))
x = (garment_width - design_width) // 2 + 10  # centered + 10px offset
y = 520  # 3" below collar
```

```python
from PIL import Image

garment = Image.open("tshirts-no-nfc-mvp-mocks/black.png").convert("RGBA")
design = Image.open("design-inverted.png").convert("RGBA")  # inverted for dark shirts

# Scale
new_w = 500
new_h = int(design.height * (new_w / design.width))
design = design.resize((new_w, new_h), Image.LANCZOS)

# Position
x = (2000 - new_w) // 2 + 10
y = 520

# Composite
garment.paste(design, (x, y), design)  # 3rd arg = alpha mask
garment.save("mockup-black.png")
```

Repeat for all 3 colors (use inverted design for black/navy, original for white).

### Step 6: Upload to Cloudinary

```bash
curl -s -X POST "https://api.cloudinary.com/v1_1/dqslerzk9/image/upload" \
  -F "file=@mockup-black.png" \
  -F "upload_preset=ml_default" \
  -F "public_id=tresr/products/{handle}_black_front" \
  -F "api_key=364274988183368" \
  -F "timestamp=$(date +%s)" \
  # Note: For signed uploads, also need signature from API secret
```

**Simpler approach** — use unsigned upload preset or sign with API secret:

```python
import cloudinary
import cloudinary.uploader

cloudinary.config(
    cloud_name="dqslerzk9",
    api_key="364274988183368",
    api_secret="gJEAx4VjStv1uTKyi3DiLAwL8pQ"
)

result = cloudinary.uploader.upload("mockup-black.png",
    public_id=f"tresr/products/{handle}_black_front",
    overwrite=True
)
print(result["secure_url"])
```

Or just use Shopify's image upload (attach images directly to product — Shopify hosts them on CDN).

### Step 7: Create Shopify Product

**API Endpoint**:
```
POST https://becc05-b4.myshopify.com/admin/api/2024-01/products.json
Header: X-Shopify-Access-Token: REDACTED_SHOPIFY_TOKEN=REDACTED
```

**Product Payload**:
```json
{
  "product": {
    "title": "Already Fumbled 2026 Tee",
    "body_html": "<p>Relatable new year humor for those who started 2026 with high hopes and immediately tripped. Cute chibi robot design, premium Next Level 6410 tee.</p>",
    "vendor": "TRESR",
    "product_type": "T-Shirt",
    "tags": "ai-designed, meme-humor, trending, funny-tee, print-on-demand",
    "status": "active",
    "options": [
      {"name": "Color", "values": ["Black", "Navy", "White"]},
      {"name": "Size", "values": ["S", "M", "L", "XL", "2XL"]}
    ],
    "variants": [
      {"option1": "Black", "option2": "S", "price": "29.00", "compare_at_price": "42.50", "inventory_management": null, "requires_shipping": true},
      {"option1": "Black", "option2": "M", "price": "29.00", "compare_at_price": "42.50", "inventory_management": null, "requires_shipping": true},
      ...
    ],
    "images": [
      {"src": "https://res.cloudinary.com/dqslerzk9/image/upload/...", "alt": "Already Fumbled 2026 Tee - Black"},
      {"src": "https://res.cloudinary.com/dqslerzk9/image/upload/...", "alt": "Already Fumbled 2026 Tee - Navy"},
      {"src": "https://res.cloudinary.com/dqslerzk9/image/upload/...", "alt": "Already Fumbled 2026 Tee - White"}
    ]
  }
}
```

Generate all 15 variants (3 colors × 5 sizes):
```javascript
const colors = ['Black', 'Navy', 'White'];
const sizes = ['S', 'M', 'L', 'XL', '2XL'];
const variants = [];
for (const color of colors) {
  for (const size of sizes) {
    variants.push({
      option1: color,
      option2: size,
      price: '29.00',
      compare_at_price: '42.50',
      inventory_management: null,
      requires_shipping: true,
      weight: 0.5,
      weight_unit: 'lb'
    });
  }
}
```

### Step 8: Add SEO Meta Description (CRITICAL!)

**This was identified as a critical missing piece** — all recent products lacked meta descriptions, killing SEO.

After creating the product, set the metafield:

```
PUT https://becc05-b4.myshopify.com/admin/api/2024-01/products/{product_id}.json
```

```json
{
  "product": {
    "id": "{product_id}",
    "metafields_global_title_tag": "Already Fumbled 2026 - Funny New Year T-Shirt | TRESR",
    "metafields_global_description_tag": "Already fumbled 2026? Same. This cute robot tee captures the vibe of starting the year with zero momentum. Premium Next Level 6410, $29. Free shipping vibes."
  }
}
```

**Meta description formula**: `{Relatable hook}. {Product description}. {Material/price}. {CTA or brand}.`

### Step 9: Assign Variant Images

After product creation, assign the correct mockup image to each color variant:

```
PUT https://becc05-b4.myshopify.com/admin/api/2024-01/products/{product_id}.json
```

Set `image_id` on each variant to match its color's mockup image.

### Step 9b: Generate Lifestyle Mockups

**After creating the product with flat garment mockups, generate lifestyle mockups.**

See `skills/tresr-lifestyle-mockup-generator/SKILL.md` for the full process.

Quick version:
1. Generate lifestyle flat-lay mockup via Gemini (wood background, props, shadows)
2. Upload to Cloudinary
3. Add as primary image on Shopify product (position 1, push flat mockup to position 2)
4. Generate 2-3 mockup variants for A/B testing in Meta Ads

### Step 9c: Generate Design Closeup Hero Image

**MANDATORY for every product.** The collection grid shows image 1, which must be a punched-in design closeup (not the full shirt).

```python
from PIL import Image
import numpy as np

# Load the black mockup (best contrast)
mockup = Image.open("mockup-black.png").convert("RGBA")
data = np.array(mockup)

# Crop the design area (where we placed it: x=center, y=520, ~500px wide)
# Detect non-garment pixels in the design region
region = data[420:1050, 650:1350]  # Approximate design bounding box
# Find actual content bounds within region
alpha_or_diff = np.any(region[:,:,:3] != region[0,0,:3], axis=2)
rows = np.any(alpha_or_diff, axis=1)
cols = np.any(alpha_or_diff, axis=0)
if rows.any() and cols.any():
    rmin, rmax = np.where(rows)[0][[0,-1]]
    cmin, cmax = np.where(cols)[0][[0,-1]]
    # Add padding
    pad = 40
    design_crop = mockup.crop((650+cmin-pad, 420+rmin-pad, 650+cmax+pad, 420+rmax+pad))
else:
    # Fallback: center crop
    design_crop = mockup.crop((600, 400, 1400, 1100))

# Place on dark background
bg = Image.new("RGBA", (1000, 1000), (26, 26, 26, 255))
# Resize design to fit
design_crop.thumbnail((900, 900), Image.LANCZOS)
x = (1000 - design_crop.width) // 2
y = (1000 - design_crop.height) // 2
bg.paste(design_crop, (x, y), design_crop if design_crop.mode == "RGBA" else None)
bg.save("design-hero.png")
```

Upload as the FIRST image on the Shopify product. The Broadcast theme's hover swap (image_hover_enable=True) will show the full mockup on hover.

**Image order for every product:**
1. Design closeup hero (1000x1000, dark bg) — shown in collection grid
2. Black mockup — shown on hover + product page
3. Navy mockup
4. White mockup

### Step 10: Smart Collection Tags

Products automatically appear in smart collections based on tags:

| Collection | Tag needed |
|-----------|-----------|
| AI Designed | `ai-designed` |
| Developer | `developer` |
| Coffee Lovers | `coffee-lovers` |
| Meme & Humor | `meme-humor` |
| Entrepreneur | `entrepreneur` |
| Introvert/Bookworm | `introvert-bookworm` |
| Cat Lovers | `cat-lovers` |
| Dog Lovers | `dog-lovers` |
| Crypto/Web3 | `crypto-web3` |
| OpenClaw 🦞 | `openclaw` |

Always include `ai-designed` + the specific category tag.

## MANDATORY: Visual QA Step (Before Upload)

**After generating ANY design image, you MUST visually verify it before proceeding to mockup/upload.**

Use the `image` tool to analyze the generated PNG:

```
image(image="path/to/design.png", prompt="Read ALL text on this t-shirt design exactly as it appears. List every word and phrase. Are there any duplicate or repeated words? Are there any misspellings? Is any text cut off or illegible? Report issues.")
```

**Hard-fail the design if:**
- Any word appears more than once (e.g., "FUMBLED" twice)
- Any phrase is duplicated (e.g., subtitle printed twice)
- Text is misspelled
- Text is cut off or illegible
- Words overlap or are garbled

**If a design fails visual QA:**
1. Do NOT upload it
2. Regenerate with a refined prompt that explicitly states: "Each word must appear EXACTLY ONCE. Do not repeat any text."
3. Re-run visual QA on the new image
4. Max 3 regeneration attempts — if still failing, flag for human review

**This step is NON-NEGOTIABLE.** Gemini frequently duplicates text in generated images. The bot cannot skip this step under any circumstances.

---

## Design QA Checklist (22-Point Rubric)

Full rubric at: `docs/design-qa-rubric.md`

**8 Hard-Fail Checks** (any failure = design does not ship):
1. Clean black outlines, no gradients — flat color fills only
2. DTF/screenprint ready — max 6 spot colors, no fine details
3. White background fully removed — no white box artifacts
4. Text readable on black shirt
5. Text readable on navy shirt
6. Outlines visible on dark shirts (inverted to white)
7. Color accents preserved during inversion (red stays red, not cyan)
8. Design has enough contrast on white shirt

**14 Quality Checks** (scored 1-5, min avg 3.5):
9-22: Transparency, placement, thumbnail legibility, kerning, text-to-art ratio, appeal, style consistency, humor clarity, character consistency, color palette, content crop, no duplicate text, variant completeness

## Complete Automation Script

The full pipeline script lives at: `skills/tresr-design-to-shopify/generate-and-publish.py`

Usage:
```bash
python3 skills/tresr-design-to-shopify/generate-and-publish.py \
  --name "Already Fumbled 2026" \
  --prompt "Robot dropping a calendar page for 2026 while tripping. Text: ALREADY FUMBLED 2026" \
  --category meme-humor \
  --meta-description "Already fumbled 2026? Same. Cute robot tee for anyone who started the year face-first."
```

## Iteration Mode: Winning Product → 20-30 Variations

When a product shows sub-$1 CPC in Meta Ads testing (see `skills/tresr-meta-ads-testing/SKILL.md`), create variations:

```python
def iterate_winner(winning_product_handle, category, variation_count=25):
    """Generate 20-30 variations of a winning design concept."""
    
    # 1. Analyze what made it work
    # - Theme/joke
    # - Color palette  
    # - Text style
    # - Character pose
    
    # 2. Generate variations:
    variation_types = [
        "same joke, different character pose",
        "same theme, different punchline",
        "same style, related joke",
        "sequel/follow-up design",
        "holiday/seasonal version",
        "opposite color scheme",
        "minimalist version",
        "maximalist version",
        "typography-only version",
        "different character (robot → lobster, etc.)",
    ]
    
    # 3. For each variation, run through full pipeline (Steps 1-9b)
    # 4. Launch as batch in tresr-meta-ads-testing Cycle 1
```

**Key**: Variations should be DIFFERENT ENOUGH to test separately but SIMILAR ENOUGH to the winning concept that they inherit its appeal.

## Batch Mode: 10-15 Designs Per Session

For daily design creation (minimum recommended cadence):

```python
def batch_create(concepts, category):
    """Create 10-15 designs in one session."""
    
    # concepts = list of validated concepts from tresr-design-research skill
    # Each concept: {"name": "...", "prompt": "...", "meta_desc": "..."}
    
    for concept in concepts[:15]:  # Cap at 15 per batch
        # Step 0: Already validated (skip)
        # Step 1: Generate design
        # Step 2-4: Process (bg removal, crop, invert)
        # Step 5: Composite mockups
        # Step 6: Upload to Cloudinary
        # Step 7: Create Shopify product
        # Step 8: Add SEO meta description
        # Step 9: Assign variant images
        # Step 9b: Generate lifestyle mockup
        # Step 10: Tag for collections
        
        # Rate limit: 3-5 second delay between Gemini calls
        time.sleep(5)
    
    print(f"Batch complete: {len(concepts)} designs created")
```

**Daily target**: 10-15 new designs. The top 5% will drive majority of revenue. Need 100+ to find those winners.

## Troubleshooting

- **Gemini 429 (rate limit)**: Wait 5-10 seconds, retry. Max 3 retries.
- **Gemini returns text only, no image**: The model sometimes refuses. Rephrase prompt to be less complex. Remove any potentially sensitive content.
- **White bg not fully removed**: Lower the threshold (try 230 instead of 240). Some Gemini outputs have off-white backgrounds.
- **Design too small on mockup**: Increase scale from 0.25 to 0.30.
- **Shopify 422 error**: Usually duplicate handle. Add a suffix or check existing products.
- **Missing variants**: Shopify requires `options` to be declared before variants reference them.
- **Images not showing**: Shopify takes a few seconds to process uploaded images. Wait and refresh.

## MANDATORY: Visual Verification of Live Changes

**After ANY theme change, product image update, or CSS modification, you MUST visually verify the result before confirming to Jon.**

Use the `browser` tool with Playwright to screenshot the affected page:

```
browser(action="screenshot", targetUrl="https://tresr.com/collections/ai-designed", target="host")
```

Or use `browser(action="snapshot")` to check the DOM state.

**Verification checklist:**
- [ ] Changes are actually visible on the live site (not just pushed to API)
- [ ] No visual regressions (broken layouts, overlapping elements, cut-off content)
- [ ] Mobile responsive (check at mobile viewport if relevant)
- [ ] Design images are legible and properly displayed
- [ ] No CSS conflicts with existing styles

**If you cannot verify visually (browser unavailable):**
1. Use `web_fetch` to check page HTML structure
2. Use `image` tool to analyze a screenshot if one can be captured
3. Do NOT confirm to Jon that changes are working — say "pushed but unable to visually verify, please check"

**NEVER tell Jon something is working without seeing it yourself.**
