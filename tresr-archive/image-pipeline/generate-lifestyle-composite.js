/**
 * Generate Lifestyle Composite (Position 2)
 * Composites design onto transparent blank tee, then onto category background
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

const BLANK_TEE_TRANSPARENT = path.join(__dirname, '../../internal/tresr-pod-bot/backgrounds/blank-black-tee-transparent.png');
const BACKGROUNDS_DIR = path.join(__dirname, '../../internal/tresr-pod-bot/backgrounds/active');

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
 * Get category background file
 */
function getCategoryBackground(category) {
    const bgMap = {
        'cat-lovers': '9.1-cat-lovers-bg.png',
        'coffee-lovers': '1.1-coffee-bg.png',
        'crypto-web3': '3.1-crypto-bg.png',
        'developer': '5.1-developer-bg.png',
        'dog-lovers': '6.1-dog-lovers-bg.png',
        'entrepreneur': '8.1-entrepreneur-bg.png',
        'fitness-gym': '2.1-fitness-bg.png',
        'introvert-bookworm': '10.1-nostalgia-bg.png', // Using nostalgia bg
        'meme-humor': '11.1-meme-humor-bg.png',
        'gaming': '4.1-gaming-bg.png',
        'mental-health': '7.1-mental-health-bg.png'
    };

    const bgFile = bgMap[category];
    if (!bgFile) {
        throw new Error(`No background found for category: ${category}. Available: ${Object.keys(bgMap).join(', ')}`);
    }

    const bgPath = path.join(BACKGROUNDS_DIR, bgFile);
    if (!fs.existsSync(bgPath)) {
        throw new Error(`Background file not found: ${bgPath}`);
    }

    return bgPath;
}

/**
 * Generate lifestyle composite
 * @param {string} rawDesignUrl - Cloudinary URL for raw transparent design
 * @param {string} category - Category for background selection
 * @param {string} slug - Design slug
 * @param {boolean} testMode - If true, save locally instead of uploading
 */
async function generateLifestyleComposite(rawDesignUrl, category, slug, testMode = false) {
    console.log(`\n🎨 Generating lifestyle composite for: ${slug} (${category})`);

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempDesignPath = path.join(tempDir, `${slug}-design.png`);
    const tempTeeWithDesignPath = path.join(tempDir, `${slug}-tee-with-design.png`);
    const outputPath = path.join(tempDir, `${slug}-lifestyle.png`);

    try {
        // 1. Download raw design
        console.log('  ⬇️  Downloading raw design...');
        await downloadImage(rawDesignUrl, tempDesignPath);

        // 2. Get blank tee dimensions
        const teeMeta = await sharp(BLANK_TEE_TRANSPARENT).metadata();
        const teeWidth = teeMeta.width;
        const teeHeight = teeMeta.height;

        console.log(`  📐 Tee template: ${teeWidth}x${teeHeight}`);

        // 3. Auto-trim transparent/white edges so we scale the actual artwork, not padding
        const trimmedDesign = await sharp(tempDesignPath)
            .trim({ threshold: 20 })
            .png()
            .toBuffer();
        const trimmedMeta = await sharp(trimmedDesign).metadata();
        console.log(`  ✂️  Trimmed to: ${trimmedMeta.width}x${trimmedMeta.height}`);

        // 4. Calculate design dimensions (27% of tee width, max 27% of tee height)
        const designWidth = Math.round(teeWidth * 0.27);
        const designMaxHeight = Math.round(teeHeight * 0.27);

        // Resize design proportionally with high-quality interpolation
        // Constrain by both width AND height so tall designs don't overflow
        const resizedDesign = await sharp(trimmedDesign)
            .resize(designWidth, designMaxHeight, {
                fit: 'inside',
                background: { r: 0, g: 0, b: 0, alpha: 0 },
                kernel: 'lanczos3'
            })
            .png()
            .toBuffer();

        const designMeta = await sharp(resizedDesign).metadata();
        console.log(`  📏 Design scaled to: ${designMeta.width}x${designMeta.height}`);

        // 5. Calculate position (centered horizontally, 480px from top - matching flat mockups)
        const designX = Math.round((teeWidth - designMeta.width) / 2);
        const designY = 480;

        // 5. Composite design onto transparent blank tee
        console.log('  🎽 Compositing design onto transparent tee...');
        await sharp(BLANK_TEE_TRANSPARENT)
            .composite([{
                input: resizedDesign,
                top: designY,
                left: designX
            }])
            .png()
            .toFile(tempTeeWithDesignPath);

        // 6. Get category background
        const backgroundPath = getCategoryBackground(category);
        console.log(`  🖼️  Using background: ${path.basename(backgroundPath)}`);

        const bgMeta = await sharp(backgroundPath).metadata();
        console.log(`  📐 Background: ${bgMeta.width}x${bgMeta.height}`);

        // 7. Resize tee+design to match background, then composite
        console.log('  🎨 Compositing tee onto background...');
        const resizedTee = await sharp(tempTeeWithDesignPath)
            .resize(bgMeta.width, bgMeta.height, {
                fit: 'contain',
                background: { r: 0, g: 0, b: 0, alpha: 0 },
                kernel: 'lanczos3'
            })
            .png()
            .toBuffer();

        await sharp(backgroundPath)
            .composite([{
                input: resizedTee,
                top: 0,
                left: 0
            }])
            .png()
            .toFile(outputPath);

        console.log(`  ✅ Generated: ${outputPath}`);

        // Cleanup temp files
        fs.unlinkSync(tempDesignPath);
        fs.unlinkSync(tempTeeWithDesignPath);

        // 9. Upload or save locally
        if (testMode) {
            console.log(`  🧪 TEST MODE: Saved to ${outputPath}`);
            return outputPath;
        } else {
            console.log('  ⬆️  Uploading to Cloudinary...');
            const result = await cloudinary.uploader.upload(outputPath, {
                public_id: `tresr/product-images/lifestyle/${slug}`,
                resource_type: 'image',
                overwrite: true,
                invalidate: true
            });

            console.log(`  ✅ Uploaded: ${result.secure_url}`);

            // Cleanup
            fs.unlinkSync(outputPath);

            return result.secure_url;
        }

    } catch (error) {
        console.error(`  ❌ Error generating lifestyle composite:`, error.message);
        throw error;
    }
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length < 3) {
        console.log('Usage: node generate-lifestyle-composite.js <rawDesignUrl> <category> <slug> [--test]');
        console.log('Example: node generate-lifestyle-composite.js https://res.cloudinary.com/.../design.png developer my-design --test');
        console.log('\nAvailable categories:');
        console.log('  cat-lovers, coffee-lovers, crypto-web3, developer, dog-lovers,');
        console.log('  entrepreneur, fitness-gym, introvert-bookworm, meme-humor, openclaw, ai-trending');
        process.exit(1);
    }

    const [rawDesignUrl, category, slug] = args;
    const testMode = args.includes('--test');

    generateLifestyleComposite(rawDesignUrl, category, slug, testMode)
        .then((url) => {
            console.log('\n✅ SUCCESS');
            console.log(`Output: ${url}`);
        })
        .catch((err) => {
            console.error('\n❌ FAILED:', err.message);
            process.exit(1);
        });
}

module.exports = { generateLifestyleComposite };
