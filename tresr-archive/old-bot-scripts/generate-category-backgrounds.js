/**
 * Generate 3 category-specific lifestyle backgrounds for each category
 * Using Gemini image generation with proper dark flatlay prompts
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKGROUNDS_DIR = path.join(__dirname, '..', 'backgrounds');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

// Category-specific background definitions
// Each has 3 variations with category-appropriate props
const CATEGORY_BACKGROUNDS = {
  coffee: {
    props: 'coffee beans, coffee cup with latte art, cinnamon sticks, small succulent plant',
    surface: 'dark wood grain',
    variations: [
      { id: 'beans-cup', props: 'coffee beans scattered on edges, white coffee cup with latte art in top right corner, cinnamon sticks bottom left' },
      { id: 'rustic-grinder', props: 'roasted coffee beans framing edges, vintage coffee grinder in corner, small espresso cup' },
      { id: 'minimal-beans', props: 'espresso beans around perimeter, single espresso shot in corner, dark slate surface' }
    ]
  },
  'dog lovers': {
    props: 'dog treats, paw print toys, dog leash, dog collar, dog bowl',
    surface: 'dark hardwood floor',
    variations: [
      { id: 'treats-toys', props: 'dog bone treats scattered on edges, colorful rope toy in corner, dog collar bottom left, paw print on right edge' },
      { id: 'cozy-home', props: 'dog leash coiled in corner, small dog bowl on edge, bone-shaped treats framing sides, bandana in corner' },
      { id: 'playful', props: 'tennis ball in corner, dog treats around edges, paw print toy on side, dog tag in corner' }
    ]
  },
  fitness: {
    props: 'dumbbells, kettlebell, gym chalk, resistance bands, water bottle',
    surface: 'dark concrete gym floor',
    variations: [
      { id: 'gym-floor', props: 'kettlebell in corner, gym chalk dust on edges, small dumbbell on side, resistance band bottom' },
      { id: 'industrial', props: 'weight plate in corner, gym towel on edge, protein shaker bottom right, chalk marks' },
      { id: 'minimal-weights', props: 'single dumbbell in corner, jump rope coiled on edge, wrist wraps on side' }
    ]
  },
  crypto: {
    props: 'hardware wallet, USB drives, blue LED glow, circuit board elements',
    surface: 'dark matte black desk',
    variations: [
      { id: 'tech-glow', props: 'hardware wallet in corner, subtle blue LED glow from edges, USB drive on side, dark tech aesthetic' },
      { id: 'trading-desk', props: 'small crypto coins in corners, blue/purple neon edge glow, minimalist tech props' },
      { id: 'cyberpunk', props: 'circuit board pattern on edges, hardware wallet corner, subtle purple/blue accent lighting' }
    ]
  },
  gaming: {
    props: 'game controller, RGB keyboard glow, gaming headset, mouse',
    surface: 'dark desk surface',
    variations: [
      { id: 'rgb-setup', props: 'game controller in corner, RGB purple/blue glow from keyboard edge, gaming mouse on side' },
      { id: 'console', props: 'controller in corner, gaming headset on edge, subtle RGB lighting, dark matte surface' },
      { id: 'esports', props: 'mechanical keyboard corner visible, gaming mouse, RGB strip glow on edges, dark desk' }
    ]
  },
  developer: {
    props: 'mechanical keyboard, coffee mug, small plant, sticky notes, code printout',
    surface: 'dark wood desk',
    variations: [
      { id: 'desk-setup', props: 'mechanical keyboard in corner, coffee mug on edge, small succulent plant, dark wood surface' },
      { id: 'late-night', props: 'laptop edge visible in corner, coffee cup, notebook and pen on side, ambient desk lamp glow' },
      { id: 'minimal-dev', props: 'keyboard corner, single plant, coffee mug, clean dark desk surface' }
    ]
  },
  'mental health': {
    props: 'candles, small plants, crystals, meditation beads, journal',
    surface: 'dark slate or calm dark surface',
    variations: [
      { id: 'zen', props: 'small candles on edges, succulent plants in corners, meditation beads on side, calm dark slate' },
      { id: 'self-care', props: 'journal in corner, small crystals on edges, dried flowers, calming dark surface' },
      { id: 'peaceful', props: 'tea cup in corner, small plant, candle on edge, soft neutral props on dark surface' }
    ]
  },
  entrepreneur: {
    props: 'notebook, pen, coffee cup, laptop edge, small plant',
    surface: 'dark wood executive desk',
    variations: [
      { id: 'hustle', props: 'leather notebook in corner, premium pen on edge, coffee cup, small plant, dark wood desk' },
      { id: 'startup', props: 'laptop corner visible, notebook and pen, coffee cup on edge, motivational dark aesthetic' },
      { id: 'executive', props: 'planner in corner, business card holder on edge, pen, dark leather desk surface' }
    ]
  }
};

async function generateBackground(category, variation, surface) {
  const prompt = `Generate a FLATLAY product photography background for placing a black t-shirt.

SCENE: ${surface} flatlay surface, ${variation.props}, EMPTY CENTER AREA taking up 60% of the image.

CRITICAL COMPOSITION RULES:
1. DARK BACKGROUND - the surface must be dark (charcoal, slate, dark wood, or dark concrete)
2. CENTER IS COMPLETELY EMPTY - the middle 60% of the image must be clear open space with no props
3. Props/items ONLY on edges and corners - frame the image, never in center
4. Top-down flatlay perspective
5. 1024x1024 square format
6. Professional product photography lighting from above
7. Props should be ${category}-themed and lifestyle appropriate

MUST AVOID:
- Light or white backgrounds
- Props in the center area
- People or models
- Text or logos
- Busy cluttered compositions

The result should look like a professional e-commerce product photo background where a black t-shirt will be composited in the clear center area.`;

  console.log(`Generating ${category} - ${variation.id}...`);

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'], temperature: 1.0 }
      })
    }
  );

  const data = await response.json();

  if (data.error) {
    console.error(`  Error: ${data.error.message}`);
    return null;
  }

  const parts = data.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.mimeType?.startsWith('image/')) {
      const filename = `${category.replace(' ', '-')}-${variation.id}-bg.png`;
      const filepath = path.join(BACKGROUNDS_DIR, filename);
      fs.writeFileSync(filepath, Buffer.from(part.inlineData.data, 'base64'));
      console.log(`  Saved: ${filename}`);
      return filename;
    }
  }

  console.error(`  No image generated`);
  return null;
}

async function generateAllBackgrounds() {
  console.log('=== Generating Category Backgrounds ===\n');

  const results = {};

  for (const [category, config] of Object.entries(CATEGORY_BACKGROUNDS)) {
    console.log(`\n${category.toUpperCase()}:`);
    results[category] = [];

    for (const variation of config.variations) {
      const filename = await generateBackground(category, variation, config.surface);
      if (filename) {
        results[category].push({
          id: variation.id,
          file: filename,
          desc: variation.props.split(',')[0]
        });
      }
      // Rate limiting
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Output the new CATEGORY_BACKGROUNDS config
  console.log('\n\n=== NEW CATEGORY_BACKGROUNDS CONFIG ===\n');
  console.log('const CATEGORY_BACKGROUNDS = {');
  for (const [category, backgrounds] of Object.entries(results)) {
    console.log(`  '${category}': [`);
    for (const bg of backgrounds) {
      console.log(`    { id: '${bg.id}', name: '${bg.id}', file: '${bg.file}', desc: '${bg.desc}' },`);
    }
    console.log('  ],');
  }
  console.log('};');
}

// Run for a single category if specified, otherwise all
const targetCategory = process.argv[2];

if (targetCategory) {
  if (CATEGORY_BACKGROUNDS[targetCategory]) {
    console.log(`Generating backgrounds for: ${targetCategory}`);
    const config = CATEGORY_BACKGROUNDS[targetCategory];
    for (const variation of config.variations) {
      await generateBackground(targetCategory, variation, config.surface);
      await new Promise(r => setTimeout(r, 2000));
    }
  } else {
    console.log(`Unknown category: ${targetCategory}`);
    console.log(`Available: ${Object.keys(CATEGORY_BACKGROUNDS).join(', ')}`);
  }
} else {
  generateAllBackgrounds();
}
