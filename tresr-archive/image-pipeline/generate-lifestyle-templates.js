#!/usr/bin/env node

/**
 * Generate 8 Standard Lifestyle Templates (One-Time)
 * Creates base photos of people in blank black tees for design mapping
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const fetch = require('node-fetch');
const fs = require('fs');
const path = require('path');

const templates = [
    // Male templates
    {
        gender: 'male',
        age: 32,
        category: 'mental-health',
        setting: 'cozy workspace or therapy office with plants and natural window light',
        props: 'journal, coffee mug, plants, cozy blanket',
        vibe: 'caught in a reflective moment, candid and unaware',
        lighting: 'warm natural window light',
        background: 'neutral calming tones, minimal aesthetic',
        filename: 'lifestyle-male-1-mental-health.png'
    },
    {
        gender: 'male',
        age: 31,
        category: 'developer',
        setting: 'home office with monitors and code on screen',
        props: 'mechanical keyboard, MacBook, coffee mug, tech stuff around',
        vibe: 'mid-coding session, caught working, natural moment',
        lighting: 'monitor glow or desk lamp, natural indoor light',
        background: 'dark mode aesthetic, tech gear visible',
        filename: 'lifestyle-male-2-developer.png'
    },
    {
        gender: 'male',
        age: 30,
        category: 'coffee-lovers',
        setting: 'coffee shop or home espresso setup',
        props: 'espresso, latte, coffee beans, pour-over setup',
        vibe: 'caught mid-coffee ritual, candid moment',
        lighting: 'warm cafe lighting or morning light',
        background: 'modern coffee aesthetic',
        filename: 'lifestyle-male-3-coffee.png'
    },
    {
        gender: 'male',
        age: 33,
        category: 'entrepreneur',
        setting: 'startup office or co-working space',
        props: 'MacBook Pro, notebook, AirPods, coffee',
        vibe: 'mid-work, caught thinking or in conversation',
        lighting: 'natural office light',
        background: 'modern workspace',
        filename: 'lifestyle-male-4-entrepreneur.png'
    },
    // Female templates
    {
        gender: 'female',
        age: 29,
        category: 'mental-health',
        setting: 'cozy workspace or therapy office with plants and natural window light',
        props: 'journal, coffee mug, plants, cozy blanket',
        vibe: 'caught in a reflective moment, candid and unaware',
        lighting: 'warm natural window light',
        background: 'neutral calming tones, minimal aesthetic',
        filename: 'lifestyle-female-1-mental-health.png'
    },
    {
        gender: 'female',
        age: 28,
        category: 'developer',
        setting: 'home office with monitors and code on screen',
        props: 'mechanical keyboard, MacBook, coffee mug, tech stuff around',
        vibe: 'mid-coding session, caught working, natural moment',
        lighting: 'monitor glow or desk lamp, natural indoor light',
        background: 'dark mode aesthetic, tech gear visible',
        filename: 'lifestyle-female-2-developer.png'
    },
    {
        gender: 'female',
        age: 30,
        category: 'fitness-gym',
        setting: 'gym or home workout space',
        props: 'Apple Watch, water bottle, gym bag, iPhone',
        vibe: 'post-workout, caught in the moment',
        lighting: 'bright gym lighting or natural light',
        background: 'athletic environment',
        filename: 'lifestyle-female-3-fitness.png'
    },
    {
        gender: 'female',
        age: 31,
        category: 'entrepreneur',
        setting: 'startup office or co-working space',
        props: 'MacBook Pro, notebook, AirPods, coffee',
        vibe: 'mid-work, caught thinking or in conversation',
        lighting: 'natural office light',
        background: 'modern workspace',
        filename: 'lifestyle-female-4-entrepreneur.png'
    }
];

function buildPrompt(template) {
    const genderDesc = template.gender === 'male' ? 'man' : 'woman';

    return `
Generate a candid lifestyle photograph of a ${genderDesc} in their late 20s/early 30s,
wearing a BLANK SOLID BLACK CASUAL FIT T-SHIRT with absolutely NO design, NO text, NO graphics, NO logos.

CRITICAL: The t-shirt MUST be completely blank - pure solid black with no designs whatsoever.

Person: Silicon Valley tech worker vibe - natural, authentic, real person energy.
${template.gender === 'male' ?
  'Natural look, could have facial hair or be clean-shaven. Think someone working at a startup.' :
  'Natural everyday style, minimal or no makeup. Real tech worker energy.'
}
Like someone you'd see at a SF coffee shop or tech meetup. NOT a model, just a real person.

T-Shirt Details:
- CASUAL FIT black crew neck tee (NOT tight, NOT fitted - relaxed comfortable fit)
- Next Level 6410 unisex tee style
- Soft cotton blend, natural drape
- Looks like a real everyday tee, slightly worn-in feel
- Crew neckline, comfortable casual cut
- The chest area MUST be visible, flat, and facing the camera directly
- Authentic streetwear casual tee, not brand new or overly styled

Setting: ${template.setting}

Props in scene: ${template.props}

Mood/Vibe: ${template.vibe}
The candid feel comes from the EXPRESSION and ENVIRONMENT, not from turning away.
Think "caught looking at camera" or "mid-laugh facing camera" or "glanced up from work".

BODY POSITION (CRITICAL FOR DESIGN PLACEMENT):
- Body and chest MUST face the camera squarely (front-on)
- Shoulders parallel to the camera plane
- Chest area flat, smooth, and clearly visible
- NO turning, twisting, or angling the torso
- The t-shirt chest area should be as flat and front-facing as possible
- Arms can be relaxed at sides, holding props, or gesturing - but torso stays front-facing

Framing & Composition:
- Square 1:1 iPhone photo (1024x1024)
- Person from waist up or mid-chest up
- Centered or slightly off-center framing
- Person CAN look at camera (caught mid-moment expression makes it candid)
- The blank black t-shirt chest area is clearly visible and front-facing
- Authentic candid feeling from expression, not body angle

Lighting: ${template.lighting}

Background: ${template.background}

Photography style: Shot on iPhone 15 Pro Max by a friend.
Candid street style meets tech worker daily life.
Think "Silicon Valley streetwear magazine" editorial but shot casually.
Natural lighting, authentic in-the-moment feel.
NOT studio, NOT professional portrait.
Real moment, real person, real environment.

ABSOLUTELY CRITICAL:
- The t-shirt must be COMPLETELY BLANK - solid black casual fit tee
- NO designs, text, graphics, or logos on the shirt whatsoever
- Body FACING CAMERA DIRECTLY - chest square to camera, flat and visible
- Candid feel comes from expression and environment, NOT from turning away
- Casual fit tee (relaxed, not tight or fitted)
- Real authentic everyday vibe
`.trim();
}

async function generateTemplate(template, outputDir) {
    console.log(`\n📸 Generating: ${template.filename}`);
    console.log(`   ${template.ethnicity} ${template.gender}, ${template.category} setting`);

    const prompt = buildPrompt(template);

    try {
        const requestBody = {
            contents: [{
                parts: [{ text: prompt }]
            }],
            generationConfig: {
                responseModalities: ['IMAGE', 'TEXT'],
                temperature: 0.7
            }
        };

        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${process.env.GEMINI_API_KEY}`;

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Gemini API error: ${errorText}`);
        }

        const data = await response.json();

        // Extract image
        let imageData = null;
        for (let part of data.candidates[0].content.parts || []) {
            if (part.inlineData && part.inlineData.data) {
                imageData = part.inlineData;
                break;
            }
        }

        if (!imageData) {
            throw new Error('No image data in response');
        }

        // Save template
        const outputPath = path.join(outputDir, template.filename);
        const imageBuffer = Buffer.from(imageData.data, 'base64');
        fs.writeFileSync(outputPath, imageBuffer);

        console.log(`   ✅ Saved: ${outputPath}`);
        console.log(`   📊 Size: ${(imageBuffer.length / 1024 / 1024).toFixed(2)} MB`);

        return outputPath;

    } catch (error) {
        console.error(`   ❌ Error: ${error.message}`);
        throw error;
    }
}

async function generateAllTemplates() {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🎨 GENERATING 8 STANDARD LIFESTYLE TEMPLATES`);
    console.log(`${'='.repeat(60)}`);
    console.log(`\nThese templates will be reused for all products.`);
    console.log(`Blank black tees - designs will be mapped onto them.\n`);

    // Create output directory
    const outputDir = path.join(__dirname, '../../templates/lifestyle');
    if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
    }

    const results = [];

    for (let i = 0; i < templates.length; i++) {
        const template = templates[i];

        console.log(`\n[${ i + 1}/8] ${template.gender.toUpperCase()}`);
        console.log('━'.repeat(60));

        const outputPath = await generateTemplate(template, outputDir);
        results.push({ template, outputPath });

        // Rate limiting - wait 3 seconds between calls
        if (i < templates.length - 1) {
            console.log('\n⏳ Waiting 3 seconds before next generation...');
            await new Promise(resolve => setTimeout(resolve, 3000));
        }
    }

    // Summary
    console.log(`\n${'='.repeat(60)}`);
    console.log(`✅ ALL 8 TEMPLATES GENERATED`);
    console.log(`${'='.repeat(60)}`);
    console.log(`\nOutput directory: ${outputDir}\n`);
    console.log('Templates:');
    results.forEach((r, i) => {
        console.log(`  ${i + 1}. ${r.template.filename}`);
    });
    console.log(`\n${'='.repeat(60)}\n`);

    return results;
}

// CLI usage
if (require.main === module) {
    generateAllTemplates()
        .then(() => {
            console.log('✅ Template generation complete!');
            console.log('\nNext step: Create perspective mapping script to place designs onto these templates.');
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ Failed:', err.message);
            process.exit(1);
        });
}

module.exports = { generateAllTemplates };
