/**
 * Batch Process Collection
 * Generates and uploads product images for all products in a collection
 */

const { generateAllProductImages } = require('./generate-all-product-images');
const { updateShopifyProductImages } = require('./update-shopify-product-images');
const fs = require('fs');
const path = require('path');

const PRINT_READY_DIR = path.join(__dirname, '../../output/print-ready');
const TEMP_DIR = path.join(__dirname, '../../temp');

// Products already completed
const DONE = new Set([
    'already-fumbled-2026-tee',
    'cats-over-people-tee',
    'building-in-public-tee',
    'cat-servant-tee',
    '404-social-skills-not-found',
    'bought-the-dip-tee',
    'cat-person-tee',
    'but-first-coffee-tee',
    'im-not-a-robot-tee'
]);

// Map product handle to design slug in print-ready folder
const SLUG_OVERRIDES = {
    // Verified matches with different naming
    'my-neural-network-runs-on-coffee-and-existential-dread': 'neural-network-coffee',
    'passed-the-turing-test-failed-the-vibe-check': 'turing-test-vibe-check',
    'pov-youre-an-ai-and-its-monday': 'pov-ai-monday',
    'openclaw-classic-claw-tee': 'openclaw-classic',
    'security-by-trusting-a-lobster-tee': 'security-by-lobster',
    'i-think-therefore-i-wait-do-i': 'i-think-therefore',
    'openclaw-tee': 'dot-openclaw',
    // Print-ready now available
    '404-motivation-not-found-tee': '404-motivation',
    'job-security-vs-ai-tee': 'job-security-vs-ai-clean',
    // Already processed on Shopify (old pipeline) - skip
    'i-automated-my-job-tee': null,
    'i-read-the-docs-tee': null,
    'it-works-on-my-reef-tee': null,
    'my-code-works-and-i-dont-know-why-tee': null,
    'my-conversion-rate-is-a-rounding-error-tee': null,
    'powered-by-coffee-and-existential-dread-tee': null,
    'vibe-coder-needs-debugger-tee': null,
    'works-on-my-machine-tee': null,
    'zero-to-one-tee': null,
};

// Category mapping for backgrounds
const CATEGORY_MAP = {
    'cat-lovers': 'cat-lovers',
    'coffee-lovers': 'coffee-lovers',
    'crypto-web3': 'crypto-web3',
    'developer': 'developer',
    'dog-lovers': 'dog-lovers',
    'entrepreneur': 'entrepreneur',
    'fitness-gym': 'fitness-gym',
    'gaming': 'gaming',
    'meme-humor': 'meme-humor',
    'mental-health': 'mental-health',
    'introvert': 'meme-humor',
    'openclaw': 'developer',
    'lobster': 'developer',
    'unknown': 'meme-humor',
};

function getSlug(handle) {
    if (SLUG_OVERRIDES[handle] !== undefined) return SLUG_OVERRIDES[handle];
    // Strip -tee suffix
    return handle.replace(/-tee$/, '');
}

function hasDesign(slug) {
    if (!slug) return false;
    const darkPath = path.join(PRINT_READY_DIR, `${slug}-for-dark.png`);
    const lightPath = path.join(PRINT_READY_DIR, `${slug}-for-light.png`);
    return fs.existsSync(darkPath) && fs.existsSync(lightPath);
}

async function processProduct(handle, category) {
    const slug = getSlug(handle);
    if (!slug || !hasDesign(slug)) {
        console.log(`⏭️  SKIPPING ${handle} - no print-ready design found for slug: ${slug}`);
        return false;
    }

    const bgCategory = CATEGORY_MAP[category] || 'meme-humor';

    console.log(`\n${'═'.repeat(60)}`);
    console.log(`🎯 PROCESSING: ${handle} (${bgCategory})`);
    console.log(`${'═'.repeat(60)}`);

    // Copy print-ready to temp
    const darkSrc = path.join(PRINT_READY_DIR, `${slug}-for-dark.png`);
    const lightSrc = path.join(PRINT_READY_DIR, `${slug}-for-light.png`);
    const darkDest = path.join(TEMP_DIR, `${slug}-inverted-transparent.png`);
    const lightDest = path.join(TEMP_DIR, `${slug}-transparent.png`);

    fs.copyFileSync(darkSrc, darkDest);
    fs.copyFileSync(lightSrc, lightDest);

    // Generate images in test mode (saves locally)
    await generateAllProductImages(
        darkDest,
        lightDest,
        bgCategory,
        slug,
        true // test mode - save locally first
    );

    // Upload to Shopify from local files
    const localImagePaths = {
        lifestyle: path.join(TEMP_DIR, `${slug}-lifestyle.png`),
        punchin: path.join(TEMP_DIR, `${slug}-punchin.png`),
        black: path.join(TEMP_DIR, `${slug}-black-flat.png`),
        navy: path.join(TEMP_DIR, `${slug}-navy-flat.png`),
        white: path.join(TEMP_DIR, `${slug}-white-flat.png`)
    };

    await updateShopifyProductImages(localImagePaths, handle, slug);

    console.log(`✅ COMPLETE: https://tresr.com/products/${handle}\n`);
    return true;
}

// Product list with categories from Shopify
const PRODUCTS = [
    ['404-motivation-not-found-tee', 'developer'],
    ['catnap-protocol-engaged-tee', 'cat-lovers'],
    ['coffee-without-bugs-tee', 'coffee-lovers'],
    ['ctrl-z-my-life-choices-tee', 'meme-humor'],
    ['currently-avoiding-humans-tee', 'meme-humor'],
    ['death-before-decaf-tee', 'coffee-lovers'],
    ['decentralize-everything-tee', 'crypto-web3'],
    ['depresso-tee', 'coffee-lovers'],
    ['diamond-hands-tee', 'crypto-web3'],
    ['do-not-disturb-tee', 'meme-humor'],
    ['dog-dad-tee', 'dog-lovers'],
    ['dog-person-tee', 'dog-lovers'],
    ['dyor-tee', 'crypto-web3'],
    ['espresso-yourself-tee', 'coffee-lovers'],
    ['exfoliate-tee', 'developer'],
    ['fail-fast-fail-often-tee', 'entrepreneur'],
    ['funded-by-stubbornness-tee', 'entrepreneur'],
    ['git-commit-fixed-it-tee', 'developer'],
    ['grounds-for-celebration-tee', 'coffee-lovers'],
    ['home-is-where-the-dog-is-tee', 'dog-lovers'],
    ['hustle-in-silence-tee', 'entrepreneur'],
    ['i-automated-my-job-tee', 'entrepreneur'],
    ['i-hodl-therefore-i-am-tee', 'crypto-web3'],
    ['i-mass-deleted-seo-tee', 'entrepreneur'],
    ['i-molted-for-this-tee', 'developer'],
    ['i-pivoted-7-times-tee', 'entrepreneur'],
    ['i-read-the-docs-tee', 'developer'],
    ['i-think-therefore-i-wait-do-i', 'meme-humor'],
    ['i-was-normal-three-dogs-ago-tee', 'dog-lovers'],
    ['i-work-hard-so-my-cat-tee', 'cat-lovers'],
    ['id-rather-be-reading-tee', 'meme-humor'],
    ['if-it-fits-i-sits-tee', 'cat-lovers'],
    ['in-blockchain-we-trust-tee', 'crypto-web3'],
    ['in-dog-years-im-dead-tee', 'dog-lovers'],
    ['introvert-loading-tee', 'meme-humor'],
    ['it-works-on-my-reef-tee', 'developer'],
    ['its-a-feature-not-a-bug-tee', 'meme-humor'],
    ['job-security-vs-ai-tee', 'meme-humor'],
    ['life-is-better-with-a-dog-tee', 'dog-lovers'],
    ['mass-delete-mondays-tee', 'developer'],
    ['meow-or-never-tee', 'cat-lovers'],
    ['mvp-first-perfect-later-tee', 'entrepreneur'],
    ['my-code-works-and-i-dont-know-why-tee', 'developer'],
    ['my-conversion-rate-is-a-rounding-error-tee', 'entrepreneur'],
    ['my-neural-network-runs-on-coffee-and-existential-dread', 'developer'],
    ['my-therapist-is-a-chatbot-tee', 'meme-humor'],
    ['my-weekend-plans-nothing-tee', 'meme-humor'],
    ['no-place-like-127-tee', 'developer'],
    ['not-my-cat-tee', 'cat-lovers'],
    ['not-your-keys-not-your-coins-tee', 'crypto-web3'],
    ['one-more-chapter-tee', 'meme-humor'],
    ['openclaw-classic-claw-tee', 'developer'],
    ['passed-the-turing-test-failed-the-vibe-check', 'developer'],
    ['paws-and-reflect-tee', 'cat-lovers'],
    ['pawsitive-vibes-only-tee', 'dog-lovers'],
    ['pour-decisions-tee', 'coffee-lovers'],
    ['pov-youre-an-ai-and-its-monday', 'developer'],
    ['powered-by-books-and-anxiety-tee', 'meme-humor'],
    ['powered-by-coffee-and-existential-dread-tee', 'coffee-lovers'],
    ['probably-nothing-tee', 'crypto-web3'],
    ['security-by-trusting-a-lobster-tee', 'developer'],
    ['ship-it-tee', 'entrepreneur'],
    ['socially-unavailable-tee', 'meme-humor'],
    ['sorry-i-cant-my-dog-said-no-tee', 'dog-lovers'],
    ['sorry-im-late-tee', 'meme-humor'],
    ['space-lobster-tee', 'developer'],
    ['still-here-still-building-tee', 'entrepreneur'],
    ['sudo-make-me-a-sandwich-tee', 'developer'],
    ['talk-nerdy-to-me-tee', 'developer'],
    ['the-claw-is-the-law-tee', 'developer'],
    ['the-great-molt-tee', 'developer'],
    ['this-is-fine-tee', 'meme-humor'],
    ['trust-the-process-tee', 'entrepreneur'],
    ['vibe-coder-needs-debugger-tee', 'developer'],
    ['wagmi-tee', 'crypto-web3'],
    ['wake-up-smell-the-compile-tee', 'coffee-lovers'],
    ['who-rescued-who-tee', 'dog-lovers'],
    ['works-on-my-machine-tee', 'developer'],
    ['zero-to-one-tee', 'entrepreneur'],
    ['openclaw-tee', 'developer'],
];

async function main() {
    let processed = 0;
    let skipped = 0;
    let failed = 0;
    const errors = [];

    for (const [handle, category] of PRODUCTS) {
        if (DONE.has(handle)) {
            console.log(`✅ ALREADY DONE: ${handle}`);
            continue;
        }

        try {
            const success = await processProduct(handle, category);
            if (success) {
                processed++;
            } else {
                skipped++;
            }
        } catch (error) {
            console.error(`❌ FAILED: ${handle} - ${error.message}`);
            errors.push({ handle, error: error.message });
            failed++;
        }

        // Small delay to avoid rate limiting
        await new Promise(r => setTimeout(r, 1000));
    }

    console.log(`\n${'═'.repeat(60)}`);
    console.log('📊 BATCH PROCESSING COMPLETE');
    console.log(`${'═'.repeat(60)}`);
    console.log(`✅ Processed: ${processed}`);
    console.log(`⏭️  Skipped: ${skipped}`);
    console.log(`❌ Failed: ${failed}`);
    if (errors.length > 0) {
        console.log('\nFailed products:');
        errors.forEach(e => console.log(`  - ${e.handle}: ${e.error}`));
    }
}

main().catch(err => {
    console.error('Fatal error:', err);
    process.exit(1);
});
