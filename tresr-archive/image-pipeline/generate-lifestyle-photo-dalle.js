#!/usr/bin/env node

/**
 * Generate AI Lifestyle Photos (Positions 6 & 7) - DALL-E 3 Version
 * Uses OpenAI DALL-E 3 to create realistic photos of people wearing the tshirt
 *
 * Position 6: Male lifestyle photo
 * Position 7: Female lifestyle photo
 *
 * Core ICP: Tech-forward Gen X/Millennials, AI enthusiasts, dev/marketing types
 * Aesthetic: "Silicon Valley casual office tshirt day" meets category-specific setting
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const OpenAI = require('openai');
const cloudinary = require('cloudinary').v2;
const https = require('https');
const fs = require('fs');
const path = require('path');

// Configure OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Configure Cloudinary
cloudinary.config({
    cloud_name: 'dqslerzk9',
    api_key: '364274988183368',
    api_secret: 'gJEAx4VjStv1uTKyi3DiLAwL8pQ'
});

/**
 * ICP Persona Mapping
 * Silicon Valley casual aesthetic adapted to category-specific settings
 */
const icpPersonas = {
    'mental-health': {
        setting: 'cozy therapy office or mindful workspace with plants and natural light',
        props: 'journal, coffee mug, succulents, soft throw blanket',
        vibe: 'thoughtful, introspective tech worker in self-care mode',
        lighting: 'warm, soft natural window light',
        background: 'neutral tones, calming aesthetic'
    },
    'crypto-web3': {
        setting: 'modern home office with dual monitors showing crypto charts',
        props: 'mechanical keyboard, hardware wallet, Bitcoin poster, coffee',
        vibe: 'confident blockchain developer or crypto trader',
        lighting: 'cool LED accent lighting or monitor glow',
        background: 'minimalist tech setup, dark aesthetic'
    },
    'developer': {
        setting: 'software engineer home office with multiple monitors and code on screen',
        props: 'mechanical keyboard, MacBook, standing desk, coffee mug, tech stickers',
        vibe: 'focused developer in flow state, Silicon Valley casual',
        lighting: 'monitor glow or desk lamp, slightly dim room',
        background: 'dark mode aesthetic, tech gear visible'
    },
    'coffee-lovers': {
        setting: 'artisan coffee shop or home espresso bar setup',
        props: 'espresso machine, latte art, coffee beans, French press',
        vibe: 'coffee-obsessed tech worker, morning ritual energy',
        lighting: 'warm cafe lighting or golden morning light',
        background: 'rustic wood or modern coffee bar aesthetic'
    },
    'fitness-gym': {
        setting: 'modern gym or home workout space with tech integration',
        props: 'smartwatch, protein shaker, gym bag, workout app on phone',
        vibe: 'tech-savvy fitness enthusiast, post-workout glow',
        lighting: 'bright gym lighting or natural outdoor light',
        background: 'athletic but still Silicon Valley casual aesthetic'
    },
    'entrepreneur': {
        setting: 'startup office space or modern co-working environment',
        props: 'MacBook Pro, notebook, AirPods, espresso, business books',
        vibe: 'ambitious founder or early startup employee',
        lighting: 'natural office lighting or dramatic side light',
        background: 'modern minimalist workspace'
    },
    'cat-lovers': {
        setting: 'comfortable home office with cat-friendly workspace',
        props: 'laptop, cat toy nearby, coffee mug with cat design, cozy aesthetic',
        vibe: 'remote tech worker with cat companion vibe',
        lighting: 'warm home office lighting',
        background: 'cozy, lived-in tech workspace'
    },
    'dog-lovers': {
        setting: 'home office or outdoor workspace with dog-friendly vibe',
        props: 'laptop, dog leash on desk, water bowl nearby, tennis ball',
        vibe: 'remote tech worker, dog parent energy',
        lighting: 'natural light, warm and inviting',
        background: 'casual workspace with dog life hints'
    },
    'gaming': {
        setting: 'gaming setup with RGB lighting and multiple monitors',
        props: 'gaming keyboard, headset on desk, energy drink, controller',
        vibe: 'tech-savvy gamer or game developer',
        lighting: 'RGB lighting, cool tones, dramatic',
        background: 'gaming battlestation aesthetic'
    },
    'meme-humor': {
        setting: 'casual tech workspace with meme culture references',
        props: 'laptop with stickers, energy drink, phone, meme posters',
        vibe: 'chronically online tech worker, internet culture native',
        lighting: 'casual office or home setup lighting',
        background: 'millennial/gen-z tech aesthetic'
    }
};

/**
 * Ethnicity rotation for diversity
 */
const ethnicities = [
    'white/Caucasian',
    'Black/African American',
    'Asian/East Asian',
    'Hispanic/Latino',
    'South Asian/Indian',
    'Middle Eastern'
];

let ethnicityIndex = 0;

function getNextEthnicity() {
    const ethnicity = ethnicities[ethnicityIndex];
    ethnicityIndex = (ethnicityIndex + 1) % ethnicities.length;
    return ethnicity;
}

/**
 * Build DALL-E 3 prompt for lifestyle photo
 */
function buildPrompt(designText, category, gender) {
    const persona = icpPersonas[category] || icpPersonas['developer']; // fallback to developer
    const ethnicity = getNextEthnicity();
    const age = gender === 'male' ? '32' : '29'; // Slightly varied ages
    const genderDesc = gender === 'male' ? 'man' : 'woman';

    return `
A high-quality, photorealistic photograph of a ${ethnicity} ${genderDesc}, age ${age},
wearing a black t-shirt with the text "${designText}" printed in bold white sans-serif letters
on the chest. The text should be clearly visible and legible.

Person: Silicon Valley tech worker aesthetic - casual but intentional style,
natural and approachable, not a professional model. ${gender === 'male' ? 'Short beard or clean-shaven, relaxed expression' : 'Minimal makeup, natural hair, genuine smile'}.

Setting: ${persona.setting}

Props in scene: ${persona.props}

Mood/Vibe: ${persona.vibe}

Framing:
- Horizontal orientation, person is from waist up or chest up
- Person centered in frame, looking at camera or slightly off-camera
- Shirt text "${designText}" is in focus and clearly readable
- Shallow depth of field, background slightly blurred
- Natural, candid pose - relaxed and comfortable, not stiff

Lighting: ${persona.lighting}

Background: ${persona.background}

Photography style: Authentic lifestyle photography, shot on iPhone 15 Pro Max,
photorealistic, NOT a stock photo. This should look like a real tech worker
who genuinely wears this shirt. Natural, relatable energy.

CRITICAL: The black t-shirt must have "${designText}" clearly printed in white text on the chest.
`.trim();
}

/**
 * Generate lifestyle photo using DALL-E 3
 */
async function generateLifestylePhoto(designText, category, slug, gender, testMode = false) {
    console.log(`\n📸 Generating ${gender} lifestyle photo for: ${slug} (${category})`);

    const prompt = buildPrompt(designText, category, gender);
    console.log(`  📝 Prompt preview:`);
    console.log(`     ${prompt.substring(0, 200)}...`);

    try {
        console.log(`  🤖 Generating with DALL-E 3 (standard quality)...`);

        const response = await openai.images.generate({
            model: "dall-e-3",
            prompt: prompt,
            n: 1,
            size: "1024x1024",
            quality: "standard" // or "hd" for $0.08 instead of $0.04
        });

        const imageUrl = response.data[0].url;
        console.log(`  ✅ Generated: ${imageUrl}`);

        // Download image
        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const filename = `${slug}-lifestyle-${gender}.png`;
        const localPath = path.join(tempDir, filename);

        await new Promise((resolve, reject) => {
            const file = fs.createWriteStream(localPath);
            https.get(imageUrl, (response) => {
                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }).on('error', (err) => {
                fs.unlink(localPath, () => {});
                reject(err);
            });
        });

        console.log(`  💾 Downloaded to: ${localPath}`);

        if (testMode) {
            console.log(`  🧪 TEST MODE: Saved locally`);
            return localPath;
        } else {
            // Upload to Cloudinary
            console.log('  ⬆️  Uploading to Cloudinary...');
            const result = await cloudinary.uploader.upload(localPath, {
                public_id: `tresr/product-images/lifestyle-photo/${slug}-${gender}`,
                resource_type: 'image',
                overwrite: true,
                invalidate: true
            });

            console.log(`  ✅ Uploaded: ${result.secure_url}`);

            // Cleanup
            fs.unlinkSync(localPath);

            return result.secure_url;
        }

    } catch (error) {
        console.error(`  ❌ Error generating ${gender} lifestyle photo:`, error.message);
        if (error.response) {
            console.error('  📋 Error details:', JSON.stringify(error.response?.data, null, 2));
        }
        throw error;
    }
}

/**
 * Generate both male and female lifestyle photos
 */
async function generateBothLifestylePhotos(designText, category, slug, testMode = false) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎨 GENERATING LIFESTYLE PHOTOS (POSITIONS 6 & 7)`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Design: ${designText}`);
    console.log(`Category: ${category}`);
    console.log(`Slug: ${slug}`);
    console.log(`Mode: ${testMode ? 'TEST (local save)' : 'PRODUCTION (upload to Cloudinary)'}`);
    console.log(`Model: DALL-E 3 (OpenAI)`);
    console.log(`Cost: $0.04 per image ($0.08 total for both)`);
    console.log(`${'='.repeat(60)}\n`);

    const results = {};

    try {
        // Position 6: Male
        console.log('📍 POSITION 6: Male Lifestyle Photo');
        console.log('━'.repeat(60));
        results.male = await generateLifestylePhoto(designText, category, slug, 'male', testMode);

        // Wait 2 seconds between API calls to avoid rate limiting
        console.log('\n⏳ Waiting 2 seconds before next generation...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Position 7: Female
        console.log('📍 POSITION 7: Female Lifestyle Photo');
        console.log('━'.repeat(60));
        results.female = await generateLifestylePhoto(designText, category, slug, 'female', testMode);

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('✅ BOTH LIFESTYLE PHOTOS GENERATED SUCCESSFULLY');
        console.log('='.repeat(60));
        console.log('\nImage URLs/Paths:');
        console.log(`  6️⃣  Male:   ${results.male}`);
        console.log(`  7️⃣  Female: ${results.female}`);
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
    const testMode = args.includes('--test');
    const positional = args.filter(arg => !arg.startsWith('--'));

    if (positional.length < 3) {
        console.log('Usage: node generate-lifestyle-photo-dalle.js <designText> <category> <slug> [--test]');
        console.log('\nParameters:');
        console.log('  designText - Text on the shirt (e.g., "MY THERAPIST IS A CHATBOT")');
        console.log('  category   - Category for ICP persona (mental-health, crypto-web3, developer, etc.)');
        console.log('  slug       - Design slug for file naming');
        console.log('\nExamples:');
        console.log('  # Test mode (saves locally for review)');
        console.log('  node generate-lifestyle-photo-dalle.js \\');
        console.log('    "MY THERAPIST IS A CHATBOT" \\');
        console.log('    mental-health \\');
        console.log('    my-therapist-is-a-chatbot \\');
        console.log('    --test');
        console.log('\n  # Production mode (uploads to Cloudinary)');
        console.log('  node generate-lifestyle-photo-dalle.js \\');
        console.log('    "MY THERAPIST IS A CHATBOT" \\');
        console.log('    mental-health \\');
        console.log('    my-therapist-is-a-chatbot');
        console.log('\nAvailable categories:');
        console.log('  mental-health, crypto-web3, developer, coffee-lovers, fitness-gym,');
        console.log('  entrepreneur, cat-lovers, dog-lovers, gaming, meme-humor');
        console.log('\nFlags:');
        console.log('  --test  Save locally instead of uploading (for preview)');
        console.log('\nCost: $0.04 per image, $0.08 total for both male + female');
        process.exit(1);
    }

    const [designText, category, slug] = positional;

    generateBothLifestylePhotos(designText, category, slug, testMode)
        .then(() => {
            console.log('✅ Done!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ Failed:', err.message);
            process.exit(1);
        });
}

module.exports = {
    generateLifestylePhoto,
    generateBothLifestylePhotos
};
