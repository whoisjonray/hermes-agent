# TRESR Design → Product Image Pipeline

## Full Flow (Updated Feb 15, 2026)

```
1. Gemini generates design (1024px PNG)
2. Vectorizer.ai cleans up edges (PNG → SVG → 4096px PNG)
3. Background removal (transparent PNG)
4. Color inversion (light version for dark tees, dark version for white tees)
5. Image pipeline generates 5 product images:
   - Position 1: Lifestyle composite (category background + tee + design)
   - Position 2: Punchin closeup (3:4 portrait, black bg)
   - Position 3: Flat mockup (black tee)
   - Position 4: Flat mockup (navy tee)
   - Position 5: Flat mockup (white tee)
6. Upload to Shopify + variant-image linking
7. Send high-res PNG to Nick for print prep
```

## Commands

### Step 1: Generate design
```bash
node scripts/generate-design.js --prompt "your design prompt" --output tmp/raw-design.png
```

### Step 2: Vectorize + upscale (NEW)
```bash
node scripts/image-pipeline/vectorize-design.js tmp/raw-design.png tmp/clean-4096.png --size 4096
```

### Step 3: Background removal + inversion
```bash
# Remove white background
convert tmp/clean-4096.png -fuzz 15% -transparent white tmp/design-nobg.png

# Create inverted version for dark tees
convert tmp/design-nobg.png -channel RGB -negate tmp/design-nobg-inverted.png
```

### Step 4: Generate all product images
```bash
node scripts/image-pipeline/generate-all-product-images.js \
  tmp/design-nobg-inverted.png \
  tmp/design-nobg.png \
  <category> \
  <slug>
```

### Step 5: Update Shopify product
```bash
node scripts/image-pipeline/update-shopify-product-images.js <product-handle> <slug>
```

## For Nick (Print Shop)
- Send 4096px high-res PNG (post-vectorization, pre-bg-removal)
- Nick handles final print prep (vectorization, color removal) using his tools
- Recommended bg removal tool: https://imgonline.tools/remove-color

## API Keys Required
- `VECTORIZER_AI_API_ID` — Vectorizer.ai API
- `VECTORIZER_AI_API_SECRET` — Vectorizer.ai API
- `CLOUDINARY_API_KEY` / `CLOUDINARY_API_SECRET` — Image hosting
- `SHOPIFY_ACCESS_TOKEN` — Product updates
