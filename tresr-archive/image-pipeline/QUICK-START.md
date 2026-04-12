# Product Image Generation - Quick Start

## Complete End-to-End Workflow (7 Images)

### 1. Prepare Design Variants
```bash
cd "/Users/user/Documents/Cursor Clients/client-tresr"

node scripts/image-pipeline/prepare-design-variants.js \
  "designs/production/raw/my-design.png" \
  "my-design"
```

Creates:
- `temp/my-design-transparent.png` (dark text for white tees)
- `temp/my-design-inverted-transparent.png` (light text for dark tees)

### 2. Generate Product Images (Test Mode)
```bash
node scripts/image-pipeline/generate-all-product-images.js \
  "temp/my-design-inverted-transparent.png" \
  "temp/my-design-transparent.png" \
  "category-name" \
  "my-design" \
  --test
```

Creates in `temp/`:
- `my-design-punchin.png` (3:4 portrait, black bg)
- `my-design-lifestyle.png` (with category background)
- `my-design-black-flat.png`
- `my-design-navy-flat.png`
- `my-design-white-flat.png`
- `my-design-lifestyle-male.png` (AI-generated, 1024x1024)
- `my-design-lifestyle-female.png` (AI-generated, 1024x1024)

### 3. Review Images
```bash
open temp/my-design-*.png
```

### 4. Update Shopify Product
```bash
node scripts/image-pipeline/update-shopify-product-images.js \
  "product-handle" \
  "my-design"
```

This will:
1. Upload all 7 images to Cloudinary
2. Update the Shopify product with correct image order
3. Product goes live immediately

**Image Order:**
- Position 1: Punchin closeup
- Position 2: Lifestyle composite
- Position 3: Black flat mockup
- Position 4: Navy flat mockup
- Position 5: White flat mockup
- Position 6: AI lifestyle photo (male)
- Position 7: AI lifestyle photo (female)

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

## Real Example

```bash
cd "/Users/user/Documents/Cursor Clients/client-tresr"

# 1. Prepare
node scripts/image-pipeline/prepare-design-variants.js \
  "designs/production/raw/my-therapist-is-a-chatbot-tee.png" \
  "my-therapist-is-a-chatbot"

# 2. Generate (test)
node scripts/image-pipeline/generate-all-product-images.js \
  "temp/my-therapist-is-a-chatbot-inverted-transparent.png" \
  "temp/my-therapist-is-a-chatbot-transparent.png" \
  "mental-health" \
  "my-therapist-is-a-chatbot" \
  --test

# 3. Review
open temp/my-therapist-is-a-chatbot-*.png

# 4. Update Shopify
node scripts/image-pipeline/update-shopify-product-images.js \
  "my-therapist-is-a-chatbot-tee" \
  "my-therapist-is-a-chatbot"
```

## Settings (Locked)

- **Design Size**: 40% of tee width (819px on 2048px templates)
- **Y Position**: 410px from top
- **Templates**: All 2048x2048
- **Interpolation**: Lanczos3 for quality

## Requirements

- Source designs: 1024x1024 minimum
- Transparent backgrounds (no white squares)
- `.env` file with `SHOPIFY_ACCESS_TOKEN`

## Troubleshooting

**Images look grainy?**
- Source design too small (need 1024x1024 minimum)

**White background visible?**
- Run prepare-design-variants.js to remove it

**Design wrong size/position?**
- Settings locked at 40% width, Y=410
- All templates must be 2048x2048

**Shopify auth error?**
- Check SHOPIFY_ACCESS_TOKEN in .env file

## Full Documentation

See `PRODUCT-IMAGE-GENERATION.md` for complete details.
