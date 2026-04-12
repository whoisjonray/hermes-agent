#!/usr/bin/env node

/**
 * Generate Lifestyle Photos (Positions 6 & 7)
 * Composites design onto pre-generated lifestyle templates using Sharp.js
 * Same proven approach as flat mockups (positions 3-5) but on lifestyle photos
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

const TEMPLATES_DIR = path.join(__dirname, '../../templates/lifestyle');

// Per-template placement config (calibrated for 1024x1024 Gemini templates)
// x,y = top-left corner of design placement; width = design width in pixels
// These values will be calibrated after template regeneration with front-facing poses
const TEMPLATE_CONFIG = {
    'lifestyle-male-1-mental-health.png':   { x: 380, y: 420, width: 240 },
    'lifestyle-male-2-developer.png':       { x: 380, y: 420, width: 240 },
    'lifestyle-male-3-coffee.png':          { x: 380, y: 420, width: 240 },
    'lifestyle-male-4-entrepreneur.png':    { x: 380, y: 420, width: 240 },
    'lifestyle-female-1-mental-health.png': { x: 390, y: 410, width: 220 },
    'lifestyle-female-2-developer.png':     { x: 390, y: 410, width: 220 },
    'lifestyle-female-3-fitness.png':       { x: 390, y: 410, width: 220 },
    'lifestyle-female-4-entrepreneur.png':  { x: 390, y: 410, width: 220 }
};

/**
 * Download image from URL or copy from local path
 */
async function downloadImage(url, filepath) {
    if (fs.existsSync(url)) {
        return new Promise((resolve, reject) => {
            fs.copyFile(url, filepath, (err) => {
                if (err) reject(err);
                else resolve(filepath);
            });
        });
    }

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
 * Composite design onto a single lifestyle template
 * @param {string} designPath - Local path to design PNG
 * @param {string} templateFilename - Template filename (e.g. 'lifestyle-male-1-mental-health.png')
 * @param {string} slug - Design slug for output naming
 * @param {string} gender - 'male' or 'female'
 * @returns {string} Output file path
 */
async function compositeOnTemplate(designPath, templateFilename, slug, gender) {
    const config = TEMPLATE_CONFIG[templateFilename];
    if (!config) {
        throw new Error(`No config for template: ${templateFilename}`);
    }

    const templatePath = path.join(TEMPLATES_DIR, templateFilename);
    if (!fs.existsSync(templatePath)) {
        throw new Error(`Template not found: ${templatePath}`);
    }

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const outputPath = path.join(tempDir, `${slug}-lifestyle-${gender}.png`);

    console.log(`    📐 Template: ${templateFilename}`);
    console.log(`    📍 Placement: x=${config.x}, y=${config.y}, width=${config.width}`);

    // 1. Resize design to configured width with high-quality interpolation
    const resizedDesign = await sharp(designPath)
        .resize(config.width, null, {
            fit: 'contain',
            background: { r: 0, g: 0, b: 0, alpha: 0 },
            kernel: 'lanczos3'
        })
        .png()
        .toBuffer();

    const designMeta = await sharp(resizedDesign).metadata();
    console.log(`    📏 Design scaled to: ${designMeta.width}x${designMeta.height}`);

    // 2. Reduce opacity to ~90% for natural fabric feel
    //    Extract channels, reduce alpha, recombine
    const { data, info } = await sharp(resizedDesign)
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    // Scale alpha channel to 90%
    for (let i = 3; i < data.length; i += 4) {
        data[i] = Math.round(data[i] * 0.90);
    }

    const opacityDesign = await sharp(data, {
        raw: { width: info.width, height: info.height, channels: info.channels }
    }).png().toBuffer();

    // 3. Soften edges: slight blur on alpha for natural blend
    //    Extract alpha, blur it slightly, recombine
    const alphaChannel = await sharp(opacityDesign)
        .extractChannel(3)
        .blur(1.2)
        .toBuffer();

    // Get RGB channels
    const rgbBuffer = await sharp(opacityDesign)
        .removeAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

    // Recombine RGB + blurred alpha
    const finalDesignData = Buffer.alloc(rgbBuffer.info.width * rgbBuffer.info.height * 4);
    for (let i = 0; i < rgbBuffer.info.width * rgbBuffer.info.height; i++) {
        finalDesignData[i * 4] = rgbBuffer.data[i * 3];       // R
        finalDesignData[i * 4 + 1] = rgbBuffer.data[i * 3 + 1]; // G
        finalDesignData[i * 4 + 2] = rgbBuffer.data[i * 3 + 2]; // B
        finalDesignData[i * 4 + 3] = alphaChannel[i];            // Blurred A
    }

    const blendedDesign = await sharp(finalDesignData, {
        raw: { width: rgbBuffer.info.width, height: rgbBuffer.info.height, channels: 4 }
    }).png().toBuffer();

    // 4. Composite design onto template using multiply blend for fabric integration
    await sharp(templatePath)
        .composite([{
            input: blendedDesign,
            top: config.y,
            left: config.x,
            blend: 'over'
        }])
        .png()
        .toFile(outputPath);

    // 5. Post-process: subtle noise + unified sharpening for cohesion
    const composited = await sharp(outputPath).toBuffer();

    // Create subtle noise overlay (8x8 tiled noise pattern)
    const templateMeta = await sharp(templatePath).metadata();
    const noiseWidth = templateMeta.width || 1024;
    const noiseHeight = templateMeta.height || 1024;

    // Generate noise buffer
    const noiseData = Buffer.alloc(noiseWidth * noiseHeight * 4);
    for (let i = 0; i < noiseWidth * noiseHeight; i++) {
        const noise = Math.round((Math.random() - 0.5) * 8); // subtle +/- 4 noise
        noiseData[i * 4] = 128 + noise;     // R
        noiseData[i * 4 + 1] = 128 + noise; // G
        noiseData[i * 4 + 2] = 128 + noise; // B
        noiseData[i * 4 + 3] = 10;          // Very low opacity
    }

    const noiseBuffer = await sharp(noiseData, {
        raw: { width: noiseWidth, height: noiseHeight, channels: 4 }
    }).png().toBuffer();

    // Apply noise overlay and light sharpening
    await sharp(composited)
        .composite([{
            input: noiseBuffer,
            blend: 'over'
        }])
        .sharpen({ sigma: 0.5 })
        .png()
        .toFile(outputPath);

    console.log(`    ✅ Generated: ${outputPath}`);
    return outputPath;
}

/**
 * Generate lifestyle photos for positions 6 & 7
 * Selects 1 male + 1 female template, composites design onto each
 * @param {string} darkDesignUrl - Design URL/path for dark tees (light text/inverted)
 * @param {string} slug - Design slug
 * @param {boolean} testMode - If true, save locally instead of uploading
 * @returns {Object} { male: url/path, female: url/path }
 */
async function generateLifestylePhotos(darkDesignUrl, slug, testMode = false) {
    console.log(`\n📸 Generating lifestyle photos for: ${slug}`);
    console.log(`  🎨 Design: ${darkDesignUrl}`);
    console.log(`  Mode: ${testMode ? 'TEST (local save)' : 'PRODUCTION (upload to Cloudinary)'}`);

    const tempDir = path.join(__dirname, '../../temp');
    if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
    }

    const tempDesignPath = path.join(tempDir, `${slug}-lifestyle-design.png`);

    try {
        // 1. Download/copy design locally
        console.log('  ⬇️  Preparing design...');
        await downloadImage(darkDesignUrl, tempDesignPath);

        // 2. Select one male + one female template (first of each)
        const maleTemplates = [
            'lifestyle-male-1-mental-health.png',
            'lifestyle-male-2-developer.png',
            'lifestyle-male-3-coffee.png',
            'lifestyle-male-4-entrepreneur.png'
        ];

        const femaleTemplates = [
            'lifestyle-female-1-mental-health.png',
            'lifestyle-female-2-developer.png',
            'lifestyle-female-3-fitness.png',
            'lifestyle-female-4-entrepreneur.png'
        ];

        // Use first available template of each gender
        const maleTemplate = maleTemplates.find(t => fs.existsSync(path.join(TEMPLATES_DIR, t)));
        const femaleTemplate = femaleTemplates.find(t => fs.existsSync(path.join(TEMPLATES_DIR, t)));

        if (!maleTemplate) throw new Error(`No male templates found in ${TEMPLATES_DIR}`);
        if (!femaleTemplate) throw new Error(`No female templates found in ${TEMPLATES_DIR}`);

        console.log(`\n  👨 Male template: ${maleTemplate}`);
        const malePath = await compositeOnTemplate(tempDesignPath, maleTemplate, slug, 'male');

        console.log(`\n  👩 Female template: ${femaleTemplate}`);
        const femalePath = await compositeOnTemplate(tempDesignPath, femaleTemplate, slug, 'female');

        // Cleanup temp design
        fs.unlinkSync(tempDesignPath);

        // 3. Upload or return local paths
        if (testMode) {
            console.log(`\n  🧪 TEST MODE: Images saved locally`);
            console.log(`    Male:   ${malePath}`);
            console.log(`    Female: ${femalePath}`);

            return {
                male: malePath,
                female: femalePath
            };
        } else {
            console.log(`\n  ⬆️  Uploading to Cloudinary...`);

            const maleUpload = await cloudinary.uploader.upload(malePath, {
                public_id: `tresr/product-images/lifestyle-photo/${slug}-male`,
                resource_type: 'image',
                overwrite: true,
                invalidate: true
            });

            const femaleUpload = await cloudinary.uploader.upload(femalePath, {
                public_id: `tresr/product-images/lifestyle-photo/${slug}-female`,
                resource_type: 'image',
                overwrite: true,
                invalidate: true
            });

            console.log(`  ✅ Male uploaded:   ${maleUpload.secure_url}`);
            console.log(`  ✅ Female uploaded: ${femaleUpload.secure_url}`);

            // Cleanup local files
            fs.unlinkSync(malePath);
            fs.unlinkSync(femalePath);

            return {
                male: maleUpload.secure_url,
                female: femaleUpload.secure_url
            };
        }

    } catch (error) {
        console.error(`  ❌ Error generating lifestyle photos:`, error.message);
        // Cleanup on error
        if (fs.existsSync(tempDesignPath)) fs.unlinkSync(tempDesignPath);
        throw error;
    }
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    const flags = args.filter(arg => arg.startsWith('--'));
    const positionalArgs = args.filter(arg => !arg.startsWith('--'));

    if (positionalArgs.length < 2) {
        console.log('Usage: node generate-lifestyle-photos.js <darkDesignUrl> <slug> [--test]');
        console.log('');
        console.log('Composites design onto lifestyle templates using Sharp.js');
        console.log('Produces 1 male + 1 female lifestyle photo (positions 6 & 7)');
        console.log('');
        console.log('Parameters:');
        console.log('  darkDesignUrl  - Design with light text (for black tees) - URL or local path');
        console.log('  slug           - Design slug for output filename');
        console.log('');
        console.log('Flags:');
        console.log('  --test  Save locally instead of uploading to Cloudinary');
        console.log('');
        console.log('Examples:');
        console.log('  # Test mode (saves locally for review)');
        console.log('  node generate-lifestyle-photos.js \\');
        console.log('    temp/my-therapist-is-a-chatbot-tee-inverted-transparent.png \\');
        console.log('    my-therapist-is-a-chatbot-tee \\');
        console.log('    --test');
        console.log('');
        console.log('  # Production mode (uploads to Cloudinary)');
        console.log('  node generate-lifestyle-photos.js \\');
        console.log('    temp/my-design-inverted-transparent.png \\');
        console.log('    my-design');
        process.exit(1);
    }

    const [darkDesignUrl, slug] = positionalArgs;
    const testMode = flags.includes('--test');

    generateLifestylePhotos(darkDesignUrl, slug, testMode)
        .then((results) => {
            console.log('\n✅ SUCCESS');
            console.log('Generated lifestyle photos:');
            console.log(`  Male:   ${results.male}`);
            console.log(`  Female: ${results.female}`);
        })
        .catch((err) => {
            console.error('\n❌ FAILED:', err.message);
            process.exit(1);
        });
}

module.exports = { generateLifestylePhotos };
