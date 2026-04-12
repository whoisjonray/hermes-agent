# TRESR Product Image Pipeline

## Overview

Automated image generation system for TRESR products. Creates all 5 required product images in the correct order for optimal conversion.

## Image Structure (TeePublic-Style)

### Position 1: Punchin Closeup ⭐ **Grid Thumbnail**
- **Aspect Ratio**: 3:4 portrait (2048x2732)
- **Background**: Pure black (#000000)
- **Design**: Centered, scaled to 80% of canvas
- **Purpose**: Collection grid thumbnail (design-focused, pops at small sizes)

### Position 2: Lifestyle Composite 🎨 **Hover & Ads**
- **Compositing**: Design → transparent tee → category background
- **Design Size**: 25% of tee width, 520px from top
- **Purpose**: Shows on hover in collection grid, used in Meta ads

### Positions 3-5: Flat Mockups 👕 **Product Details**
- **Colors**: Black, Navy, White (in that order)
- **Background**: White
- **Design Size**: 25% of tee width, 520px from top
- **Purpose**: Product detail page color variants

## Files

```
scripts/image-pipeline/
├── generate-punchin-closeup.js      # Position 1 generator
├── generate-lifestyle-composite.js  # Position 2 generator
├── generate-flat-mockups.js         # Positions 3-5 generator
├── generate-all-product-images.js   # Master wrapper (USE THIS)
└── README.md                        # This file
```

## Usage

### Test Mode (Preview Locally)

```bash
cd /Users/user/Documents/Cursor\ Clients/client-tresr

node scripts/image-pipeline/generate-all-product-images.js \
  <rawDesignUrl> \
  <category> \
  <slug> \
  --test
```

**Example:**
```bash
node scripts/image-pipeline/generate-all-product-images.js \
  https://res.cloudinary.com/dqslerzk9/image/upload/tresr/print-ready/i-read-the-docs-for-dark.png \
  developer \
  i-read-the-docs \
  --test
```

This saves images to `temp/` for review. Check them, then run without `--test` to upload.

### Production Mode (Upload to Cloudinary)

```bash
node scripts/image-pipeline/generate-all-product-images.js \
  https://res.cloudinary.com/dqslerzk9/image/upload/tresr/print-ready/i-read-the-docs-for-dark.png \
  developer \
  i-read-the-docs
```

Uploads to Cloudinary:
- `tresr/product-images/punchin/{slug}.png`
- `tresr/product-images/lifestyle/{slug}.png`
- `tresr/product-images/flat/{slug}-{color}.png`

## Available Categories

Must match background file availability:

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

## Test Mode Explained

**Q: What does `--test` mode do?**

A: Instead of uploading to Cloudinary, it saves images locally to `temp/` so you can:
1. Preview all 5 images
2. Check sizing, positioning, colors
3. Make sure everything looks right
4. Then run without `--test` to upload

This prevents uploading bad images and wasting Cloudinary bandwidth.

## Requirements

- **Raw Design**: Transparent PNG on Cloudinary at `tresr/print-ready/{slug}-for-dark.png`
- **Blank Tees**: Located at `internal/tresr-pod-bot/backgrounds/blank-{color}-tee-whitebg.png`
  - ✅ Black
  - ✅ Navy
  - ✅ White
- **Category Backgrounds**: Located at `internal/tresr-pod-bot/backgrounds/active/{number}.{variant}-{category}-bg.png`
- **Sharp**: npm package for image processing (already installed)

## Next Steps

### For Batch Fixing Collection

Create `fix-community-approved-collection.js` that:
1. Reads products from Shopify API
2. Gets design info from `scripts/fulfillment/design-mapper.js`
3. Runs `generate-all-product-images.js` for each
4. Updates Shopify product images in correct order
5. Saves URLs to product metafields

### For Daily Automation

Integrate into TRESR bot's workflow:
1. After design research generates new design
2. Upload raw transparent PNG to Cloudinary
3. Run `generate-all-product-images.js`
4. Create Shopify product with all 5 images
5. Save metafields for fulfillment emails
6. Add to community-approved collection

## Troubleshooting

### Design too large/small
- Punchin closeup scales to fit within 80% of canvas
- Maintains aspect ratio automatically

### Wrong background
- Check category name matches exactly
- See "Available Categories" list above
- Background files are numbered (e.g., `5.1-developer-bg.png`)

### Missing blank tees
- Make sure all 3 colors exist in `internal/tresr-pod-bot/backgrounds/`
- Files must be named exactly: `blank-{color}-tee-whitebg.png`

### Cloudinary upload fails
- Check credentials in scripts (hardcoded for now)
- Verify Cloudinary folders exist
- Check network connection

## Technical Details

### Image Processing

Uses [Sharp](https://sharp.pixelplumbing.com/) for:
- PNG compositing with alpha channels
- Proportional resizing
- Background replacement
- Aspect ratio preservation

### Positioning Logic

**Punchin Closeup:**
```javascript
maxDimension = canvas * 0.8
scaleFactor = Math.min(maxWidth/designWidth, maxHeight/designHeight)
centerX = (canvas.width - scaled.width) / 2
centerY = (canvas.height - scaled.height) / 2
```

**Lifestyle & Flats:**
```javascript
designWidth = teeWidth * 0.25  // 25% of tee
designX = (teeWidth - designWidth) / 2  // Centered
designY = 520px  // ~3 inches below collar
```

## Cloudinary Structure

```
tresr/
├── print-ready/           # Raw transparent designs (input)
│   ├── {slug}-for-dark.png
│   └── {slug}-for-light.png
│
└── product-images/        # Generated images (output)
    ├── punchin/
    │   └── {slug}.png
    ├── lifestyle/
    │   └── {slug}.png
    └── flat/
        ├── {slug}-black.png
        ├── {slug}-navy.png
        └── {slug}-white.png
```

## Why This Order Converts

1. **Punchin first** = Design pops in tiny grid thumbnails
2. **Lifestyle on hover** = Context without cluttering grid
3. **Flats 3-5** = Color accuracy for buyer confidence

Source: TeePublic, Redbubble, Printful all use this pattern.
