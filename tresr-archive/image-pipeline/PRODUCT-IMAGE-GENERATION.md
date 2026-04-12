# Product Image Generation - Complete Workflow

## Overview

This workflow generates all 5 product images for TRESR's TeePublic-style product pages:
1. **Punchin Closeup** (3:4 portrait, black background)
2. **Lifestyle Composite** (design on tee with category background)
3. **Black Flat Mockup** (flat lay, white background)
4. **Navy Flat Mockup** (flat lay, white background)
5. **White Flat Mockup** (flat lay, white background)

## Final Settings (Locked - 2026-02-11)

### Design Specifications
- **Design Width**: 40% of tee template width (819px on 2048px templates)
- **Y Position**: 410px from top
- **Interpolation**: Lanczos3 for high-quality upscaling
- **Template Size**: 2048x2048 for all tee templates (black, navy, white)

### Design Variants Required
- **Dark Tees (Black/Navy)**: Light text on transparent background (inverted design)
- **Light Tees (White)**: Dark text on transparent background (raw design)
- **Punchin/Lifestyle**: Light text on transparent background (inverted design)

## Design Preparation Process

### Step 1: Remove White Backgrounds

Raw designs often have white backgrounds. Remove them to create transparent versions:

```javascript
const sharp = require('sharp');

async function removeWhiteBackground(inputPath, outputPath) {
  const buffer = await sharp(inputPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = buffer;
  const { width, height, channels } = info;

  const newData = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // Make white pixels transparent
    if (r > 250 && g > 250 && b > 250) {
      newData[i] = 0;
      newData[i + 1] = 0;
      newData[i + 2] = 0;
      newData[i + 3] = 0; // Fully transparent
    } else {
      newData[i] = r;
      newData[i + 1] = g;
      newData[i + 2] = b;
      newData[i + 3] = a;
    }
  }

  await sharp(newData, {
    raw: { width, height, channels }
  })
  .png()
  .toFile(outputPath);
}
```

### Step 2: Create Inverted Design

Create light text version from dark text design:

```javascript
async function createInvertedDesign(rawPath, outputPath) {
  const buffer = await sharp(rawPath)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { data, info } = buffer;
  const { width, height, channels } = info;

  const newData = Buffer.alloc(data.length);
  for (let i = 0; i < data.length; i += channels) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const a = data[i + 3];

    // If white, make transparent; otherwise invert colors
    if (r > 250 && g > 250 && b > 250) {
      newData[i] = 0;
      newData[i + 1] = 0;
      newData[i + 2] = 0;
      newData[i + 3] = 0;
    } else {
      newData[i] = 255 - r;
      newData[i + 1] = 255 - g;
      newData[i + 2] = 255 - b;
      newData[i + 3] = a;
    }
  }

  await sharp(newData, {
    raw: { width, height, channels }
  })
  .png()
  .toFile(outputPath);
}
```

## Generation Commands

### Quick Start (All 5 Images)

```bash
cd "/Users/user/Documents/Cursor Clients/client-tresr"

# Test mode (saves locally for review)
node scripts/image-pipeline/generate-all-product-images.js \
  "designs/production/inverted/design-name-dark.png" \
  "designs/production/raw/design-name.png" \
  "category-name" \
  "product-slug" \
  --test

# Production mode (uploads to Cloudinary)
node scripts/image-pipeline/generate-all-product-images.js \
  "designs/production/inverted/design-name-dark.png" \
  "designs/production/raw/design-name.png" \
  "category-name" \
  "product-slug"
```

### Individual Components

**Punchin Closeup:**
```bash
node scripts/image-pipeline/generate-punchin-closeup.js \
  "designs/production/inverted/design-name-dark.png" \
  "product-slug" \
  --test
```

**Lifestyle Composite:**
```bash
node scripts/image-pipeline/generate-lifestyle-composite.js \
  "designs/production/inverted/design-name-dark.png" \
  "category-name" \
  "product-slug" \
  --test
```

**Flat Mockups (all 3 colors):**
```bash
node scripts/image-pipeline/generate-flat-mockups.js \
  "designs/production/inverted/design-name-dark.png" \
  "designs/production/raw/design-name.png" \
  "product-slug" \
  --test
```

## Available Categories

- `cat-lovers`
- `coffee-lovers`
- `crypto-web3`
- `developer`
- `dog-lovers`
- `entrepreneur`
- `fitness-gym`
- `introvert-bookworm`
- `meme-humor`
- `gaming`
- `mental-health`

## File Organization

```
designs/production/
├── raw/                    # Dark text designs (for white tees)
│   └── design-name.png     # 1024x1024, transparent bg
├── inverted/               # Light text designs (for dark tees)
│   └── design-name-dark.png # 1024x1024, transparent bg
└── mockups/                # Legacy full mockups (archive)

temp/                       # Test output (local preview)
├── product-slug-punchin.png
├── product-slug-lifestyle.png
├── product-slug-black-flat.png
├── product-slug-navy-flat.png
└── product-slug-white-flat.png
```

## Cloudinary Upload Structure

When not in test mode, images upload to:
```
tresr/product-images/
├── punchin/
│   └── product-slug.png
├── lifestyle/
│   └── product-slug.png
└── flat/
    ├── product-slug-black.png
    ├── product-slug-navy.png
    └── product-slug-white.png
```

## Shopify Product Update

After generating images locally (with `--test` flag), update the Shopify product:

```bash
# Update product with generated images
node scripts/image-pipeline/update-shopify-product-images.js \
  "product-handle" \
  "design-slug"

# Example
node scripts/image-pipeline/update-shopify-product-images.js \
  "my-therapist-is-a-chatbot-tee" \
  "my-therapist-is-a-chatbot"
```

**What it does:**
1. Uploads all 5 images from `temp/` to Cloudinary
2. Fetches the Shopify product by handle
3. Updates product images in correct order:
   - Position 1: Punchin Closeup
   - Position 2: Lifestyle Composite
   - Position 3: Black Flat Mockup
   - Position 4: Navy Flat Mockup
   - Position 5: White Flat Mockup

**Requirements:**
- `SHOPIFY_ACCESS_TOKEN` environment variable must be set
- Images must exist in `temp/` folder (run generation with `--test` first)
- Product must exist on Shopify with the specified handle

## Template Requirements

All blank tee templates must be 2048x2048:
- `internal/tresr-pod-bot/backgrounds/blank-black-tee-whitebg.png` (2048x2048)
- `internal/tresr-pod-bot/backgrounds/blank-navy-tee-whitebg-2048.png` (2048x2048)
- `internal/tresr-pod-bot/backgrounds/blank-white-tee-whitebg-2048.png` (2048x2048)

## Complete Workflow Example

### Processing "My Therapist Is A Chatbot"

```bash
cd "/Users/user/Documents/Cursor Clients/client-tresr"

# 1. Prepare design variants (removes white bg, creates inverted version)
node scripts/image-pipeline/prepare-design-variants.js \
  "designs/production/raw/my-therapist-is-a-chatbot-tee.png" \
  "my-therapist-is-a-chatbot"

# 2. Generate all 5 product images (test mode - saves locally)
node scripts/image-pipeline/generate-all-product-images.js \
  "temp/my-therapist-is-a-chatbot-inverted-transparent.png" \
  "temp/my-therapist-is-a-chatbot-transparent.png" \
  "mental-health" \
  "my-therapist-is-a-chatbot" \
  --test

# 3. Review images in temp/ folder
open temp/my-therapist-is-a-chatbot-*.png

# 4. If approved, update Shopify product (uploads to Cloudinary + updates product)
node scripts/image-pipeline/update-shopify-product-images.js \
  "my-therapist-is-a-chatbot-tee" \
  "my-therapist-is-a-chatbot"
```

**Complete 4-Step Process:**
1. ✅ Prepare variants (transparent + inverted)
2. ✅ Generate images (test locally first)
3. ✅ Review images (visual inspection)
4. ✅ Update Shopify (upload + publish)

## Technical Details

### Sharp Settings (generate-flat-mockups.js & generate-lifestyle-composite.js)

```javascript
// Design sizing
const designWidth = Math.round(teeWidth * 0.40); // 40% of template width

// High-quality resize
const resizedDesign = await sharp(designPath)
  .resize(designWidth, null, {
    fit: 'contain',
    background: { r: 0, g: 0, b: 0, alpha: 0 },
    kernel: 'lanczos3'  // High-quality upscaling
  })
  .png()
  .toBuffer();

// Position calculation
const baseOffset = 410;
const baseTemplateSize = 2048;
const designX = Math.round((teeWidth - designMeta.width) / 2);
const designY = Math.round((baseOffset / baseTemplateSize) * teeHeight);

// Composite
await sharp(teeTemplate)
  .composite([{
    input: resizedDesign,
    top: designY,
    left: designX
  }])
  .png()
  .toFile(outputPath);
```

### Design Variant Selection Logic

```javascript
// In generate-flat-mockups.js
async function generateSingleFlatMockup(darkDesignUrl, lightDesignUrl, color, slug) {
  // Select correct variant based on tee color
  const designUrl = (color === 'white') ? lightDesignUrl : darkDesignUrl;
  // ... rest of generation
}
```

## Troubleshooting

### Issue: Grainy punchin closeup
**Cause**: Source design resolution too low (e.g., 720x715)
**Fix**: Use 1024x1024 minimum source resolution

### Issue: Visible background squares on designs
**Cause**: Background not properly transparent
**Fix**: Use removeWhiteBackground or createInvertedDesign functions above

### Issue: Design too small/large
**Cause**: Wrong percentage calculation
**Fix**: Use 40% of template width (not 25% or 60%)

### Issue: Design positioned wrong on navy/white
**Cause**: Using fixed Y offset instead of proportional
**Fix**: Use `(410 / 2048) * templateHeight` calculation

### Issue: Wrong design variant on white tees
**Cause**: Using inverted design for all colors
**Fix**: Use raw (dark text) design for white, inverted (light text) for black/navy

## Notes

- Always test with `--test` flag first to preview locally
- Design files should be minimum 1024x1024 for quality
- Transparent backgrounds are required (no white squares)
- All templates must be 2048x2048 for consistent sizing
- Lanczos3 interpolation prevents graininess when upscaling
- Settings locked 2026-02-11 after extensive testing
