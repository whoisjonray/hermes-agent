---
name: tresr-product-image-pipeline
description: Complete 5-position product image generation workflow for TRESR product pages - lifestyle composite, punchin closeup, and 3 flat mockups with Cloudinary upload and Shopify sync.
---

# Product Image Pipeline (5 Positions)

Complete automated workflow for generating all 5 product images for TRESR.com.

## Image Positions

1. **Lifestyle Composite** - Design composited onto category lifestyle background (1024x1024)
2. **Punchin Closeup** - 3:4 portrait, design on black background (2048x2732)
3. **Black Flat Mockup** - Design on black tee template (2048x2048)
4. **Navy Flat Mockup** - Design on navy tee template (2048x2048)
5. **White Flat Mockup** - Design on white tee template (2048x2048)

## Credentials

```bash
# Shopify
SHOPIFY_ACCESS_TOKEN=REDACTED
SHOPIFY_STORE=becc05-b4.myshopify.com
THEME_ID=179374358813

# Cloudinary
CLOUDINARY_CLOUD_NAME=dqslerzk9
CLOUDINARY_API_KEY=REDACTED
CLOUDINARY_API_SECRET=REDACTED

# Gemini (for design generation when source files are missing)
GEMINI_API_KEY=REDACTED
# Model: gemini-2.0-flash-exp-image-generation
```

## Locked Settings (Updated 2026-02-12)

**DO NOT modify without user approval:**

### Flat Mockup & Lifestyle Settings
- **Design size: 27% of tee width** (553px on 2048px templates)
- **Y position: 480px** from top (chest level)
- **Auto-trim: threshold 20** (`sharp.trim({ threshold: 20 })`) - removes whitespace/transparent padding BEFORE scaling
- **Resize fit: 'inside'** - constrains both width AND height to maintain aspect ratio
- All templates: 2048x2048
- Interpolation: Lanczos3

### Punchin Closeup Settings
- Canvas: 2048x2732 (3:4 portrait)
- **Design scale: 95% of canvas** (fit within bounds)
- Auto-trim before scaling (same threshold 20)
- Solid black background
- Design centered

### Lifestyle Composite Settings
- Same 27%/Y=480/auto-trim as flat mockups
- Tee resized to fit background (1024x1024)
- Output size: 1024x1024 (1:1 square)

### Why These Settings
- **Auto-trim is critical**: Source PNGs often have massive whitespace padding (e.g., 411x437 actual artwork inside 1024x1024 canvas). Without trim, designs appear tiny or oversized depending on padding.
- **27% was calibrated after trim**: Started at 40% (pre-trim), went to 34% (post-trim too big), settled on 27%.
- **Y=480 positions design at chest level**: Tested from 410 to 480, locked at 480 after trim.
- **95% punchin** fills the frame properly for 1:1 designs.

## Print-Ready File Convention

All source designs go in `output/print-ready/` with this naming:

```
{slug}-for-dark.png   → Light/inverted design (goes ON dark tees: black, navy)
{slug}-for-light.png  → Dark/normal design (goes ON light tees: white)
```

**CRITICAL: Both files MUST have transparent backgrounds (alpha channel).** If a source design has a solid black or white background, you MUST remove it before placing in print-ready.

## Quick Start

```bash
cd "/Users/user/Documents/Cursor Clients/client-tresr"

# Step 1: Ensure print-ready designs exist with transparent backgrounds
ls output/print-ready/my-design-for-dark.png
ls output/print-ready/my-design-for-light.png

# Step 2: Generate all 5 images (test mode - saves locally for review)
node scripts/image-pipeline/generate-all-product-images.js \
  "output/print-ready/my-design-for-dark.png" \
  "output/print-ready/my-design-for-light.png" \
  "category-name" \
  "my-design" \
  --test

# Step 3: Review images in temp/
open temp/my-design-*.png

# Step 4: Upload to Cloudinary + update Shopify
node scripts/image-pipeline/update-shopify-product-images.js \
  "my-design-tee" \
  "my-design"
```

## Complete Workflow: New Product from Scratch

### Phase 1: Research & Design Creation

**If design already exists locally:**
1. Check `designs/production/raw/` for the raw design
2. Check `designs/production/inverted/` for the inverted variant
3. Check `output/designs/{category}/` for dark/light variants

**If design needs to be created (Gemini API):**
```javascript
const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${GEMINI_API_KEY}`,
    {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ["TEXT", "IMAGE"] }
        })
    }
);
```

**Design prompt tips:**
- Always specify "completely transparent background (PNG with alpha)"
- For dark tee variant: "white/light text, suitable for printing on a dark t-shirt"
- For light tee variant: "black/dark text, suitable for printing on a white/light t-shirt"
- Describe the character, text, and layout precisely based on the existing design
- Gemini outputs 1024x1024 images

**CRITICAL: Line-art / outlined style (breathable fabric rule)**
- Designs MUST use an outlined/line-art illustration style — NOT solid filled blocks of color
- The transparent background should show through INSIDE the design (between lines, inside characters, etc.)
- Think: white outlines and strokes on transparent bg, NOT solid white-filled shapes
- This lets the fabric "breathe through" the design when printed (less ink, better feel, better print quality)
- Reference existing TRESR designs: "404 Social Skills Not Found", "Vibe Coder Needs a Debugger", "My Therapist Is a Chatbot" — all use outlined robot characters with transparent gaps
- Prompt must include: "line-art style, outlined illustration, NOT solid filled shapes, transparent gaps between lines so fabric shows through"
- NEVER generate designs with large solid color blocks or fully filled-in characters

### Phase 2: Prepare Print-Ready Files

**CRITICAL STEP: Background Removal — Green-Screen Chroma Key Method**

Gemini cannot reliably generate transparent PNGs. White-on-white or dark-on-dark designs make threshold-based removal impossible without destroying design elements.

**SOLUTION: Generate on bright green (#00FF00) chroma key background, then remove green.**

Step 1: In your Gemini prompt, always include:
`"on a BRIGHT GREEN background (hex #00FF00, pure green chroma key background). This green is ONLY for removal later."`

Step 2: Remove the green:

```javascript
const sharp = require('sharp');

async function removeGreenScreen(inputPath, outputPath) {
    const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const nd = Buffer.from(data);
    
    for (let i = 0; i < nd.length; i += 4) {
        const r = nd[i], g = nd[i+1], b = nd[i+2];
        if (g > 150 && r < 150 && b < 150) {
            nd[i+3] = 0; // Make transparent
        }
    }
    
    await sharp(nd, { raw: { width: info.width, height: info.height, channels: 4 } })
        .png().toFile(outputPath);
}
```

**Why this works:** White design elements (R=255,G=255,B=255) don't match the green filter. Expect 85-95% transparency for proper line-art designs.

**Legacy method (black/white bg removal) — only if chroma key unavailable:**

```javascript
async function removeBackground(inputPath, outputPath, bgColor) {
    const { data, info } = await sharp(inputPath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const nd = Buffer.from(data);
    const threshold = 35;
    for (let i = 0; i < nd.length; i += 4) {
        const r = nd[i], g = nd[i+1], b = nd[i+2];
        if (bgColor === 'black') {
            if (r < threshold && g < threshold && b < threshold) nd[i+3] = 0;
        } else {
            if (r > (255-threshold) && g > (255-threshold) && b > (255-threshold)) nd[i+3] = 0;
        }
    }
    await sharp(nd, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toFile(outputPath);
}
```

⚠️ Black/white removal will eat design elements matching the bg color. Use green-screen method instead.

**For creating inverted (for-dark) from a dark-text-only design:**
```javascript
// Remove white bg, then invert non-transparent pixels
for (let i = 0; i < data.length; i += 4) {
    if (data[i+3] > 0) { // Only invert non-transparent
        data[i] = 255 - data[i];       // R
        data[i+1] = 255 - data[i+1];   // G
        data[i+2] = 255 - data[i+2];   // B
    }
}
```

**Verification checklist before processing:**
- `sips --getProperty hasAlpha file.png` should return `yes`
- Design should NOT have a visible colored rectangle when viewed
- Auto-trim in the pipeline handles remaining edge padding

### Phase 3: Generate & Upload

```bash
# Generate (test mode)
node scripts/image-pipeline/generate-all-product-images.js \
  "output/print-ready/{slug}-for-dark.png" \
  "output/print-ready/{slug}-for-light.png" \
  "{category}" \
  "{slug}" \
  --test

# Review, then upload
node scripts/image-pipeline/update-shopify-product-images.js \
  "{product-handle}" \
  "{slug}"
```

### Phase 4: Verify on Shopify

Product URL: `https://tresr.com/products/{product-handle}`

Check:
- Lifestyle composite shows as hero image (position 1)
- Design is properly positioned on chest (not too high, low, big, or small)
- No background rectangle visible on any tee color
- Color variant swatches switch to correct flat mockup
- Punchin shows design filling the frame

## Slug Mapping

Some product handles don't match design slugs. The batch script uses `SLUG_OVERRIDES`:

```javascript
const SLUG_OVERRIDES = {
    'my-neural-network-runs-on-coffee-and-existential-dread': 'neural-network-coffee',
    'passed-the-turing-test-failed-the-vibe-check': 'turing-test-vibe-check',
    'pov-youre-an-ai-and-its-monday': 'pov-ai-monday',
    'openclaw-classic-claw-tee': 'openclaw-classic',
    'security-by-trusting-a-lobster-tee': 'security-by-lobster',
    'i-think-therefore-i-wait-do-i': 'i-think-therefore',
    'openclaw-tee': 'dot-openclaw',
    '404-motivation-not-found-tee': '404-motivation',
    'job-security-vs-ai-tee': 'job-security-vs-ai-clean',
    'it-works-on-my-reef-tee': 'lobster-debugging',
    'my-conversion-rate-is-a-rounding-error-tee': 'conversion-rate-fixed',
    'powered-by-coffee-and-existential-dread-tee': 'coffee-and-dread',
};
```

**Default slug derivation:** Strip `-tee` suffix from handle.
E.g., `cat-servant-tee` → `cat-servant`

## Category Backgrounds

| Category | Background File | Used For |
|----------|----------------|----------|
| cat-lovers | 9.1-cat-lovers-bg.png | Cat-themed tees |
| coffee-lovers | 1.1-coffee-bg.png | Coffee-themed tees |
| crypto-web3 | 3.1-crypto-bg.png | Crypto/web3 tees |
| developer | 5.1-developer-bg.png | Dev/coding tees |
| dog-lovers | 6.1-dog-lovers-bg.png | Dog-themed tees |
| entrepreneur | 8.1-entrepreneur-bg.png | Business/startup tees |
| fitness-gym | 2.1-fitness-bg.png | Fitness tees |
| introvert-bookworm | 10.1-nostalgia-bg.png | Introvert/book tees |
| meme-humor | 11.1-meme-humor-bg.png | Meme/humor tees |
| gaming | 4.1-gaming-bg.png | Gaming tees |
| mental-health | 7.1-mental-health-bg.png | Mental health tees |

**Category mapping aliases:**
```javascript
'introvert': 'meme-humor',
'openclaw': 'developer',
'lobster': 'developer',
'unknown': 'meme-humor',
```

## Batch Processing

Use `scripts/image-pipeline/batch-process-collection.js` for bulk processing:

```bash
node scripts/image-pipeline/batch-process-collection.js
```

Key features:
- `DONE` set: Products already completed (skip)
- `SLUG_OVERRIDES`: Maps handles to design slugs
- `CATEGORY_MAP`: Maps categories to background files
- Uses test mode (saves locally) then uploads via `updateShopifyProductImages`
- 1-second delay between products to avoid rate limiting
- Reports processed/skipped/failed counts

## Finding Missing Design Files

When a product is missing print-ready files, search these locations in order:

1. `output/print-ready/` - May exist under a different slug
2. `output/designs/{category}/` - Dark/light variants (e.g., `{slug}-tee-dark.png`, `{slug}-tee-light.png`)
3. `designs/production/raw/` - Raw design (use as for-light)
4. `designs/production/inverted/` - Inverted design (use as for-dark)
5. `designs/archive/2026-02-12/designs/` - Archived designs (may have `{slug}-dark.png`)
6. `designs/` root - Original design files
7. Shopify product images - Download existing punchin/flat mockups as reference
8. Cloudinary - Search `tresr/designs/` folder
9. **Last resort: Regenerate with Gemini API** using the existing Shopify images as visual reference

## Variant-Image Linking & Initial Page Load

The upload script automatically links color variants to their matching flat mockup images via Shopify's `image_id` on each variant.

**Theme fix (already applied to live theme)**: `sections/product.liquid` line 10:
```liquid
assign featured_media = product.featured_media
```
(Changed from `current_variant.featured_media | default: product.featured_media`)

This ensures the lifestyle composite (position 1) always shows as hero on page load, regardless of pre-selected variant. Color swatching still works via theme JS.

**DO NOT revert** this change. It's critical for ad-to-page congruency.

## Common Issues & Fixes

### Design shows as colored rectangle on tee
**Cause:** Source design has a solid background (no transparency).
**Fix:** Remove background using the `removeBackground()` function above. Check with `sips --getProperty hasAlpha`.

### Design too big/small on tee
**Cause:** Source PNG has inconsistent whitespace padding.
**Fix:** Auto-trim handles this (`sharp.trim({ threshold: 20 })`). If still wrong, the 27% setting was calibrated for trimmed designs.

### Design positioning is off across different products
**Cause:** Different amounts of whitespace in source PNGs.
**Fix:** Auto-trim normalizes this. All designs get trimmed to actual artwork bounds before the 27% scaling is applied.

### Punchin looks too small in frame
**Cause:** Old 80% setting or excessive padding.
**Fix:** Pipeline uses 95% of canvas with auto-trim.

### Shopify shows old images after upload
**Cause:** Cloudinary CDN caching.
**Fix:** Cloudinary uploads use `overwrite: true, invalidate: true`. May take a few minutes to propagate.

### Batch script skips products
**Cause:** No matching print-ready files found for the design slug.
**Fix:** Check SLUG_OVERRIDES mapping. Create print-ready files from raw/inverted sources.

## Related Scripts

- `scripts/image-pipeline/generate-all-product-images.js` - Orchestrator (all 5 positions)
- `scripts/image-pipeline/generate-lifestyle-composite.js` - Position 1
- `scripts/image-pipeline/generate-punchin-closeup.js` - Position 2
- `scripts/image-pipeline/generate-flat-mockups.js` - Positions 3-5
- `scripts/image-pipeline/update-shopify-product-images.js` - Cloudinary upload + Shopify sync
- `scripts/image-pipeline/batch-process-collection.js` - Bulk processing for collections

## Performance

- Generate 5 images: ~5-8 seconds per product
- Upload to Cloudinary + Shopify: ~10-15 seconds per product
- Total end-to-end: ~15-25 seconds per product
- Batch processing 80 products: ~30-40 minutes
- API Costs: $0 per product (all Sharp.js compositing, Cloudinary free tier)
