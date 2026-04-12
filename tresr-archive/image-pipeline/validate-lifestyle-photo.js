#!/usr/bin/env node

/**
 * Validate AI-Generated Lifestyle Photos
 * Uses GPT-4 Vision to compare generated lifestyle photo against original design
 * Requires 90%+ design accuracy before allowing upload to Shopify
 */

require('dotenv').config({ path: require('path').join(__dirname, '../../.env') });
const OpenAI = require('openai');
const fs = require('fs');
const path = require('path');

// Configure OpenAI
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

/**
 * Validate lifestyle photo against original design using GPT-4 Vision
 */
async function validateLifestylePhoto(originalDesignPath, lifestylePhotoPath) {
    console.log(`\n🔍 VALIDATING LIFESTYLE PHOTO`);
    console.log(`━`.repeat(60));
    console.log(`  Original Design: ${path.basename(originalDesignPath)}`);
    console.log(`  Lifestyle Photo: ${path.basename(lifestylePhotoPath)}`);
    console.log('');

    try {
        // Read and encode images
        const originalDesign = fs.readFileSync(originalDesignPath);
        const originalBase64 = originalDesign.toString('base64');

        const lifestylePhoto = fs.readFileSync(lifestylePhotoPath);
        const lifestyleBase64 = lifestylePhoto.toString('base64');

        const prompt = `You are a quality control expert for print-on-demand t-shirt products.

TASK: Compare the t-shirt design in the lifestyle photo (image 2) against the original design (image 1).

ORIGINAL DESIGN (image 1): The source artwork that should appear on the t-shirt
LIFESTYLE PHOTO (image 2): AI-generated photo of person wearing the design

EVALUATION CRITERIA:
1. Text accuracy - Is all text readable and matches exactly?
2. Visual elements - Are all graphic elements present and correctly rendered?
3. Layout/positioning - Does the design maintain proper spacing and arrangement?
4. Style integrity - No added outlines, borders, shadows, or effects not in original?
5. Color accuracy - Black and white match the original (considering white text on black tee)?

SCORING:
- 100% = Perfect match, indistinguishable from original design
- 90-99% = Very close, minor differences that don't impact quality
- 80-89% = Noticeable differences but design is recognizable
- 70-79% = Significant differences, some elements altered
- Below 70% = Design significantly modified, not acceptable

OUTPUT FORMAT (JSON only, no other text):
{
  "score": <number 0-100>,
  "pass": <true if score >= 90, false otherwise>,
  "issues": [
    "Issue 1 description",
    "Issue 2 description"
  ],
  "recommendation": "APPROVE for upload" or "REJECT - regenerate"
}

Be strict. If there are outlines, borders, or stylistic changes not in the original, deduct points.`;

        console.log('  🤖 Analyzing with GPT-4 Vision...\n');

        const response = await openai.chat.completions.create({
            model: "gpt-4o",
            messages: [
                {
                    role: "user",
                    content: [
                        {
                            type: "text",
                            text: prompt
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/png;base64,${originalBase64}`,
                                detail: "high"
                            }
                        },
                        {
                            type: "image_url",
                            image_url: {
                                url: `data:image/png;base64,${lifestyleBase64}`,
                                detail: "high"
                            }
                        }
                    ]
                }
            ],
            max_tokens: 1000,
            temperature: 0.1
        });

        const textContent = response.choices[0].message.content;

        console.log('  📊 Raw Analysis:\n');
        console.log(textContent);
        console.log('');

        // Parse JSON from response
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            throw new Error('Could not parse JSON from GPT-4 response');
        }

        const result = JSON.parse(jsonMatch[0]);

        // Display results
        console.log(`${'='.repeat(60)}`);
        console.log(`📊 VALIDATION RESULTS`);
        console.log(`${'='.repeat(60)}`);
        console.log(`  Score: ${result.score}/100`);
        console.log(`  Status: ${result.pass ? '✅ PASS' : '❌ FAIL'} (90% threshold)`);
        console.log(`  Recommendation: ${result.recommendation}`);
        console.log('');

        if (result.issues && result.issues.length > 0) {
            console.log('  Issues Found:');
            result.issues.forEach(issue => {
                console.log(`    ⚠️  ${issue}`);
            });
            console.log('');
        }

        console.log(`${'='.repeat(60)}\n`);

        return result;

    } catch (error) {
        console.error('  ❌ Validation error:', error.message);
        throw error;
    }
}

/**
 * Validate both male and female lifestyle photos
 */
async function validateBothLifestylePhotos(originalDesignPath, slug) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 VALIDATING BOTH LIFESTYLE PHOTOS`);
    console.log(`${'='.repeat(60)}\n`);

    const tempDir = path.join(__dirname, '../../temp');
    const malePhotoPath = path.join(tempDir, `${slug}-lifestyle-male.png`);
    const femalePhotoPath = path.join(tempDir, `${slug}-lifestyle-female.png`);

    // Validate male photo
    console.log('👨 VALIDATING MALE LIFESTYLE PHOTO');
    const maleResult = await validateLifestylePhoto(originalDesignPath, malePhotoPath);

    // Wait 2 seconds between API calls
    console.log('⏳ Waiting 2 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Validate female photo
    console.log('👩 VALIDATING FEMALE LIFESTYLE PHOTO');
    const femaleResult = await validateLifestylePhoto(originalDesignPath, femalePhotoPath);

    // Overall results
    console.log(`\n${'='.repeat(60)}`);
    console.log(`📊 OVERALL VALIDATION RESULTS`);
    console.log(`${'='.repeat(60)}`);
    console.log(`  Male Photo:   ${maleResult.score}/100 ${maleResult.pass ? '✅' : '❌'}`);
    console.log(`  Female Photo: ${femaleResult.score}/100 ${femaleResult.pass ? '✅' : '❌'}`);
    console.log('');

    const bothPass = maleResult.pass && femaleResult.pass;

    if (bothPass) {
        console.log('✅ BOTH PHOTOS APPROVED FOR UPLOAD\n');
    } else {
        console.log('❌ ONE OR MORE PHOTOS FAILED VALIDATION\n');
        console.log('Recommendation: Regenerate failed photos or adjust prompts\n');
    }

    console.log(`${'='.repeat(60)}\n`);

    return {
        male: maleResult,
        female: femaleResult,
        approved: bothPass
    };
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('Usage: node validate-lifestyle-photo.js <originalDesign> <slug>');
        console.log('');
        console.log('Validates AI-generated lifestyle photos against original design');
        console.log('Requires 90%+ similarity score to approve for Shopify upload');
        console.log('');
        console.log('Parameters:');
        console.log('  originalDesign - Path to raw design (e.g., designs/production/raw/my-design.png)');
        console.log('  slug           - Design slug (must match filenames in temp/)');
        console.log('');
        console.log('Example:');
        console.log('  node validate-lifestyle-photo.js \\');
        console.log('    designs/production/raw/my-therapist-is-a-chatbot-tee.png \\');
        console.log('    my-therapist-is-a-chatbot');
        console.log('');
        console.log('Expected files in temp/:');
        console.log('  - {slug}-lifestyle-male.png');
        console.log('  - {slug}-lifestyle-female.png');
        console.log('');
        process.exit(1);
    }

    const [originalDesignPath, slug] = args;

    validateBothLifestylePhotos(originalDesignPath, slug)
        .then((results) => {
            if (results.approved) {
                console.log('✅ Validation complete - proceed to Shopify upload');
                process.exit(0);
            } else {
                console.log('❌ Validation failed - regenerate photos before uploading');
                process.exit(1);
            }
        })
        .catch((err) => {
            console.error('❌ Failed:', err.message);
            process.exit(1);
        });
}

module.exports = {
    validateLifestylePhoto,
    validateBothLifestylePhotos
};
