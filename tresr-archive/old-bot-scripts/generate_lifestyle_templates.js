/**
 * Generate Lifestyle Mockup Templates
 * Creates pre-made backgrounds with blank shirt already positioned
 * These templates are used for quick design compositing
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKGROUNDS_DIR = path.join(__dirname, '..', 'backgrounds');
const TEMPLATES_DIR = path.join(__dirname, '..', 'templates');

// Ensure templates directory exists
if (!fs.existsSync(TEMPLATES_DIR)) {
  fs.mkdirSync(TEMPLATES_DIR, { recursive: true });
}

// Category-specific BACKGROUND-ONLY prompts (no shirt - we'll composite the BALLN shirt on top)
// These generate just the lifestyle background scene
const CATEGORY_PROMPTS = {
  coffee: [
    {
      name: 'flatlay-wood',
      prompt: 'Product photography flat lay background: rustic wooden table surface, coffee beans scattered around edges, white coffee cup with latte art in top corner, warm morning light, cozy coffee shop aesthetic, leave large CENTER AREA EMPTY for product placement, 1:1 square format, no t-shirt in image'
    },
    {
      name: 'morning-light',
      prompt: 'Product photography background: light wood or marble surface, soft morning sunlight, croissant and coffee cup in corners, bright airy feel, leave large CENTER EMPTY for product, 1:1 square format'
    },
    {
      name: 'cozy-textile',
      prompt: 'Product photography background: soft cream knit blanket texture filling frame, string lights bokeh in background, warm tones, hygge cozy aesthetic, leave CENTER EMPTY for product, 1:1 square format'
    },
    {
      name: 'rustic-dark',
      prompt: 'Product photography background: dark wooden table surface, coffee beans and cinnamon sticks around edges, espresso cup in corner, moody warm lighting, leave large CENTER EMPTY for product, 1:1 square format'
    },
    {
      name: 'minimalist',
      prompt: 'Product photography background: clean beige/cream surface, single coffee bean accents in corners, soft shadows, minimal aesthetic, leave large CENTER EMPTY for product, 1:1 square format'
    }
  ],
  fitness: [
    {
      name: 'gym-concrete',
      prompt: 'Professional product photography: plain black t-shirt flat lay on dark concrete gym floor, kettlebell and weight plate in corner, dramatic moody lighting, fitness aesthetic, shirt centered taking 70% of frame, 1:1 square format, blank black t-shirt with no design'
    },
    {
      name: 'outdoor-athletic',
      prompt: 'Professional product photography: plain black t-shirt on outdoor track or turf, morning sunlight, sports equipment in corner, energetic athletic vibe, shirt centered taking 70% of frame, 1:1 square format, blank black t-shirt'
    },
    {
      name: 'crossfit-dark',
      prompt: 'Professional product photography: plain black t-shirt on rubber gym floor, chalk dust atmosphere, dramatic CrossFit box lighting, raw industrial feel, shirt centered taking 70% of frame, 1:1 square, blank black shirt'
    }
  ],
  crypto: [
    {
      name: 'dark-tech',
      prompt: 'Professional product photography: plain black t-shirt on dark surface with subtle blue LED glow, circuit board texture visible, futuristic crypto aesthetic, shirt centered taking 70% of frame, 1:1 square format, blank black t-shirt'
    },
    {
      name: 'minimal-dark',
      prompt: 'Professional product photography: plain black t-shirt on pure black background with subtle gradient, small gold bitcoin coin in corner, premium luxury feel, shirt centered taking 70% of frame, 1:1 square, blank black shirt'
    },
    {
      name: 'neon-gradient',
      prompt: 'Professional product photography: plain black t-shirt on dark surface, purple and blue neon gradient lighting, cyberpunk crypto aesthetic, shirt centered taking 70% of frame, 1:1 square format, blank black t-shirt'
    }
  ],
  developer: [
    {
      name: 'desk-setup',
      prompt: 'Professional product photography: plain black t-shirt flat lay on dark wood developer desk, mechanical keyboard edge visible, code on screen blur in background, tech aesthetic, shirt centered taking 70% of frame, 1:1 square, blank black shirt'
    },
    {
      name: 'dark-minimal',
      prompt: 'Professional product photography: plain black t-shirt on dark background, subtle code text faded in background, terminal green accent glow, developer aesthetic, shirt centered taking 70% of frame, 1:1 square, blank black t-shirt'
    },
    {
      name: 'office-modern',
      prompt: 'Professional product photography: plain black t-shirt on clean white desk, succulent plant and coffee in corner, bright natural startup office light, shirt centered taking 70% of frame, 1:1 square format, blank black t-shirt'
    }
  ],
  gaming: [
    {
      name: 'rgb-setup',
      prompt: 'Professional product photography: plain black t-shirt on dark surface, RGB lighting glow purple/blue, gaming peripherals blurred in corner, gamer aesthetic, shirt centered taking 70% of frame, 1:1 square format, blank black t-shirt'
    },
    {
      name: 'controller-dark',
      prompt: 'Professional product photography: plain black t-shirt on dark surface, game controller in corner, neon accent lighting, esports vibe, shirt centered taking 70% of frame, 1:1 square, blank black shirt'
    }
  ],
  'dog lovers': [
    {
      name: 'park-outdoor',
      prompt: 'Professional product photography: plain black t-shirt on grass in park, dog toy in corner, warm natural sunlight, pet owner vibe, shirt centered taking 70% of frame, 1:1 square format, blank black t-shirt'
    },
    {
      name: 'cozy-home',
      prompt: 'Professional product photography: plain black t-shirt on soft carpet or rug, dog bed edge visible, warm indoor lighting, pet lover home aesthetic, shirt centered taking 70% of frame, 1:1 square, blank black shirt'
    }
  ],
  'cat lovers': [
    {
      name: 'cozy-blanket',
      prompt: 'Product photography flat lay background: DARK charcoal gray chunky knit blanket texture filling entire frame, small orange tabby cat toy mouse in far corner, ball of dark gray yarn at opposite edge, warm moody lighting from above, cat lover aesthetic, large CENTER AREA completely EMPTY and clear for product placement, 1:1 square format, dark cozy tones, no light colors'
    },
    {
      name: 'window-sunbeam',
      prompt: 'Product photography background: dark wood floor with warm golden sunbeam from window, cat scratching post edge visible in corner, cozy indoor afternoon light, feline lover home vibe, leave CENTER EMPTY for product, 1:1 square format, warm tones'
    },
    {
      name: 'minimal-dark',
      prompt: 'Product photography flat lay background: DARK matte charcoal surface, subtle cat paw print pattern embossed in corners only, small cat collar with bell in one corner, elegant minimal cat lover aesthetic, dramatic moody side lighting, large CENTER completely EMPTY for product, 1:1 square format, dark sophisticated tones'
    }
  ],
  '80s/90s nostalgia': [
    {
      name: 'neon-retro',
      prompt: 'Product photography flat lay background: dark surface with neon pink and cyan light strips on edges, cassette tape in corner, retro sunglasses at edge, 80s synthwave aesthetic, vaporwave vibes, large CENTER AREA completely EMPTY for product, 1:1 square format, dark with neon accent lighting'
    },
    {
      name: 'arcade-vibes',
      prompt: 'Product photography flat lay background: dark surface with purple and blue neon glow from edges, vintage game cartridge in corner, pixel art sticker at edge, retro gaming arcade aesthetic, 80s/90s nostalgic mood, CENTER completely EMPTY and clear, 1:1 square format, moody neon atmosphere'
    },
    {
      name: 'vhs-era',
      prompt: 'Product photography flat lay background: dark textured surface, VHS tape in corner, old Walkman at edge, colorful 90s geometric shapes on edges only, retro nostalgia aesthetic, warm vintage lighting, large CENTER AREA EMPTY for product, 1:1 square format, dark with pops of retro color'
    }
  ],
  entrepreneur: [
    {
      name: 'hustle-desk',
      prompt: 'Professional product photography: plain black t-shirt flat lay on marble surface, gold accents, notebook and pen in corner, boss hustle aesthetic, shirt centered taking 70% of frame, 1:1 square format, blank black t-shirt'
    },
    {
      name: 'minimal-luxury',
      prompt: 'Professional product photography: plain black t-shirt on clean white background with subtle texture, premium luxury aspirational vibe, shirt centered taking 70% of frame, 1:1 square, blank black t-shirt'
    }
  ]
};

/**
 * Generate a single background using Gemini
 */
async function generateBackground(prompt, outputPath) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error('GEMINI_API_KEY not set');

  console.log(`Generating: ${path.basename(outputPath)}`);

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
      })
    }
  );

  const data = await response.json();

  if (data.candidates?.[0]?.content?.parts) {
    for (const part of data.candidates[0].content.parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        const buffer = Buffer.from(part.inlineData.data, 'base64');
        fs.writeFileSync(outputPath, buffer);
        console.log(`  ✅ Saved: ${outputPath}`);
        return outputPath;
      }
    }
  }

  console.log(`  ❌ Failed to generate image`);
  return null;
}

/**
 * Composite blank shirt onto background to create template
 */
async function createTemplate(backgroundPath, templatePath) {
  const shirtPath = path.join(BACKGROUNDS_DIR, 'blank-black-tee-transparent.png');

  return new Promise((resolve, reject) => {
    const args = [
      path.join(__dirname, 'mockup_generator.py'),
      shirtPath,  // Use shirt as "design" input
      '-b', backgroundPath,
      '-o', templatePath,
      '--no-remove-bg',  // Don't remove background from shirt
      '-w', '0.75',  // Shirt fills 75% of frame
      '-y', '80',    // Position from top
      '--json'
    ];

    const proc = spawn('python3', args);
    let stdout = '';

    proc.stdout.on('data', (data) => stdout += data.toString());
    proc.stderr.on('data', (data) => console.error(data.toString()));

    proc.on('close', (code) => {
      if (code === 0) {
        console.log(`  ✅ Template created: ${path.basename(templatePath)}`);
        resolve(templatePath);
      } else {
        reject(new Error(`Template creation failed with code ${code}`));
      }
    });
  });
}

/**
 * Generate all templates for a category
 */
async function generateCategoryTemplates(category) {
  const prompts = CATEGORY_PROMPTS[category];
  if (!prompts) {
    console.log(`No prompts defined for category: ${category}`);
    return [];
  }

  console.log(`\n📸 Generating ${category} templates...`);
  const templates = [];

  for (const { name, prompt } of prompts) {
    const bgPath = path.join(BACKGROUNDS_DIR, `${category}-${name}-bg.png`);
    const templatePath = path.join(TEMPLATES_DIR, `${category}-${name}-template.png`);

    try {
      // Step 1: Generate background
      await generateBackground(prompt, bgPath);

      // Step 2: Composite shirt onto background
      // Note: We'll do this manually or with a separate script
      // For now, just save the background

      templates.push({
        category,
        name,
        backgroundPath: bgPath,
        templatePath
      });

      // Rate limit
      await new Promise(r => setTimeout(r, 2000));
    } catch (e) {
      console.error(`  Error generating ${name}:`, e.message);
    }
  }

  return templates;
}

/**
 * Main: Generate templates for all categories
 */
async function main() {
  const category = process.argv[2];

  if (category) {
    // Generate for specific category
    await generateCategoryTemplates(category);
  } else {
    // Generate for all categories
    for (const cat of Object.keys(CATEGORY_PROMPTS)) {
      await generateCategoryTemplates(cat);
    }
  }

  console.log('\n✅ Done!');
}

main().catch(console.error);
