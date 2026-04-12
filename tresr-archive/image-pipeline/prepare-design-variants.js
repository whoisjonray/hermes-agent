/**
 * Prepare Design Variants for Product Image Generation
 * Takes a raw design and creates:
 * 1. Transparent version (white background removed)
 * 2. Inverted transparent version (for dark tees)
 */

const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

/**
 * Remove white background and make transparent
 */
async function removeWhiteBackground(inputPath, outputPath) {
    console.log(`  🧹 Removing white background...`);

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

        // If pixel is white or near-white, make it transparent
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
        raw: {
            width,
            height,
            channels
        }
    })
    .png()
    .toFile(outputPath);

    console.log(`  ✅ Created: ${outputPath}`);
}

/**
 * Create inverted design with transparent background
 */
async function createInvertedDesign(inputPath, outputPath) {
    console.log(`  🔄 Creating inverted design...`);

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

        // If white, make transparent; otherwise invert colors
        if (r > 250 && g > 250 && b > 250) {
            newData[i] = 0;
            newData[i + 1] = 0;
            newData[i + 2] = 0;
            newData[i + 3] = 0;
        } else {
            // Invert the color but keep alpha
            newData[i] = 255 - r;
            newData[i + 1] = 255 - g;
            newData[i + 2] = 255 - b;
            newData[i + 3] = a;
        }
    }

    await sharp(newData, {
        raw: {
            width,
            height,
            channels
        }
    })
    .png()
    .toFile(outputPath);

    console.log(`  ✅ Created: ${outputPath}`);
}

/**
 * Prepare both design variants
 */
async function prepareDesignVariants(inputPath, outputDir, slug) {
    console.log(`\n🎨 PREPARING DESIGN VARIANTS FOR: ${slug}`);
    console.log('='.repeat(60));
    console.log(`Input: ${inputPath}`);
    console.log(`Output: ${outputDir}`);
    console.log('='.repeat(60) + '\n');

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const transparentPath = path.join(outputDir, `${slug}-transparent.png`);
    const invertedPath = path.join(outputDir, `${slug}-inverted-transparent.png`);

    try {
        // Step 1: Remove white background
        await removeWhiteBackground(inputPath, transparentPath);

        // Step 2: Create inverted version
        await createInvertedDesign(inputPath, invertedPath);

        console.log('\n' + '='.repeat(60));
        console.log('✅ DESIGN VARIANTS READY');
        console.log('='.repeat(60));
        console.log(`\n📁 Light tees (white): ${transparentPath}`);
        console.log(`📁 Dark tees (black/navy): ${invertedPath}\n`);

        console.log('📋 Next step - Generate product images:\n');
        console.log(`node scripts/image-pipeline/generate-all-product-images.js \\`);
        console.log(`  "${invertedPath}" \\`);
        console.log(`  "${transparentPath}" \\`);
        console.log(`  "category-name" \\`);
        console.log(`  "${slug}" \\`);
        console.log(`  --test\n`);

        return {
            transparent: transparentPath,
            inverted: invertedPath
        };

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        throw error;
    }
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('Usage: node prepare-design-variants.js <inputPath> <slug> [outputDir]');
        console.log('');
        console.log('Parameters:');
        console.log('  inputPath  - Path to raw design PNG (dark text on white/transparent bg)');
        console.log('  slug       - Design slug (e.g., "my-design")');
        console.log('  outputDir  - Output directory (default: temp/)');
        console.log('');
        console.log('Example:');
        console.log('  node prepare-design-variants.js \\');
        console.log('    designs/production/raw/my-design.png \\');
        console.log('    my-design');
        console.log('');
        console.log('This creates:');
        console.log('  - temp/my-design-transparent.png (dark text, for white tees)');
        console.log('  - temp/my-design-inverted-transparent.png (light text, for dark tees)');
        process.exit(1);
    }

    const inputPath = args[0];
    const slug = args[1];
    const outputDir = args[2] || path.join(__dirname, '../../temp');

    if (!fs.existsSync(inputPath)) {
        console.error(`❌ Input file not found: ${inputPath}`);
        process.exit(1);
    }

    prepareDesignVariants(inputPath, outputDir, slug)
        .then((result) => {
            console.log('✅ Done!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ Failed:', err.message);
            process.exit(1);
        });
}

module.exports = { prepareDesignVariants, removeWhiteBackground, createInvertedDesign };
