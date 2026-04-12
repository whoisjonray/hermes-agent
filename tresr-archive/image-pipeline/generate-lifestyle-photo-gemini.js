#!/usr/bin/env node

/**
 * Generate AI Lifestyle Photos (Positions 6 & 7)
 * Uses Gemini Imagen to create realistic photos of people wearing the tshirt
 *
 * Position 6: Male lifestyle photo
 * Position 7: Female lifestyle photo
 *
 * Core ICP: Tech-forward Gen X/Millennials, AI enthusiasts, dev/marketing types
 * Aesthetic: "Silicon Valley casual office tshirt day" meets category-specific setting
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fetch = require('node-fetch');
const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

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
 * Generate lifestyle photo using Gemini Imagen with design image input
 */
async function generateLifestylePhoto(designImagePath, mockupImagePath, category, slug, gender, testMode = false) {
    console.log(`\n📸 Generating ${gender} lifestyle photo for: ${slug} (${category})`);

    // Read and encode design images
    const designImage = fs.readFileSync(designImagePath);
    const designBase64 = designImage.toString('base64');

    const mockupImage = fs.readFileSync(mockupImagePath);
    const mockupBase64 = mockupImage.toString('base64');

    const persona = icpPersonas[category] || icpPersonas['developer'];
    const ethnicity = getNextEthnicity();
    const age = gender === 'male' ? '32' : '29';
    const genderDesc = gender === 'male' ? 'man' : 'woman';

    const prompt = `
Generate a high-quality lifestyle photograph of a ${ethnicity} ${genderDesc}, age ${age},
wearing a black t-shirt with the EXACT design shown in the reference images.

CRITICAL DESIGN REQUIREMENTS:
- Copy the design EXACTLY as shown - pixel-for-pixel accuracy
- NO white outlines, NO borders, NO stroke effects on the design
- NO modifications to the design whatsoever
- The design should look identical to the reference mockup image
- Do NOT add any styling, effects, or embellishments to the design
- Text and graphics must appear FLAT on the shirt, not outlined

Person: Silicon Valley tech worker aesthetic - casual but intentional style,
natural and approachable, not a professional model. ${gender === 'male' ? 'Short beard or clean-shaven' : 'Minimal makeup, natural hair'}.

Setting: ${persona.setting}

Props visible: ${persona.props}

Vibe: ${persona.vibe}

Composition:
- Square 1:1 aspect ratio (1024x1024)
- Person is waist-up or chest-up, centered in frame
- Shirt design is clearly visible and legible
- Natural, candid pose - not stiff or overly posed

Lighting: ${persona.lighting}

Background: ${persona.background}

Style: Authentic lifestyle photography, photorealistic, NOT stock photo.
This should look like a real tech worker who genuinely wears this shirt.

ABSOLUTELY CRITICAL:
- Use the EXACT design from reference images on the black t-shirt
- NO white outlines or borders on any part of the design
- Design must look printed directly on the fabric, not edited or styled
`.trim();

    console.log(`  📝 Prompt preview:`);
    console.log(`     ${prompt.substring(0, 200)}...`);

    try {
        console.log(`  🤖 Generating with Gemini Imagen (REST API with image inputs)...`);

        // Use REST API with fetch and image inputs
        const requestBody = {
            contents: [
                {
                    parts: [
                        {
                            text: prompt
                        },
                        {
                            inlineData: {
                                mimeType: 'image/png',
                                data: designBase64
                            }
                        },
                        {
                            inlineData: {
                                mimeType: 'image/png',
                                data: mockupBase64
                            }
                        }
                    ]
                }
            ],
            generationConfig: {
                responseModalities: ['IMAGE', 'TEXT'],
                temperature: 0.7
            }
        };

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${process.env.GEMINI_API_KEY}`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        console.log(`  📡 Response status: ${response.status} ${response.statusText}`);

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${errorText}`);
        }

        const data = await response.json();

        // Extract image data
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
            throw new Error('No image generated by Gemini');
        }

        const content = data.candidates[0].content;
        let imageData = null;

        // Find image data in response
        for (let part of content.parts || []) {
            if (part.inlineData && part.inlineData.data) {
                imageData = part.inlineData;
                break;
            }
        }

        if (!imageData) {
            throw new Error('No image data found in Gemini response');
        }

        // Save to temp directory
        const tempDir = path.join(__dirname, '../../temp');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        const filename = `${slug}-lifestyle-${gender}.png`;
        const localPath = path.join(tempDir, filename);

        // Write image file
        const imageBuffer = Buffer.from(imageData.data, 'base64');
        fs.writeFileSync(localPath, imageBuffer);

        console.log(`  ✅ Generated and saved: ${localPath}`);
        console.log(`  📊 File size: ${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB`);

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
            console.error('  📋 Error details:', JSON.stringify(error.response, null, 2));
        }
        throw error;
    }
}

/**
 * Generate both male and female lifestyle photos
 */
async function generateBothLifestylePhotos(designImagePath, mockupImagePath, category, slug, testMode = false) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎨 GENERATING LIFESTYLE PHOTOS (POSITIONS 6 & 7)`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Design Image: ${designImagePath}`);
    console.log(`Mockup Reference: ${mockupImagePath}`);
    console.log(`Category: ${category}`);
    console.log(`Slug: ${slug}`);
    console.log(`Mode: ${testMode ? 'TEST (local save)' : 'PRODUCTION (upload to Cloudinary)'}`);
    console.log(`${'='.repeat(60)}\n`);

    const results = {};

    try {
        // Position 6: Male
        console.log('📍 POSITION 6: Male Lifestyle Photo');
        console.log('━'.repeat(60));
        results.male = await generateLifestylePhoto(designImagePath, mockupImagePath, category, slug, 'male', testMode);

        // Wait 2 seconds between API calls to avoid rate limiting
        console.log('\n⏳ Waiting 2 seconds before next generation...\n');
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Position 7: Female
        console.log('📍 POSITION 7: Female Lifestyle Photo');
        console.log('━'.repeat(60));
        results.female = await generateLifestylePhoto(designImagePath, mockupImagePath, category, slug, 'female', testMode);

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

    if (positional.length < 4) {
        console.log('Usage: node generate-lifestyle-photo-gemini.js <designImage> <mockupImage> <category> <slug> [--test]');
        console.log('\nParameters:');
        console.log('  designImage - Path to raw design PNG (e.g., designs/production/raw/design.png)');
        console.log('  mockupImage - Path to black tee mockup (e.g., designs/production/mockups/design-black.png)');
        console.log('  category    - Category for ICP persona (mental-health, crypto-web3, developer, etc.)');
        console.log('  slug        - Design slug for file naming');
        console.log('\nExamples:');
        console.log('  # Test mode (saves locally for review)');
        console.log('  node generate-lifestyle-photo-gemini.js \\');
        console.log('    designs/production/raw/my-therapist-is-a-chatbot-tee.png \\');
        console.log('    designs/production/mockups/my-therapist-is-a-chatbot-tee-black.png \\');
        console.log('    mental-health \\');
        console.log('    my-therapist-is-a-chatbot \\');
        console.log('    --test');
        console.log('\n  # Production mode (uploads to Cloudinary)');
        console.log('  node generate-lifestyle-photo-gemini.js \\');
        console.log('    designs/production/raw/my-therapist-is-a-chatbot-tee.png \\');
        console.log('    designs/production/mockups/my-therapist-is-a-chatbot-tee-black.png \\');
        console.log('    mental-health \\');
        console.log('    my-therapist-is-a-chatbot');
        console.log('\nAvailable categories:');
        console.log('  mental-health, crypto-web3, developer, coffee-lovers, fitness-gym,');
        console.log('  entrepreneur, cat-lovers, dog-lovers, gaming, meme-humor');
        console.log('\nFlags:');
        console.log('  --test  Save locally instead of uploading (for preview)');
        console.log('\nOutput: 1024x1024 square images (1:1 aspect ratio)');
        process.exit(1);
    }

    const [designImagePath, mockupImagePath, category, slug] = positional;

    generateBothLifestylePhotos(designImagePath, mockupImagePath, category, slug, testMode)
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
