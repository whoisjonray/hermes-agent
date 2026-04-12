/**
 * Generate All Product Images (Positions 1-5)
 * Wrapper that calls all generators in sequence
 */

const { generatePunchinCloseup } = require('./generate-punchin-closeup');
const { generateLifestyleComposite } = require('./generate-lifestyle-composite');
const { generateFlatMockups } = require('./generate-flat-mockups');
const path = require('path');

/**
 * Generate all 5 product images
 * @param {string} darkDesignUrl - Design with light text (for dark tees/black bg)
 * @param {string} lightDesignUrl - Design with dark text (for white tees)
 * @param {string} category - Category for background selection
 * @param {string} slug - Design slug
 * @param {boolean} testMode - If true, save locally and preview before uploading
 * @returns {Object} URLs for all 5 images
 */
async function generateAllProductImages(darkDesignUrl, lightDesignUrl, category, slug, testMode = false) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎨 GENERATING ALL PRODUCT IMAGES FOR: ${slug.toUpperCase()}`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Dark Design (light text): ${darkDesignUrl}`);
    console.log(`Light Design (dark text): ${lightDesignUrl}`);
    console.log(`Category: ${category}`);
    console.log(`Mode: ${testMode ? 'TEST (local save)' : 'PRODUCTION (upload to Cloudinary)'}`);
    console.log(`${'='.repeat(60)}\n`);

    const results = {};

    try {
        // Position 1: Lifestyle composite - uses dark design (first image seen from ads)
        console.log('\n📍 POSITION 1: Lifestyle Composite');
        console.log('━'.repeat(60));
        results.lifestyle = await generateLifestyleComposite(darkDesignUrl, category, slug, testMode);

        // Position 2: Punchin closeup (3:4 portrait, black bg) - uses dark design
        console.log('\n📍 POSITION 2: Punchin Closeup');
        console.log('━'.repeat(60));
        results.punchin = await generatePunchinCloseup(darkDesignUrl, slug, testMode);

        // Positions 3-5: Flat mockups (black, navy, white) - automatically selects correct variant per color
        console.log('\n📍 POSITIONS 3-5: Flat Mockups');
        console.log('━'.repeat(60));
        const flats = await generateFlatMockups(darkDesignUrl, lightDesignUrl, slug, testMode);
        results.flat_black = flats.black;
        results.flat_navy = flats.navy;
        results.flat_white = flats.white;

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('✅ ALL 5 IMAGES GENERATED SUCCESSFULLY');
        console.log('='.repeat(60));
        console.log('\nImage URLs/Paths:');
        console.log(`  1️⃣  Lifestyle:         ${results.lifestyle}`);
        console.log(`  2️⃣  Punchin:           ${results.punchin}`);
        console.log(`  3️⃣  Flat (Black):      ${results.flat_black}`);
        console.log(`  4️⃣  Flat (Navy):       ${results.flat_navy}`);
        console.log(`  5️⃣  Flat (White):      ${results.flat_white}`);
        console.log('='.repeat(60) + '\n');

        if (testMode) {
            console.log('🧪 TEST MODE: Review images in ./temp/ folder');
            console.log('   If they look good, run again without --test flag to upload\n');
        }

        return results;

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        throw error;
    }
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);

    // Filter out flags to get positional arguments
    const positional = args.filter(arg => !arg.startsWith('--'));
    const testMode = args.includes('--test');

    if (positional.length < 4) {
        console.log('Usage: node generate-all-product-images.js <darkDesignUrl> <lightDesignUrl> <category> <slug> [--test]');
        console.log('\nGenerates all 5 product images:');
        console.log('  Position 1: Lifestyle composite (with category background) - first image from ads');
        console.log('  Position 2: Punchin closeup (3:4 portrait, black bg)');
        console.log('  Position 3: Flat mockup (black tee)');
        console.log('  Position 4: Flat mockup (navy tee)');
        console.log('  Position 5: Flat mockup (white tee)');
        console.log('\nParameters:');
        console.log('  darkDesignUrl  - Design with light text (for black/navy tees, punchin, lifestyle composites)');
        console.log('  lightDesignUrl - Design with dark text (for white tees)');
        console.log('  category       - Category for lifestyle composite background');
        console.log('  slug           - Design slug');
        console.log('\nExamples:');
        console.log('  # Test mode (saves locally for review)');
        console.log('  node generate-all-product-images.js \\');
        console.log('    designs/production/inverted/my-design-dark.png \\');
        console.log('    designs/production/raw/my-design.png \\');
        console.log('    developer my-design --test');
        console.log('\n  # Production mode (uploads to Cloudinary)');
        console.log('  node generate-all-product-images.js \\');
        console.log('    designs/production/inverted/my-design-dark.png \\');
        console.log('    designs/production/raw/my-design.png \\');
        console.log('    developer my-design');
        console.log('\nAvailable categories:');
        console.log('  mental-health, crypto-web3, developer, coffee-lovers, fitness-gym,');
        console.log('  entrepreneur, cat-lovers, dog-lovers, gaming, meme-humor');
        console.log('\nFlags:');
        console.log('  --test  Save locally instead of uploading (for preview)');
        process.exit(1);
    }

    const [darkDesignUrl, lightDesignUrl, category, slug] = positional;

    generateAllProductImages(darkDesignUrl, lightDesignUrl, category, slug, testMode)
        .then(() => {
            console.log('✅ Done!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ Failed:', err.message);
            process.exit(1);
        });
}

module.exports = { generateAllProductImages };
