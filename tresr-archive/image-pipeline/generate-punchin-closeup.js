/**
 * Generate Punchin Closeup (Position 1)
 * Creates 3:4 portrait (2048x2732) with black background
 * Design centered at 80% scale
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
 * Generate punchin closeup image
 * @param {string} rawDesignUrl - Cloudinary URL for raw transparent design
 * @param {string} slug - Design slug for output filename
 * @param {boolean} testMode - If true, save locally instead of uploading
 */
async function generatePunchinCloseup(rawDesignUrl, slug, testMode = false) {
    console.log(`\n📸 Generating punchin closeup for: ${slug}`);

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempDesignPath = path.join(tempDir, `${slug}-raw.png`);
    const outputPath = path.join(tempDir, `${slug}-punchin.png`);

    try {
        // 1. Download raw design
        console.log('  ⬇️  Downloading raw design...');
        await downloadImage(rawDesignUrl, tempDesignPath);

        // 2. Auto-trim transparent/white edges so we scale the actual artwork, not padding
        const trimmedDesign = await sharp(tempDesignPath)
            .trim({ threshold: 20 })
            .png()
            .toBuffer();
        const designMeta = await sharp(trimmedDesign).metadata();
        console.log(`  📐 Design size: ${designMeta.width}x${designMeta.height} (after trim)`);

        // 3. Calculate scaled dimensions (95% of canvas width, fit within bounds)
        const canvasWidth = 2048;
        const canvasHeight = 2732;
        const maxWidth = Math.round(canvasWidth * 0.95);
        const maxHeight = Math.round(canvasHeight * 0.95);

        // Scale to fit within 95% of canvas (maintain aspect ratio)
        let scaledWidth, scaledHeight;
        const widthRatio = maxWidth / designMeta.width;
        const heightRatio = maxHeight / designMeta.height;
        const scaleFactor = Math.min(widthRatio, heightRatio);

        scaledWidth = Math.round(designMeta.width * scaleFactor);
        scaledHeight = Math.round(designMeta.height * scaleFactor);

        console.log(`  📏 Scaled to: ${scaledWidth}x${scaledHeight} (fits within 95% of canvas)`);

        // 4. Resize design
        const resizedDesign = await sharp(trimmedDesign)
            .resize(scaledWidth, scaledHeight, {
                fit: 'inside',
                background: { r: 0, g: 0, b: 0, alpha: 0 }
            })
            .png()
            .toBuffer();

        // 5. Create black canvas and composite design centered
        const centerX = Math.round((canvasWidth - scaledWidth) / 2);
        const centerY = Math.round((canvasHeight - scaledHeight) / 2);

        await sharp({
            create: {
                width: canvasWidth,
                height: canvasHeight,
                channels: 4,
                background: { r: 0, g: 0, b: 0, alpha: 1 } // Pure black
            }
        })
        .composite([{
            input: resizedDesign,
            top: centerY,
            left: centerX
        }])
        .png()
        .toFile(outputPath);

        console.log(`  ✅ Generated: ${outputPath}`);

        // 6. Upload or save locally
        if (testMode) {
            console.log(`  🧪 TEST MODE: Saved to ${outputPath}`);
            return outputPath;
        } else {
            console.log('  ⬆️  Uploading to Cloudinary...');
            const result = await cloudinary.uploader.upload(outputPath, {
                public_id: `tresr/product-images/punchin/${slug}`,
                resource_type: 'image',
                overwrite: true,
                invalidate: true
            });

            console.log(`  ✅ Uploaded: ${result.secure_url}`);

            // Cleanup
            fs.unlinkSync(tempDesignPath);
            if (!testMode) fs.unlinkSync(outputPath);

            return result.secure_url;
        }

    } catch (error) {
        console.error(`  ❌ Error generating punchin:`, error.message);
        throw error;
    }
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('Usage: node generate-punchin-closeup.js <rawDesignUrl> <slug> [--test]');
        console.log('Example: node generate-punchin-closeup.js https://res.cloudinary.com/.../design.png my-design --test');
        process.exit(1);
    }

    const [rawDesignUrl, slug] = args;
    const testMode = args.includes('--test');

    generatePunchinCloseup(rawDesignUrl, slug, testMode)
        .then((url) => {
            console.log('\n✅ SUCCESS');
            console.log(`Output: ${url}`);
        })
        .catch((err) => {
            console.error('\n❌ FAILED:', err.message);
            process.exit(1);
        });
}

module.exports = { generatePunchinCloseup };
