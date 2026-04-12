/**
 * Regenerate ALL category backgrounds with CORRECT approach:
 * - MEDIUM/LIGHT-TONED surfaces (warm wood, light colors, NOT dark)
 * - Props on edges/corners ONLY
 * - Clear center for shirt
 * - 1:1 square format
 * - BLACK T-SHIRT must CONTRAST against background
 */
import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKGROUNDS_DIR = path.join(__dirname, '..', 'backgrounds', 'active');
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const CATEGORIES = {
  coffee: {
    surface: 'warm natural wood plank table, medium brown tones, rustic',
    variations: [
      { id: '1.1', props: 'white coffee cup with black coffee in top-left corner, scattered coffee beans in top-right, small succulent plant in terracotta pot bottom-left, burlap cloth corner bottom-right' },
      { id: '1.2', props: 'latte with foam art in white cup top-left corner, coffee beans scattered top-right edge, vintage coffee grinder bottom-right corner, cinnamon sticks bottom-left' },
      { id: '1.3', props: 'espresso in small white cup top-right corner, coffee beans framing left edge, small green plant bottom-left, coffee scoop with beans bottom-right' }
    ]
  },
  fitness: {
    surface: 'bright blue yoga mat on light wood floor',
    variations: [
      { id: '2.1', props: 'white airpods bottom-left corner, stainless steel water bottle top-right, white gym towel corner bottom-right, resistance band top-left edge' },
      { id: '2.2', props: 'white earbuds top-left corner, protein shaker bottom-right, jump rope coiled top-right, small dumbbell bottom-left' },
      { id: '2.3', props: 'fitness tracker watch top-right corner, water bottle bottom-left, white towel bottom-right edge, resistance band top-left' }
    ]
  },
  crypto: {
    surface: 'clean white marble desk surface, modern minimalist',
    variations: [
      { id: '3.1', props: 'hardware wallet (Ledger style) top-right corner, small succulent in white pot bottom-left, gold bitcoin coin bottom-right, smartphone top-left edge' },
      { id: '3.2', props: 'physical gold bitcoin bottom-right corner, white coffee cup top-left, small plant top-right, notebook bottom-left edge' },
      { id: '3.3', props: 'hardware wallet bottom-left corner, silver ethereum coin top-right, modern desk lamp edge, minimalist white accessories' }
    ]
  },
  gaming: {
    surface: 'light gray or white desk surface with subtle RGB accent glow',
    variations: [
      { id: '4.1', props: 'black game controller top-right corner, RGB keyboard edge visible bottom with purple glow, gaming mouse top-left, headphones bottom-left corner' },
      { id: '4.2', props: 'white PS5 controller bottom-right corner, RGB mouse top-left, gaming headset bottom-left, drink can top-right' },
      { id: '4.3', props: 'controller top-left corner, mechanical keyboard corner bottom-right with RGB lighting, gaming mouse pad visible, small figurine top-right' }
    ]
  },
  developer: {
    surface: 'warm medium-toned natural wood desk, clean finish',
    variations: [
      { id: '5.1', props: 'white coffee mug top-left corner, mechanical keyboard partially visible bottom-right, small succulent plant top-right, notebook and pen bottom-left' },
      { id: '5.2', props: 'coffee cup with steam top-right corner, laptop edge visible bottom-left, small cactus top-left, sticky notes bottom-right' },
      { id: '5.3', props: 'espresso cup bottom-left corner, keyboard corner top-right, small plant top-left, notebook bottom-right edge' }
    ]
  },
  'dog-lovers': {
    surface: 'warm light oak hardwood floor, natural bright tones',
    variations: [
      { id: '6.1', props: 'dog bone treats scattered top-right corner, colorful rope toy bottom-left, leather dog collar top-left, tennis ball bottom-right' },
      { id: '6.2', props: 'dog leash coiled bottom-right corner, paw-shaped treats top-left, stainless dog bowl edge top-right, bandana bottom-left' },
      { id: '6.3', props: 'yellow tennis ball top-right corner, dog treats framing bottom edge, squeaky toy top-left, dog tag bottom-right' }
    ]
  },
  'mental-health': {
    surface: 'soft white marble or light cream stone surface, calming and bright',
    variations: [
      { id: '7.1', props: 'small lit candle in glass top-left corner, succulent in white pot top-right, wooden meditation beads bottom-left, dried lavender bottom-right' },
      { id: '7.2', props: 'journal with pen bottom-right corner, rose quartz crystals top-left, eucalyptus stems top-right, ceramic tea cup bottom-left' },
      { id: '7.3', props: 'white tea cup and saucer top-right corner, small green plant bottom-left, candle bottom-right, soft linen fabric edge top-left' }
    ]
  },
  entrepreneur: {
    surface: 'warm medium wood desk or light marble, professional and bright',
    variations: [
      { id: '8.1', props: 'leather notebook top-left corner, gold pen bottom-right, white coffee cup top-right, small succulent bottom-left' },
      { id: '8.2', props: 'MacBook corner visible bottom-right, notebook and pen top-left, latte in white cup top-right corner, business cards bottom-left' },
      { id: '8.3', props: 'daily planner bottom-left corner, iPhone top-right, coffee cup top-left, gold pen bottom-right edge' }
    ]
  }
};

async function generateBackground(categoryKey, variation, surface) {
  const prompt = `EMPTY TABLE SURFACE with decorative props - NO SHIRTS, NO CLOTHING, NO FABRIC.

I need a photograph of ONLY a table/desk/floor surface with small decorative items in the corners. The center must be completely empty - just the flat surface showing.

SURFACE TYPE: ${surface}

DECORATIVE ITEMS (place ONLY in corners and edges): ${variation.props}

WHAT I NEED:
- A flat surface photographed from directly above (bird's eye view)
- Small props/items placed ONLY in the 4 corners and along edges
- The CENTER 70% of the image is JUST THE EMPTY SURFACE - nothing there
- Light, bright, clean aesthetic
- Square 1:1 format

ABSOLUTELY DO NOT INCLUDE:
- NO t-shirts
- NO shirts of any kind
- NO clothing
- NO fabric
- NO garments
- NO apparel
- The center must be COMPLETELY EMPTY - just the surface

Think of this as a "styled stock photo of an empty desk/table" where someone might later photoshop a product into the empty center space.`;

  console.log('Generating ' + categoryKey + ' - ' + variation.id + '...');

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
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
      })
    }
  );

  const data = await response.json();

  if (data.error) {
    console.error('  Error: ' + data.error.message);
    return null;
  }

  const parts = data.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    if (part.inlineData?.mimeType?.startsWith('image/')) {
      const filename = variation.id + '-' + categoryKey + '-bg.png';
      const filepath = path.join(BACKGROUNDS_DIR, filename);
      fs.writeFileSync(filepath, Buffer.from(part.inlineData.data, 'base64'));
      console.log('  Saved: ' + filename);
      return filename;
    }
  }

  console.error('  No image generated');
  return null;
}

async function main() {
  const targetCategory = process.argv[2];

  if (targetCategory && CATEGORIES[targetCategory]) {
    console.log('\n=== Regenerating ' + targetCategory + ' backgrounds ===\n');
    const config = CATEGORIES[targetCategory];
    for (const variation of config.variations) {
      await generateBackground(targetCategory, variation, config.surface);
      await new Promise(r => setTimeout(r, 3000));
    }
  } else if (targetCategory === 'all') {
    console.log('\n=== Regenerating ALL backgrounds ===\n');
    for (const [categoryKey, config] of Object.entries(CATEGORIES)) {
      console.log('\n' + categoryKey + ':');
      for (const variation of config.variations) {
        await generateBackground(categoryKey, variation, config.surface);
        await new Promise(r => setTimeout(r, 3000));
      }
    }
    console.log('\n=== DONE ===');
  } else {
    console.log('Usage: node scripts/regenerate-backgrounds.js <category|all>');
    console.log('Categories: ' + Object.keys(CATEGORIES).join(', '));
  }
}

main();
