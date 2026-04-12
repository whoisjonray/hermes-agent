/**
 * Extract Design from Design-Hero Images & Run Full Pipeline
 *
 * For old collections (Lazy Cat T-Shirts, 80s/90s Nostalgia) where no raw
 * design files exist. Each product has a `design-hero-{productId}.png` on
 * Shopify — a 1000x1000 crop of the design on a dark charcoal tee background.
 *
 * This script:
 * 1. Fetches products from a Shopify collection
 * 2. Downloads the design-hero image for each product
 * 3. Extracts the design (removes dark background → transparent PNG)
 * 4. Creates an inverted variant for light tees
 * 5. Runs the full 5-position image pipeline
 * 6. Uploads to Shopify and activates the product
 *
 * Usage:
 *   # Test ONE product (saves locally for review)
 *   node extract-and-pipeline.js --handle fix-my-life-tee --category cat-lovers --test
 *
 *   # Process entire collection
 *   node extract-and-pipeline.js --collection 648127185181 --category cat-lovers
 *
 *   # Test entire collection (local only, no upload)
 *   node extract-and-pipeline.js --collection 648127185181 --category cat-lovers --test
 */

const sharp = require('sharp');
const axios = require('axios');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const { generateAllProductImages } = require('./generate-all-product-images');
const { updateShopifyProductImages } = require('./update-shopify-product-images');

// Cloudinary config (same as other pipeline scripts)
cloudinary.config({
    cloud_name: 'dqslerzk9',
    api_key: '364274988183368',
    api_secret: 'gJEAx4VjStv1uTKyi3DiLAwL8pQ'
});

// Directories
const TEMP_DIR = path.join(__dirname, '../../temp');
const PRINT_READY_DIR = path.join(__dirname, '../../output/print-ready');

// Shopify API
const SHOPIFY_STORE = 'becc05-b4.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const SHOPIFY_API_VERSION = '2024-01';

if (!SHOPIFY_ACCESS_TOKEN) {
    console.error('❌ SHOPIFY_ACCESS_TOKEN not found in .env file');
    process.exit(1);
}

// Extraction tuning
const DARK_THRESHOLD = 65;       // Pixels with luminance below this → fully transparent
const FADE_RANGE = 20;           // Pixels between threshold and (threshold + range) → partial alpha
const MIN_ALPHA_KEEP = 50;       // Minimum alpha to keep (avoids faint halos)

// ─── Shopify Helpers ─────────────────────────────────────────────────────────

async function shopifyGet(endpoint) {
    const url = `https://${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}/${endpoint}`;
    const response = await axios.get(url, {
        headers: {
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
            'Content-Type': 'application/json'
        }
    });
    return response.data;
}

async function shopifyPut(endpoint, data) {
    const url = `https://${SHOPIFY_STORE}/admin/api/${SHOPIFY_API_VERSION}/${endpoint}`;
    const response = await axios.put(url, data, {
        headers: {
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
            'Content-Type': 'application/json'
        }
    });
    return response.data;
}

/**
 * Fetch all products from a collection (handles pagination)
 */
async function fetchCollectionProducts(collectionId) {
    const products = [];
    let url = `products.json?collection_id=${collectionId}&limit=250`;

    while (url) {
        const data = await shopifyGet(url);
        products.push(...data.products);

        // Check for next page (Shopify pagination)
        // For simplicity with REST, we just fetch once (max 250 per page)
        url = null;
    }

    return products;
}

/**
 * Fetch a single product by handle
 */
async function fetchProductByHandle(handle) {
    const data = await shopifyGet(`products.json?handle=${handle}`);
    if (data.products && data.products.length > 0) {
        return data.products[0];
    }
    throw new Error(`Product not found: ${handle}`);
}

/**
 * Find the design-hero image from a product's images
 */
function findDesignHeroImage(product) {
    for (const image of product.images) {
        // Check alt text first
        if (image.alt && image.alt.toLowerCase().includes('design closeup')) {
            return image;
        }
        // Check filename
        const filename = image.src.split('/').pop().split('?')[0].toLowerCase();
        if (filename.includes('design-hero')) {
            return image;
        }
    }

    // Fallback: look for any 1000x1000 image (design-hero size)
    for (const image of product.images) {
        if (image.width === 1000 && image.height === 1000) {
            return image;
        }
    }

    return null;
}

// ─── Image Download ──────────────────────────────────────────────────────────

async function downloadImage(url, destPath) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    fs.writeFileSync(destPath, response.data);
    return destPath;
}

// ─── Design Extraction (Dark Background → Transparent) ──────────────────────

/**
 * Extract design from a dark charcoal tee background.
 * Light/cream design elements become visible on transparent background.
 * This is the "for-dark" variant (light design for dark tees).
 */
async function extractDesignFromDarkBg(inputPath, outputPath) {
    console.log('  🔬 Extracting design from dark background...');
    console.log(`     Threshold: ${DARK_THRESHOLD}, Fade range: ${FADE_RANGE}`);

    const buffer = await sharp(inputPath)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    const { data, info } = buffer;
    const { width, height, channels } = info;

    const newData = Buffer.alloc(data.length);

    let transparentCount = 0;
    let opaqueCount = 0;
    let fadeCount = 0;

    for (let i = 0; i < data.length; i += channels) {
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];

        // Calculate luminance
        const luminance = 0.299 * r + 0.587 * g + 0.114 * b;

        if (luminance < DARK_THRESHOLD) {
            // Dark pixel → fully transparent
            newData[i] = 0;
            newData[i + 1] = 0;
            newData[i + 2] = 0;
            newData[i + 3] = 0;
            transparentCount++;
        } else if (luminance < DARK_THRESHOLD + FADE_RANGE) {
            // Transition zone → proportional alpha for smooth edges
            const alpha = Math.round(((luminance - DARK_THRESHOLD) / FADE_RANGE) * 255);
            if (alpha < MIN_ALPHA_KEEP) {
                // Too faint, drop it
                newData[i] = 0;
                newData[i + 1] = 0;
                newData[i + 2] = 0;
                newData[i + 3] = 0;
                transparentCount++;
            } else {
                newData[i] = r;
                newData[i + 1] = g;
                newData[i + 2] = b;
                newData[i + 3] = alpha;
                fadeCount++;
            }
        } else {
            // Light pixel → fully opaque (design element)
            newData[i] = r;
            newData[i + 1] = g;
            newData[i + 2] = b;
            newData[i + 3] = 255;
            opaqueCount++;
        }
    }

    const totalPixels = width * height;
    console.log(`     Pixels: ${totalPixels} total`);
    console.log(`     Transparent: ${transparentCount} (${(transparentCount / totalPixels * 100).toFixed(1)}%)`);
    console.log(`     Fade edge: ${fadeCount} (${(fadeCount / totalPixels * 100).toFixed(1)}%)`);
    console.log(`     Opaque: ${opaqueCount} (${(opaqueCount / totalPixels * 100).toFixed(1)}%)`);

    await sharp(newData, { raw: { width, height, channels } })
        .png()
        .toFile(outputPath);

    console.log(`  ✅ Saved: ${path.basename(outputPath)}`);
    return outputPath;
}

/**
 * Create inverted design variant for light tees.
 * Takes the extracted transparent design and inverts the RGB channels
 * so cream/light colors become dark (visible on white tees).
 */
async function createInvertedVariant(inputPath, outputPath) {
    console.log('  🔄 Creating inverted variant for light tees...');

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

        if (a === 0) {
            // Transparent stays transparent
            newData[i] = 0;
            newData[i + 1] = 0;
            newData[i + 2] = 0;
            newData[i + 3] = 0;
        } else {
            // Invert RGB, preserve alpha
            newData[i] = 255 - r;
            newData[i + 1] = 255 - g;
            newData[i + 2] = 255 - b;
            newData[i + 3] = a;
        }
    }

    await sharp(newData, { raw: { width, height, channels } })
        .png()
        .toFile(outputPath);

    console.log(`  ✅ Saved: ${path.basename(outputPath)}`);
    return outputPath;
}

// ─── Product Activation ──────────────────────────────────────────────────────

async function activateProduct(productId) {
    console.log(`  🟢 Activating product ${productId}...`);
    await shopifyPut(`products/${productId}.json`, {
        product: { id: productId, status: 'active' }
    });
    console.log('  ✅ Product activated');
}

// ─── Slug Helper ─────────────────────────────────────────────────────────────

function handleToSlug(handle) {
    return handle.replace(/-tee$/, '');
}

// ─── Tagging ─────────────────────────────────────────────────────────────────

async function tagProduct(productId, tags) {
    if (!tags || tags.length === 0) return;

    const data = await shopifyGet(`products/${productId}.json?fields=id,tags`);
    const existing = data.product.tags ? data.product.tags.split(', ').map(t => t.trim()) : [];
    const merged = [...new Set([...existing, ...tags])];

    await shopifyPut(`products/${productId}.json`, {
        product: { id: productId, tags: merged.join(', ') }
    });

    console.log(`  🏷️  Tagged: [${tags.join(', ')}]`);
}

// ─── Product Mapping (per-product category + tags) ───────────────────────────

// Lazy Cat T-Shirts (648127185181) — all get cat-lovers
// Pipeline bg = primary visual theme for lifestyle composite
const PRODUCT_MAP = {
    // === LAZY CAT — Cat + Coffee ===
    'fix-my-life':                      { bg: 'cat-lovers',    tags: ['cat-lovers', 'coffee-lovers'] },
    'i-got-you-coffee':                 { bg: 'coffee-lovers', tags: ['cat-lovers', 'coffee-lovers'] },
    'basic-human-needs':                { bg: 'coffee-lovers', tags: ['cat-lovers', 'coffee-lovers', 'meme-humor'] },
    'before-your-morning-coffee':       { bg: 'coffee-lovers', tags: ['cat-lovers', 'coffee-lovers', 'meme-humor'] },
    'coffee-first':                     { bg: 'coffee-lovers', tags: ['cat-lovers', 'coffee-lovers'] },
    'coffee-is-my-morning-wine':        { bg: 'coffee-lovers', tags: ['cat-lovers', 'coffee-lovers'] },
    'coffee-iv-drip':                   { bg: 'coffee-lovers', tags: ['cat-lovers', 'coffee-lovers'] },
    'emotional-support-coffee':         { bg: 'coffee-lovers', tags: ['cat-lovers', 'coffee-lovers'] },
    'here-s-a-coffee-two-million-dollars': { bg: 'coffee-lovers', tags: ['cat-lovers', 'coffee-lovers', 'meme-humor'] },
    'i-run-on-caffeine':                { bg: 'coffee-lovers', tags: ['cat-lovers', 'coffee-lovers'] },
    'i-wake-up-to-drink-coffee':        { bg: 'coffee-lovers', tags: ['cat-lovers', 'coffee-lovers'] },
    'most-important-meal':              { bg: 'coffee-lovers', tags: ['cat-lovers', 'coffee-lovers'] },
    'my-favorite-co-worker':            { bg: 'coffee-lovers', tags: ['cat-lovers', 'coffee-lovers'] },
    'my-longest-relationship':          { bg: 'coffee-lovers', tags: ['cat-lovers', 'coffee-lovers'] },
    'the-magic-ingredient':             { bg: 'coffee-lovers', tags: ['cat-lovers', 'coffee-lovers'] },
    'this-coffee-is-broken':            { bg: 'coffee-lovers', tags: ['cat-lovers', 'coffee-lovers'] },
    'warm-cup-a':                       { bg: 'coffee-lovers', tags: ['cat-lovers', 'coffee-lovers'] },
    'will-you-die-without-it':          { bg: 'coffee-lovers', tags: ['cat-lovers', 'coffee-lovers'] },
    'it-s-monday':                      { bg: 'coffee-lovers', tags: ['cat-lovers', 'coffee-lovers', 'meme-humor'] },

    // === LAZY CAT — Cat primary ===
    'bc-murder-is-wrong':               { bg: 'cat-lovers',    tags: ['cat-lovers', 'meme-humor'] },
    'how-to-be-happy':                  { bg: 'cat-lovers',    tags: ['cat-lovers'] },
    'my-love-language':                 { bg: 'cat-lovers',    tags: ['cat-lovers'] },
    'stop-asking':                      { bg: 'cat-lovers',    tags: ['cat-lovers', 'meme-humor'] },
    'where-are-your-friends':           { bg: 'cat-lovers',    tags: ['cat-lovers', 'meme-humor'] },
    'inhale-exhale':                    { bg: 'cat-lovers',    tags: ['cat-lovers', 'meme-humor'] },
    'low-maintenance':                  { bg: 'cat-lovers',    tags: ['cat-lovers', 'meme-humor'] },

    // === LAZY CAT — Meme/humor primary ===
    'me-or-the-game':                   { bg: 'meme-humor',    tags: ['cat-lovers', 'meme-humor'] },
    'meh-it-s-monday':                  { bg: 'meme-humor',    tags: ['cat-lovers', 'meme-humor'] },
    'overstimulation':                  { bg: 'meme-humor',    tags: ['cat-lovers', 'meme-humor'] },
    'we-re-broke-rn-but':               { bg: 'meme-humor',    tags: ['cat-lovers', 'meme-humor'] },
    'when-monday-shows-up':             { bg: 'meme-humor',    tags: ['cat-lovers', 'meme-humor'] },

    // === LAZY CAT — In both collections ===
    'hat-dishwasher-thingie':           { bg: 'cat-lovers',    tags: ['cat-lovers', '80s-90s-nostalgia', 'meme-humor'] },

    // === LAZY CAT — NO HERO (skip extraction) ===
    '2-coffee-cup-kind-of-day':         { bg: 'coffee-lovers', tags: ['cat-lovers', 'coffee-lovers'], skip: true },

    // === 80s/90s NOSTALGIA — all get 80s-90s-nostalgia + meme-humor ===
    '80s-life':                         { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    '90s-tech':                         { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'adorable-thing':                   { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'bikes-in-the-front-yard':          { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'blowing-on-nintendo-cartridges':   { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'box-x-box':                        { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'candy-cigarettes':                 { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'catastrophic-proportions':         { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'complicated-emotions':             { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'desk-bomb-shelter-for-sale':       { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'dewey-decimal-system':             { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'dirty-feet-happy-life':            { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'disposable-camera':                { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'go-fund-me':                       { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'got-a-light':                      { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'growing-up-poor':                  { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'hand-crank-car-window':            { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'holding-mom-s-cigarette':          { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'hot-metal-slide':                  { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'how-we-rolled':                    { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'i-ll-give-you-something-to-cry-about': { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'lick-the-beaters':                 { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'life-goals':                       { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'mixed-tape':                       { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'movie-day-at-school':              { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'not-accepting-feedback':           { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'not-an-iphone-in-sight':           { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'phone-off-the-hook':               { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'playing-snake':                    { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'quarter-gumball-machines':         { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'school-smoking-section':           { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'see-saw-nightmares':               { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'see-through-phone':                { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'slam-the-phone-down':              { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'the-struggle-was-real':            { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'we-all-had-this-clock':            { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
    'welcome-to-movie-phone':           { bg: 'introvert-bookworm', tags: ['80s-90s-nostalgia', 'meme-humor'] },
};

// ─── Main Processing ─────────────────────────────────────────────────────────

/**
 * Process a single product:
 * 1. Extract design from design-hero (dark bg removal) → print-ready files
 * 2. Generate all 5 pipeline images (lifestyle, punchin, 3 flat mockups)
 * 3. Replace ALL old images with the 5 new pipeline images
 * 4. Tag and activate
 */
async function processProduct(product, category, testMode = false, tags = []) {
    const handle = product.handle;
    const slug = handleToSlug(handle);

    // Use PRODUCT_MAP if available, otherwise use passed-in values
    const mapping = PRODUCT_MAP[handle];
    const bgCategory = mapping ? mapping.bg : category;
    const productTags = mapping ? mapping.tags : tags;

    if (mapping && mapping.skip) {
        console.log(`⏭️  SKIP (no hero image): ${handle}`);
        return false;
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🎯 PROCESSING: ${product.title}`);
    console.log(`   Handle: ${handle}`);
    console.log(`   Slug: ${slug}`);
    console.log(`   Category: ${bgCategory}`);
    console.log(`   Tags: [${productTags.join(', ')}]`);
    console.log(`   Mode: ${testMode ? 'TEST (local only)' : 'PRODUCTION (replace images + activate)'}`);
    console.log(`${'═'.repeat(60)}\n`);

    // Ensure directories exist
    if (!fs.existsSync(TEMP_DIR)) fs.mkdirSync(TEMP_DIR, { recursive: true });
    if (!fs.existsSync(PRINT_READY_DIR)) fs.mkdirSync(PRINT_READY_DIR, { recursive: true });

    // Step 1: Find design-hero image
    console.log('📍 STEP 1: Find design-hero image\n');
    const heroImage = findDesignHeroImage(product);
    if (!heroImage) {
        console.log(`  ❌ No design-hero image found for ${handle}`);
        return false;
    }
    console.log(`  ✅ Found: ${heroImage.src.split('/').pop().split('?')[0]}`);

    // Step 2: Download design-hero
    console.log('\n📍 STEP 2: Download design-hero image\n');
    const heroLocalPath = path.join(TEMP_DIR, `${slug}-design-hero.png`);
    await downloadImage(heroImage.src, heroLocalPath);
    console.log(`  ✅ Downloaded: ${path.basename(heroLocalPath)}`);

    // Step 3: Extract design from dark background
    console.log('\n📍 STEP 3: Extract design from dark background\n');
    const forDarkFlat = path.join(PRINT_READY_DIR, `${slug}-for-dark.png`);
    await extractDesignFromDarkBg(heroLocalPath, forDarkFlat);

    // Step 4: Create inverted variant for light tees
    console.log('\n📍 STEP 4: Create inverted variant for light tees\n');
    const forLightFlat = path.join(PRINT_READY_DIR, `${slug}-for-light.png`);
    await createInvertedVariant(forDarkFlat, forLightFlat);

    // Step 4b: Create subfolder structure for fulfillment design-mapper
    console.log('\n📍 STEP 4b: Create subfolder for fulfillment system\n');
    const slugDir = path.join(PRINT_READY_DIR, slug);
    if (!fs.existsSync(slugDir)) fs.mkdirSync(slugDir, { recursive: true });
    fs.copyFileSync(forDarkFlat, path.join(slugDir, 'for-dark.png'));
    fs.copyFileSync(forLightFlat, path.join(slugDir, 'for-light.png'));
    console.log(`  ✅ output/print-ready/${slug}/for-dark.png`);
    console.log(`  ✅ output/print-ready/${slug}/for-light.png`);

    // Step 4c: Upload print-ready designs to Cloudinary
    console.log('\n📍 STEP 4c: Upload print-ready to Cloudinary\n');
    const darkCloudResult = await cloudinary.uploader.upload(forDarkFlat, {
        public_id: `tresr/print-ready/${slug}/for-dark`,
        resource_type: 'image',
        overwrite: true,
        invalidate: true
    });
    console.log(`  ✅ for-dark: ${darkCloudResult.secure_url}`);
    const lightCloudResult = await cloudinary.uploader.upload(forLightFlat, {
        public_id: `tresr/print-ready/${slug}/for-light`,
        resource_type: 'image',
        overwrite: true,
        invalidate: true
    });
    console.log(`  ✅ for-light: ${lightCloudResult.secure_url}`);

    // Step 5: Generate all 5 product images (lifestyle, punchin, 3 flat mockups)
    console.log('\n📍 STEP 5: Generate all 5 product images\n');

    const darkDest = path.join(TEMP_DIR, `${slug}-inverted-transparent.png`);
    const lightDest = path.join(TEMP_DIR, `${slug}-transparent.png`);
    fs.copyFileSync(forDarkFlat, darkDest);
    fs.copyFileSync(forLightFlat, lightDest);

    await generateAllProductImages(darkDest, lightDest, bgCategory, slug, true);

    // If test mode, stop here
    if (testMode) {
        console.log(`\n${'═'.repeat(60)}`);
        console.log('🧪 TEST MODE COMPLETE');
        console.log(`${'═'.repeat(60)}`);
        console.log(`\nReview generated images in temp/:`);
        console.log(`  ${slug}-lifestyle.png   (position 1 — hero for ads)`);
        console.log(`  ${slug}-punchin.png     (position 2)`);
        console.log(`  ${slug}-black-flat.png  (position 3)`);
        console.log(`  ${slug}-navy-flat.png   (position 4)`);
        console.log(`  ${slug}-white-flat.png  (position 5)`);
        console.log(`\nOld images will be REMOVED and replaced with these 5.\n`);
        return true;
    }

    // Step 6: Upload to Cloudinary + replace all Shopify images
    console.log('\n📍 STEP 6: Upload to Shopify (replace all images)\n');
    const localImagePaths = {
        lifestyle: path.join(TEMP_DIR, `${slug}-lifestyle.png`),
        punchin: path.join(TEMP_DIR, `${slug}-punchin.png`),
        black: path.join(TEMP_DIR, `${slug}-black-flat.png`),
        navy: path.join(TEMP_DIR, `${slug}-navy-flat.png`),
        white: path.join(TEMP_DIR, `${slug}-white-flat.png`)
    };

    await updateShopifyProductImages(localImagePaths, handle, slug);

    // Step 7: Activate product + tag for collections
    console.log('\n📍 STEP 7: Activate + tag\n');
    await activateProduct(product.id);
    await tagProduct(product.id, productTags);

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`✅ COMPLETE: https://tresr.com/products/${handle}`);
    console.log(`${'═'.repeat(60)}\n`);

    return true;
}

/**
 * Process all products in a collection
 * Category is looked up per-product from PRODUCT_MAP (fallback to param)
 */
async function processCollection(collectionId, category, testMode = false) {
    console.log(`\n${'═'.repeat(60)}`);
    console.log(`📦 FETCHING COLLECTION: ${collectionId}`);
    console.log(`${'═'.repeat(60)}\n`);

    const products = await fetchCollectionProducts(collectionId);
    console.log(`Found ${products.length} products\n`);

    // Track progress
    const completed = new Set();
    let processed = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];

    // Check which products already have print-ready subfolders
    for (const product of products) {
        const slug = handleToSlug(product.handle);
        const subfolderExists = fs.existsSync(path.join(PRINT_READY_DIR, slug, 'for-dark.png'));

        if (subfolderExists) {
            completed.add(product.handle);
        }
    }

    if (completed.size > 0) {
        console.log(`${completed.size} products already have print-ready designs (use --force to re-extract)\n`);
    }

    for (const product of products) {
        // Skip products that already have print-ready designs (unless forced)
        if (completed.has(product.handle) && !process.argv.includes('--force')) {
            console.log(`⏭️  SKIP (already extracted): ${product.handle}`);
            skipped++;
            continue;
        }

        try {
            const success = await processProduct(product, category, testMode);
            if (success) {
                processed++;
            } else {
                skipped++;
            }
        } catch (error) {
            console.error(`❌ FAILED: ${product.handle} - ${error.message}`);
            errors.push({ handle: product.handle, error: error.message });
            failed++;
        }

        // Rate limiting delay between products
        if (!testMode) {
            await new Promise(r => setTimeout(r, 1000));
        }
    }

    // Summary
    console.log(`\n${'═'.repeat(60)}`);
    console.log('📊 BATCH PROCESSING COMPLETE');
    console.log(`${'═'.repeat(60)}`);
    console.log(`Total products: ${products.length}`);
    console.log(`✅ Processed: ${processed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Failed: ${failed}`);
    if (errors.length > 0) {
        console.log('\nFailed products:');
        errors.forEach(e => console.log(`  - ${e.handle}: ${e.error}`));
    }
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

if (require.main === module) {
    const args = process.argv.slice(2);

    // Parse flags
    const testMode = args.includes('--test');
    const force = args.includes('--force');

    // Parse named arguments
    function getArg(name) {
        const idx = args.indexOf(`--${name}`);
        return idx !== -1 && idx + 1 < args.length ? args[idx + 1] : null;
    }

    const handle = getArg('handle');
    const collectionId = getArg('collection');
    const category = getArg('category');

    if (!handle && !collectionId) {
        console.log('Extract Design from Design-Hero Images & Run Full Pipeline');
        console.log('');
        console.log('Usage:');
        console.log('  # Process a single product (test mode)');
        console.log('  node extract-and-pipeline.js --handle fix-my-life-tee --category cat-lovers --test');
        console.log('');
        console.log('  # Process a single product (production - upload + activate)');
        console.log('  node extract-and-pipeline.js --handle fix-my-life-tee --category cat-lovers');
        console.log('');
        console.log('  # Process entire collection (test mode)');
        console.log('  node extract-and-pipeline.js --collection 648127185181 --category cat-lovers --test');
        console.log('');
        console.log('  # Process entire collection (production)');
        console.log('  node extract-and-pipeline.js --collection 648127185181 --category cat-lovers');
        console.log('');
        console.log('Collections:');
        console.log('  648127185181  Lazy Cat T-Shirts    → category: cat-lovers');
        console.log('  647206043933  80s/90s Nostalgia    → category: meme-humor');
        console.log('');
        console.log('Flags:');
        console.log('  --test     Save locally for review (no upload, no activation)');
        console.log('  --force    Re-extract even if print-ready files already exist');
        console.log('');
        console.log('Extraction tuning (edit constants in script):');
        console.log(`  DARK_THRESHOLD: ${DARK_THRESHOLD} (luminance below this → transparent)`);
        console.log(`  FADE_RANGE: ${FADE_RANGE} (transition zone for smooth edges)`);
        console.log(`  MIN_ALPHA_KEEP: ${MIN_ALPHA_KEEP} (minimum alpha to retain)`);
        process.exit(1);
    }

    if (!category) {
        console.error('❌ --category is required');
        console.error('   Options: cat-lovers, meme-humor, developer, coffee-lovers, etc.');
        process.exit(1);
    }

    async function main() {
        if (handle) {
            // Single product mode
            const product = await fetchProductByHandle(handle);
            await processProduct(product, category, testMode);
        } else if (collectionId) {
            // Collection mode
            await processCollection(collectionId, category, testMode);
        }
    }

    main()
        .then(() => {
            console.log('✅ Done!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ Fatal error:', err.message);
            if (err.response) {
                console.error('Response:', JSON.stringify(err.response.data, null, 2));
            }
            process.exit(1);
        });
}

module.exports = { processProduct, processCollection, extractDesignFromDarkBg, createInvertedVariant };
