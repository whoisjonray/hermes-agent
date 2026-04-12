/**
 * Generate Flat Mockups (Positions 3-5)
 * Creates flat tee mockups on white background
 * One for each color: black, navy, white
 */

const sharp = require('sharp');
const cloudinary = require('cloudinary').v2;
const https = require('https');
const fs = require('fs');
const path = require('path');

// Configure Cloudinary
cloudinary.config({
    cloud_name: 'dqslerzk9',
    api_key: '364274988183368',
    api_secret: 'gJEAx4VjStv1uTKyi3DiLAwL8pQ'
});

const BLANK_TEE_TEMPLATES = {
    black: path.join(__dirname, '../../internal/tresr-pod-bot/backgrounds/blank-black-tee-whitebg.png'),
    navy: path.join(__dirname, '../../internal/tresr-pod-bot/backgrounds/blank-navy-tee-whitebg-2048.png'),
    white: path.join(__dirname, '../../internal/tresr-pod-bot/backgrounds/blank-white-tee-whitebg-2048.png')
};

/**
 * Download image from URL or copy from local path
 */
async function downloadImage(url, filepath) {
    // If it's a local file path, just copy it
    if (fs.existsSync(url)) {
        return new Promise((resolve, reject) => {
            fs.copyFile(url, filepath, (err) => {
                if (err) reject(err);
                else resolve(filepath);
            });
        });
    }

    // Otherwise download from URL
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(filepath);
        https.get(url, (response) => {
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve(filepath);
            });
        }).on('error', (err) => {
            fs.unlink(filepath, () => {});
            reject(err);
        });
    });
}

/**
 * Generate flat mockup for one color
 * @param {string} darkDesignUrl - Design URL for dark tees (light text/inverted)
 * @param {string} lightDesignUrl - Design URL for light tees (dark text/raw)
 * @param {string} color - 'black', 'navy', or 'white'
 * @param {string} slug - Design slug for output filename
 */
async function generateSingleFlatMockup(darkDesignUrl, lightDesignUrl, color, slug) {
    console.log(`  📦 Generating ${color} flat mockup...`);

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempDesignPath = path.join(tempDir, `${slug}-${color}-design.png`);
    const outputPath = path.join(tempDir, `${slug}-${color}-flat.png`);

    try {
        // 1. Select correct design variant based on tee color
        const designUrl = (color === 'white') ? lightDesignUrl : darkDesignUrl;
        console.log(`    🎨 Using ${color === 'white' ? 'dark text' : 'light text'} design variant`);

        await downloadImage(designUrl, tempDesignPath);

        // 2. Get blank tee dimensions
        const teeMeta = await sharp(BLANK_TEE_TEMPLATES[color]).metadata();
        const teeWidth = teeMeta.width;
        const teeHeight = teeMeta.height;

        console.log(`    📐 Tee template: ${teeWidth}x${teeHeight}`);

        // 3. Auto-trim transparent/white edges so we scale the actual artwork, not padding
        const trimmedDesign = await sharp(tempDesignPath)
            .trim({ threshold: 20 })
            .png()
            .toBuffer();
        const trimmedMeta = await sharp(trimmedDesign).metadata();
        console.log(`    ✂️  Trimmed to: ${trimmedMeta.width}x${trimmedMeta.height}`);

        // 4. Calculate design dimensions (27% of tee width, max 27% of tee height)
        const designWidth = Math.round(teeWidth * 0.27);
        const designMaxHeight = Math.round(teeHeight * 0.27);

        // Resize design proportionally with high-quality interpolation
        // Constrain by both width AND height so tall designs don't overflow
        const resizedDesign = await sharp(trimmedDesign)
            .resize(designWidth, designMaxHeight, {
                fit: 'inside',
                background: { r: 0, g: 0, b: 0, alpha: 0 },
                kernel: 'lanczos3'  // High-quality upscaling
            })
            .png()
            .toBuffer();

        const designMeta = await sharp(resizedDesign).metadata();
        console.log(`    📏 Design scaled to: ${designMeta.width}x${designMeta.height}`);

        // 4. Calculate position with proportional Y offset
        // Base offset is 480px for 2048px templates, scale proportionally
        const baseOffset = 480;
        const baseTemplateSize = 2048;
        const designX = Math.round((teeWidth - designMeta.width) / 2);
        const designY = Math.round((baseOffset / baseTemplateSize) * teeHeight);

        console.log(`    📍 Position: X=${designX}, Y=${designY} (scaled from base ${baseOffset})`);

        // 5. Composite design onto blank tee
        await sharp(BLANK_TEE_TEMPLATES[color])
            .composite([{
                input: resizedDesign,
                top: designY,
                left: designX
            }])
            .png()
            .toFile(outputPath);

        console.log(`    ✅ Generated: ${outputPath}`);

        // Cleanup
        fs.unlinkSync(tempDesignPath);

        return outputPath;

    } catch (error) {
        console.error(`    ❌ Error generating ${color} flat:`, error.message);
        throw error;
    }
}

/**
 * Generate all 3 flat mockups (black, navy, white)
 * @param {string} darkDesignUrl - Design URL for dark tees (light text/inverted)
 * @param {string} lightDesignUrl - Design URL for light tees (dark text/raw)
 * @param {string} slug - Design slug
 * @param {boolean} testMode - If true, save locally instead of uploading
 */
async function generateFlatMockups(darkDesignUrl, lightDesignUrl, slug, testMode = false) {
    console.log(`\n👕 Generating flat mockups for: ${slug}`);
    console.log(`  🌙 Dark design: ${darkDesignUrl}`);
    console.log(`  ☀️  Light design: ${lightDesignUrl}`);

    const results = {};

    try {
        for (const color of ['black', 'navy', 'white']) {
            const outputPath = await generateSingleFlatMockup(darkDesignUrl, lightDesignUrl, color, slug);

            if (testMode) {
                console.log(`  🧪 TEST MODE: Saved ${color} to ${outputPath}`);
                results[color] = outputPath;
            } else {
                console.log(`  ⬆️  Uploading ${color} to Cloudinary...`);
                const result = await cloudinary.uploader.upload(outputPath, {
                    public_id: `tresr/product-images/flat/${slug}-${color}`,
                    resource_type: 'image',
                    overwrite: true,
                    invalidate: true
                });

                console.log(`  ✅ Uploaded ${color}: ${result.secure_url}`);
                results[color] = result.secure_url;

                // Cleanup
                fs.unlinkSync(outputPath);
            }
        }

        return results;

    } catch (error) {
        console.error(`❌ Error generating flat mockups:`, error.message);
        throw error;
    }
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    const flags = args.filter(arg => arg.startsWith('--'));
    const positionalArgs = args.filter(arg => !arg.startsWith('--'));

    if (positionalArgs.length < 3) {
        console.log('Usage: node generate-flat-mockups.js <darkDesignUrl> <lightDesignUrl> <slug> [--test]');
        console.log('');
        console.log('Parameters:');
        console.log('  darkDesignUrl  - Design with light text (for black/navy tees)');
        console.log('  lightDesignUrl - Design with dark text (for white tees)');
        console.log('  slug           - Design slug for output filename');
        console.log('');
        console.log('Example:');
        console.log('  node generate-flat-mockups.js \\');
        console.log('    designs/production/inverted/my-design-dark.png \\');
        console.log('    designs/production/raw/my-design.png \\');
        console.log('    my-design --test');
        process.exit(1);
    }

    const [darkDesignUrl, lightDesignUrl, slug] = positionalArgs;
    const testMode = flags.includes('--test');

    generateFlatMockups(darkDesignUrl, lightDesignUrl, slug, testMode)
        .then((results) => {
            console.log('\n✅ SUCCESS');
            console.log('Generated flat mockups:');
            Object.entries(results).forEach(([color, url]) => {
                console.log(`  ${color}: ${url}`);
            });
        })
        .catch((err) => {
            console.error('\n❌ FAILED:', err.message);
            process.exit(1);
        });
}

module.exports = { generateFlatMockups };
