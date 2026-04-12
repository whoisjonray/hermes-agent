#!/usr/bin/env node

/**
 * Map Design to All 8 Lifestyle Templates (Node.js Wrapper)
 * Calls Python perspective mapping script for all templates
 * Returns mapped images for positions 6 & 7 (male & female)
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
    cloud_name: 'dqslerzk9',
    api_key: '364274988183368',
    api_secret: 'gJEAx4VjStv1uTKyi3DiLAwL8pQ'
});

/**
 * Call Python mapping script to map design to all 8 templates
 */
async function mapDesignToAllTemplates(designPath, slug, testMode = false) {
    console.log(`\n📍 MAPPING DESIGN TO LIFESTYLE TEMPLATES`);
    console.log(`━`.repeat(60));
    console.log(`  Design: ${designPath}`);
    console.log(`  Slug: ${slug}`);
    console.log(`  Mode: ${testMode ? 'TEST (local save)' : 'PRODUCTION (upload to Cloudinary)'}`);
    console.log('');

    const scriptDir = __dirname;
    const pythonScript = path.join(scriptDir, 'map-design-to-lifestyle.py');
    const outputDir = path.join(scriptDir, '../../temp');

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    return new Promise((resolve, reject) => {
        // Call Python script in batch mode
        const python = spawn('python3', [
            pythonScript,
            designPath,
            'all',
            outputDir
        ]);

        let stdout = '';
        let stderr = '';

        python.stdout.on('data', (data) => {
            const output = data.toString();
            stdout += output;
            console.log(output);
        });

        python.stderr.on('data', (data) => {
            stderr += data.toString();
        });

        python.on('close', async (code) => {
            if (code !== 0) {
                console.error(`\n❌ Python script failed with code ${code}`);
                if (stderr) console.error('Error:', stderr);
                reject(new Error(`Python script failed: ${stderr}`));
                return;
            }

            try {
                // After successful mapping, select one male and one female image
                // Select from available templates
                const maleTemplates = [
                    'mapped-male-1-mental-health.png',
                    'mapped-male-2-developer.png',
                    'mapped-male-3-coffee.png',
                    'mapped-male-4-entrepreneur.png'
                ];

                const femaleTemplates = [
                    'mapped-female-1-mental-health.png',
                    'mapped-female-2-developer.png',
                    'mapped-female-3-fitness.png',
                    'mapped-female-4-entrepreneur.png'
                ];

                // For now, use first of each (can add rotation logic later)
                const maleSource = path.join(outputDir, maleTemplates[0]);
                const femaleSource = path.join(outputDir, femaleTemplates[0]);

                const maleTarget = path.join(outputDir, `${slug}-lifestyle-male.png`);
                const femaleTarget = path.join(outputDir, `${slug}-lifestyle-female.png`);

                // Copy selected images to final names
                fs.copyFileSync(maleSource, maleTarget);
                fs.copyFileSync(femaleSource, femaleTarget);

                console.log(`\n✅ Selected templates:`);
                console.log(`  Male:   ${maleTemplates[0]}`);
                console.log(`  Female: ${femaleTemplates[0]}`);

                if (testMode) {
                    console.log(`\n🧪 TEST MODE: Images saved locally`);
                    console.log(`  Male:   ${maleTarget}`);
                    console.log(`  Female: ${femaleTarget}`);

                    resolve({
                        male: maleTarget,
                        female: femaleTarget
                    });
                } else {
                    // Upload to Cloudinary
                    console.log(`\n⬆️  Uploading to Cloudinary...`);

                    const maleUpload = await cloudinary.uploader.upload(maleTarget, {
                        public_id: `tresr/product-images/lifestyle-photo/${slug}-male`,
                        resource_type: 'image',
                        overwrite: true,
                        invalidate: true
                    });

                    const femaleUpload = await cloudinary.uploader.upload(femaleTarget, {
                        public_id: `tresr/product-images/lifestyle-photo/${slug}-female`,
                        resource_type: 'image',
                        overwrite: true,
                        invalidate: true
                    });

                    console.log(`  ✅ Male uploaded:   ${maleUpload.secure_url}`);
                    console.log(`  ✅ Female uploaded: ${femaleUpload.secure_url}`);

                    // Cleanup temp files
                    fs.unlinkSync(maleTarget);
                    fs.unlinkSync(femaleTarget);
                    maleTemplates.forEach(t => {
                        const f = path.join(outputDir, t);
                        if (fs.existsSync(f)) fs.unlinkSync(f);
                    });
                    femaleTemplates.forEach(t => {
                        const f = path.join(outputDir, t);
                        if (fs.existsSync(f)) fs.unlinkSync(f);
                    });

                    resolve({
                        male: maleUpload.secure_url,
                        female: femaleUpload.secure_url
                    });
                }
            } catch (error) {
                console.error(`\n❌ Post-processing error:`, error.message);
                reject(error);
            }
        });
    });
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);
    const testMode = args.includes('--test');
    const positional = args.filter(arg => !arg.startsWith('--'));

    if (positional.length < 2) {
        console.log('Usage: node map-design-to-all-templates.js <designPath> <slug> [--test]');
        console.log('');
        console.log('Maps design to all 8 lifestyle templates using perspective transformation');
        console.log('Selects one male and one female template for positions 6 & 7');
        console.log('');
        console.log('Parameters:');
        console.log('  designPath - Path to design PNG (transparent background)');
        console.log('  slug       - Design slug for file naming');
        console.log('');
        console.log('Examples:');
        console.log('  # Test mode (saves locally)');
        console.log('  node map-design-to-all-templates.js \\');
        console.log('    temp/my-design-inverted-transparent.png \\');
        console.log('    my-design \\');
        console.log('    --test');
        console.log('');
        console.log('  # Production mode (uploads to Cloudinary)');
        console.log('  node map-design-to-all-templates.js \\');
        console.log('    temp/my-design-inverted-transparent.png \\');
        console.log('    my-design');
        console.log('');
        console.log('Flags:');
        console.log('  --test  Save locally instead of uploading');
        console.log('');
        process.exit(1);
    }

    const [designPath, slug] = positional;

    mapDesignToAllTemplates(designPath, slug, testMode)
        .then((results) => {
            console.log(`\n✅ Mapping complete!`);
            console.log(`  Male:   ${results.male}`);
            console.log(`  Female: ${results.female}`);
            process.exit(0);
        })
        .catch((err) => {
            console.error(`\n❌ Failed:`, err.message);
            process.exit(1);
        });
}

module.exports = { mapDesignToAllTemplates };
