/**
 * Background selection flow
 * Step 3: Generate 3 background options, user selects one
 *
 * WORKFLOW:
 * 1. Design is already on t-shirt mockup (from preview step)
 * 2. User selects a lifestyle background style
 * 3. We composite the t-shirt+design onto the lifestyle background
 *
 * MOCKUP BEST PRACTICES (LOCKED):
 * - Shirt: 55% of frame width, centered
 * - Background: DARK (charcoal/slate/dark wood), props frame EDGES only
 * - Clear center area for shirt visibility
 * - High contrast for Facebook ad performance
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateMockup } from '../../services/mockupService.js';

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', '..', '..', 'output');
const BACKGROUNDS_DIR = path.join(__dirname, '..', '..', '..', 'backgrounds', 'active');
const CONFIG_DIR = path.join(__dirname, '..', '..', '..', 'config');

// LOCKED mockup settings - DO NOT CHANGE without A/B testing
const MOCKUP_SETTINGS = JSON.parse(
  fs.readFileSync(path.join(CONFIG_DIR, 'lifestyle-mockup-settings.json'), 'utf8')
).lifestyle;

// Category-appropriate LIFESTYLE BACKGROUNDS (no shirt - we composite the BALLN shirt on top)
// Primary (.1) backgrounds are user-created, (.2) and (.3) are AI-generated variations
const CATEGORY_BACKGROUNDS = {
  coffee: [
    { id: 'moka', name: '☕ Moka Pot', file: '1.1-coffee-bg.png', desc: 'Moka pot, beans, French press, latte art' },
    { id: 'grinder', name: '🫘 Grinder', file: '1.2-coffee-bg.png', desc: 'Grinder, beans, cinnamon, latte' },
    { id: 'portafilter', name: '☕ Portafilter', file: '1.3-coffee-bg.png', desc: 'Portafilter, espresso, croissant' }
  ],
  fitness: [
    { id: 'gym-dark', name: '🏋️ Gym Dark', file: '2.1-fitness-bg.png', desc: 'Kettlebell, shaker, headphones, gloves' },
    { id: 'concrete', name: '💪 Concrete', file: '2.2-fitness-bg.png', desc: 'Kettlebell, earbuds, resistance bands' },
    { id: 'crossfit', name: '🏃 CrossFit', file: '2.3-fitness-bg.png', desc: 'Dumbbell, headphones, jump rope' }
  ],
  crypto: [
    { id: 'tech', name: '💎 Tech', file: '3.1-crypto-bg.png', desc: 'Bitcoin, hardware wallet, phone charts' },
    { id: 'ledger', name: '📈 Ledger', file: '3.2-crypto-bg.png', desc: 'Ledger, coins, circuit board' },
    { id: 'investor', name: '⚡ Investor', file: '3.3-crypto-bg.png', desc: 'Bitcoin, Trezor, notebook' }
  ],
  gaming: [
    { id: 'setup', name: '🎮 Setup', file: '4.1-gaming-bg.png', desc: 'RGB keyboard, mouse, controller, headset' },
    { id: 'rgb', name: '🕹️ RGB', file: '4.2-gaming-bg.png', desc: 'Keyboard, Xbox controller, headset' },
    { id: 'esports', name: '🖥️ Esports', file: '4.3-gaming-bg.png', desc: 'Keyboard, PS5 controller, headphones' }
  ],
  developer: [
    { id: 'desk', name: '💻 Dev Desk', file: '5.1-developer-bg.png', desc: 'Laptop, headphones, coffee, Arduino, Doritos' },
    { id: 'coding', name: '🌙 Coding', file: '5.2-developer-bg.png', desc: 'MacBook, headphones, Doritos, Arduino' },
    { id: 'hacker', name: '⌨️ Hacker', file: '5.3-developer-bg.png', desc: 'Terminal, Raspberry Pi, energy drink' }
  ],
  'dog lovers': [
    { id: 'toys', name: '🐕 Toys', file: '6.1-dog-lovers-bg.png', desc: 'Rope toy, tennis ball, leash, bowl, treats' },
    { id: 'walk', name: '🦴 Walk', file: '6.2-dog-lovers-bg.png', desc: 'Leash, tennis ball, collar, treats' },
    { id: 'play', name: '🎾 Play', file: '6.3-dog-lovers-bg.png', desc: 'Chew toy, ball, bandana, kibble' }
  ],
  'mental health': [
    { id: 'chill', name: '💊 Chill Pills', file: '7.1-mental-health-bg.png', desc: 'Chill Pills bottle, succulent, stress ball, journal' },
    { id: 'zen', name: '🧘 Zen', file: '7.2-mental-health-bg.png', desc: 'Chill Pills, Do Not Disturb, succulent, pills' },
    { id: 'spa', name: '🌸 Spa', file: '7.3-mental-health-bg.png', desc: 'Fairy lights, jade roller, candle, tea' }
  ],
  entrepreneur: [
    { id: 'minimal', name: '💼 Minimal', file: '8.1-entrepreneur-bg.png', desc: 'MacBook, notebook, glasses, latte, phone' },
    { id: 'boss', name: '🚀 Boss', file: '8.2-entrepreneur-bg.png', desc: 'MacBook, leather notebook, AirPods, latte' },
    { id: 'ceo', name: '📊 CEO', file: '8.3-entrepreneur-bg.png', desc: 'Rose gold laptop, Moleskine, cappuccino' }
  ],
  'cat lovers': [
    { id: 'cozy', name: '🐱 Cozy Cat', file: '9.1-cat-lovers-bg.png', desc: 'Cat in bed, treats, yarn, paw prints, blanket' },
    { id: 'tabby', name: '🧶 Tabby', file: '9.2-cat-lovers-bg.png', desc: 'Orange tabby in bed, treats, yarn, blanket' },
    { id: 'fluffy', name: '🐾 Fluffy', file: '9.3-cat-lovers-bg.png', desc: 'Gray cat in bed, mouse toy, treats, blanket' }
  ],
  '80s/90s nostalgia': [
    { id: 'retro', name: '🕹️ Retro', file: '10.1-nostalgia-bg.png', desc: 'GameBoy, cassettes, Rubiks cube, Crayola, slinky' },
    { id: 'gameboy', name: '📼 GameBoy', file: '10.2-nostalgia-bg.png', desc: 'GameBoy, cassettes, Rubiks cube, Tamagotchi' },
    { id: '90s-kid', name: '🌈 90s Kid', file: '10.3-nostalgia-bg.png', desc: 'GameBoy Color, cassettes, slap bracelets, Koosh ball' }
  ],
  'meme/humor': [
    { id: 'pepe', name: '🐸 Pepe', file: '11.1-meme-humor-bg.png', desc: 'Keyboard with meme stickers, Pepe, banana, googly eyes' },
    { id: 'shitpost', name: '🍌 Shitpost', file: '11.2-meme-humor-bg.png', desc: 'Meme keyboard, banana, googly eyes, fidget spinner' },
    { id: 'chaos', name: '😂 Chaos', file: '11.3-meme-humor-bg.png', desc: 'Emoji keycaps, googly eyes, Cheetos, rubber chicken' }
  ],
  default: [
    { id: 'wood', name: '🌳 Wood', file: '1.1-coffee-bg.png', desc: 'Universal warm wood' }
  ]
};

// Category-specific prompts for Gemini background generation
// CRITICAL: All backgrounds MUST be DARK with props framing EDGES ONLY
// Center 60% must be clear for shirt placement
const CATEGORY_PROMPTS = {
  coffee: [
    'dark charcoal slate surface flatlay, coffee beans scattered around edges framing the image, white coffee cup with latte art in top right corner, cinnamon sticks in bottom left corner, EMPTY CENTER AREA, dramatic top-down lighting, product photography',
    'dark wood grain surface flatlay, roasted coffee beans framing all four edges, vintage coffee grinder in corner, CLEAR EMPTY CENTER, moody side lighting, lifestyle product shot',
    'dark concrete countertop flatlay, espresso beans scattered around perimeter edges only, small espresso cup in corner, WIDE OPEN CENTER SPACE, professional product photography lighting'
  ],
  fitness: [
    'dark concrete gym floor flatlay, kettlebell in corner, gym chalk dust on edges, resistance bands framing bottom edge, EMPTY CENTER AREA, dramatic overhead spotlight, athletic product photography',
    'dark rubber gym mat surface, dumbbells in corners, gym towel edge of frame, CLEAR CENTER SPACE, high contrast industrial lighting, fitness lifestyle shot',
    'dark textured floor flatlay, weight plates framing edges, jump rope in corner, protein shaker edge of frame, OPEN CENTER, gritty gym aesthetic lighting'
  ],
  crypto: [
    'dark matte black desk surface flatlay, blue LED glow from edges, hardware wallet in corner, subtle circuit board pattern on edges, EMPTY DARK CENTER, cyberpunk accent lighting',
    'dark charcoal surface with subtle blue/purple neon edge glow, crypto coins in corners, CLEAR DARK CENTER AREA, tech aesthetic lighting, minimal futuristic',
    'dark slate desk flatlay, small monitor glow in corner, USB drives scattered on edges, WIDE OPEN CENTER, moody blue accent lighting'
  ],
  gaming: [
    'dark desk surface flatlay, RGB keyboard glow purple/blue from corner, gaming mouse in edge, headphones framing side, EMPTY DARK CENTER, neon accent lighting',
    'dark matte surface, controller in corner, RGB LED strip glow on edges, gaming headset edge of frame, CLEAR CENTER SPACE, esports aesthetic lighting',
    'dark charcoal desk flatlay, mechanical keyboard corner, mouse pad edge, subtle RGB edge glow, OPEN CENTER AREA, atmospheric gaming lighting'
  ],
  developer: [
    'dark wood desk surface flatlay, mechanical keyboard in corner, coffee mug edge of frame, small plant in corner, EMPTY CENTER AREA, late night coding ambient lighting',
    'dark matte desk flatlay, laptop edge visible in corner, notebook and pen on side, CLEAR CENTER SPACE, professional workspace lighting',
    'dark concrete desk surface, code printout in corner, coffee cup edge, small tech gadgets framing edges, WIDE OPEN CENTER, developer aesthetic lighting'
  ],
  'dog lovers': [
    'dark hardwood floor flatlay, dog treats scattered around edges, leash in corner, paw print toys framing sides, EMPTY CENTER AREA, warm cozy lighting',
    'dark textured blanket surface, dog collar in corner, small toys on edges, CLEAR CENTER SPACE, homey warm lighting, pet lifestyle aesthetic',
    'dark wood surface flatlay, dog bone treats framing edges, bandana in corner, OPEN CENTER AREA, natural warm lighting'
  ],
  'mental health': [
    'dark slate surface flatlay, small succulents in corners, candles on edges, journal edge of frame, EMPTY CENTER AREA, soft calming lighting',
    'dark textured surface, crystals in corners, dried flowers framing edges, tea cup in corner, CLEAR CENTER SPACE, peaceful ambient lighting',
    'dark matte surface flatlay, meditation beads in corner, small plant edge of frame, WIDE OPEN CENTER, zen calming lighting'
  ],
  'cat lovers': [
    'dark gray knit blanket texture flatlay, cat toy mouse in corner, ball of yarn on edge, cat treats scattered around frame edges, EMPTY CENTER AREA, warm cozy lighting, feline lover aesthetic',
    'dark wood floor flatlay, cat scratching post edge visible in corner, small cat bed edge of frame, toy feather wand in corner, CLEAR CENTER SPACE, warm afternoon window light',
    'dark charcoal surface flatlay, small cat paw prints in corners, toy fish in edge, collar with bell in corner, WIDE OPEN CENTER, elegant minimal cat lover aesthetic'
  ],
  '80s/90s nostalgia': [
    'dark surface flatlay with neon pink and cyan LED light strips on edges only, cassette tape in corner, retro sunglasses at edge, 80s synthwave vaporwave aesthetic, EMPTY DARK CENTER AREA, moody neon accent lighting',
    'dark surface flatlay with purple and blue neon glow from edges, vintage game cartridge in corner, pixel art stickers at edge, retro arcade gaming aesthetic, CLEAR DARK CENTER SPACE, 80s/90s nostalgic mood',
    'dark textured surface flatlay, VHS tape in corner, old Walkman at edge, colorful 90s geometric shapes framing edges only, WIDE OPEN CENTER, retro nostalgia warm vintage lighting'
  ],
  entrepreneur: [
    'dark wood desk surface flatlay, laptop corner visible, notebook and pen on edge, coffee cup in corner, EMPTY CENTER AREA, professional success lighting',
    'dark leather desk pad surface, business card holder in corner, pen on edge, small plant corner, CLEAR CENTER SPACE, executive aesthetic lighting',
    'dark matte desk flatlay, smartphone in corner, notepad edge of frame, OPEN CENTER AREA, motivated workspace lighting'
  ],
  default: [
    'dark charcoal textured surface flatlay, subtle props in corners only, EMPTY CENTER taking up 60% of frame, professional product photography lighting',
    'dark slate surface with gentle texture, minimal objects framing edges only, WIDE CLEAR CENTER AREA, moody editorial lighting',
    'dark wood grain surface flatlay, small accent items in corners, OPEN CENTER SPACE, lifestyle product photography lighting'
  ]
};

/**
 * Generate a lifestyle background using Gemini
 */
async function generateBackgroundWithGemini(category, promptIndex = 0) {
  const prompts = CATEGORY_PROMPTS[category] || CATEGORY_PROMPTS.default;
  const prompt = prompts[promptIndex % prompts.length];

  const fullPrompt = `Generate a FLATLAY product photography background for placing a black t-shirt.

SCENE: ${prompt}

CRITICAL COMPOSITION RULES:
1. DARK BACKGROUND - charcoal, slate, dark wood, or dark concrete (NO light/white/cream backgrounds)
2. CENTER IS COMPLETELY EMPTY - the middle 60% of the image must be clear open space
3. Props/items ONLY on edges and corners - frame the image, never in center
4. Top-down flatlay perspective
5. 1024x1024 square format
6. Professional product photography lighting from above

MUST AVOID:
- Light or white backgrounds
- Props in the center area
- People or models
- Text or logos
- Busy cluttered compositions

The result should look like a professional e-commerce product photo background where a black t-shirt will be composited in the clear center area.`;

  console.log(`Generating background ${promptIndex + 1} for ${category}...`);

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: fullPrompt }]
        }],
        generationConfig: {
          responseModalities: ['IMAGE', 'TEXT'],
          temperature: 1.0
        }
      })
    }
  );

  const data = await response.json();

  if (data.error) {
    console.error('Gemini API error:', data.error);
    throw new Error(data.error.message || 'Gemini API error');
  }

  // Extract image from response
  let imageBase64 = null;
  const parts = data.candidates?.[0]?.content?.parts || [];

  for (const part of parts) {
    if (part.inlineData?.mimeType?.startsWith('image/')) {
      imageBase64 = part.inlineData.data;
      break;
    }
  }

  if (!imageBase64) {
    throw new Error('No image data in Gemini response');
  }

  // Save the generated background
  const timestamp = Date.now();
  const filename = `generated-${category}-${timestamp}-${promptIndex + 1}.png`;
  const filepath = path.join(BACKGROUNDS_DIR, filename);

  const imageBuffer = Buffer.from(imageBase64, 'base64');
  fs.writeFileSync(filepath, imageBuffer);

  console.log(`Generated background saved: ${filename}`);

  return {
    id: `gen-${timestamp}-${promptIndex}`,
    name: `🎨 Generated ${promptIndex + 1}`,
    file: filename,
    desc: `AI-generated ${category} background`,
    filepath
  };
}

/**
 * Handle background selection after design approval
 */
export async function handleBackgroundSelection(ctx, category) {
  const currentDesign = ctx.session?.currentDesign;

  if (!currentDesign) {
    await ctx.reply('No active design. Use /trends to start.');
    return;
  }

  const statusMsg = await ctx.reply('🖼️ Generating 3 background options...');

  try {
    // Normalize category lookup - handle various formats
    const normalizedCategory = category?.toLowerCase().trim();
    let backgrounds = CATEGORY_BACKGROUNDS[normalizedCategory];

    // Try alternative key formats if not found
    if (!backgrounds) {
      // Check for exact match with original keys
      backgrounds = CATEGORY_BACKGROUNDS[category];
    }
    if (!backgrounds) {
      // Try matching partial key (e.g., "cat" matches "cat lovers")
      const matchingKey = Object.keys(CATEGORY_BACKGROUNDS).find(key =>
        key.toLowerCase().includes(normalizedCategory) ||
        normalizedCategory.includes(key.toLowerCase().split(' ')[0])
      );
      if (matchingKey) {
        backgrounds = CATEGORY_BACKGROUNDS[matchingKey];
        console.log(`Background category matched: "${category}" -> "${matchingKey}"`);
      }
    }

    // Fall back to default if still not found
    if (!backgrounds) {
      console.log(`No background found for category: "${category}", using default`);
      backgrounds = CATEGORY_BACKGROUNDS.default;
    }
    const mockupPaths = [];

    // Generate lifestyle mockup on each background
    // Two-step process: design -> shirt -> lifestyle background
    for (let i = 0; i < backgrounds.length; i++) {
      const bg = backgrounds[i];
      const bgPath = path.join(BACKGROUNDS_DIR, bg.file);

      // Check if background exists, use fallback if not
      const bgToUse = fs.existsSync(bgPath)
        ? bgPath
        : path.join(BACKGROUNDS_DIR, 'coffee-flatlay-wood.png');

      const outputName = `bg-option-${i + 1}-${Date.now()}`;

      const mockupResult = await generateMockup({
        designUrl: currentDesign.designPath,
        outputName,
        settings: {
          backgroundPath: bgToUse,
          width: MOCKUP_SETTINGS.designWidthPercent,
          yOffset: MOCKUP_SETTINGS.designYOffset,
          lifestyle: true,
          shirtWidth: MOCKUP_SETTINGS.shirtWidthPercent,
          shirtY: MOCKUP_SETTINGS.shirtYOffset,
          threshold: MOCKUP_SETTINGS.bgThreshold
        }
      });

      mockupPaths.push({
        ...bg,
        mockupPath: mockupResult.url,  // Cloudinary URL for Shopify
        mockupLocalPath: mockupResult.localPath || mockupResult.url  // Local path for Telegram
      });
    }

    // Delete status message
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);

    // Send all 3 options as a media group
    // Use local path for Telegram (more reliable than remote URL)
    const mediaGroup = mockupPaths.map((mp, i) => ({
      type: 'photo',
      media: mp.mockupLocalPath.startsWith('http') ? mp.mockupLocalPath : { source: mp.mockupLocalPath },
      caption: i === 0 ? `🖼️ <b>Select Background</b>\n\nOption ${i + 1}: ${mp.name}` : `Option ${i + 1}: ${mp.name}`,
      parse_mode: 'HTML'
    }));

    await ctx.replyWithMediaGroup(mediaGroup);

    // Send selection buttons
    const buttons = mockupPaths.map((mp, i) => ({
      text: `${i + 1}. ${mp.name}`,
      callback_data: `bg:select:${i}:${mp.id}`
    }));

    await ctx.reply('Select your preferred background:', {
      reply_markup: {
        inline_keyboard: [
          buttons,
          [{ text: '🔄 Generate New Backgrounds', callback_data: `bg:regenerate:${category}` }]
        ]
      }
    });

    // Store options in session
    ctx.session.backgroundOptions = mockupPaths;

  } catch (error) {
    console.error('Background generation error:', error);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `❌ Background generation failed: ${error.message}`
    );
  }
}

/**
 * Handle background selection
 */
export async function handleBackgroundSelect(ctx) {
  const data = ctx.callbackQuery.data;
  const parts = data.split(':');
  const optionIndex = parseInt(parts[2]);
  const bgId = parts[3];

  const selectedBg = ctx.session?.backgroundOptions?.[optionIndex];
  const currentDesign = ctx.session?.currentDesign;

  if (!selectedBg || !currentDesign) {
    await ctx.answerCbQuery('Session expired. Start over with /trends');
    return;
  }

  await ctx.answerCbQuery(`Selected: ${selectedBg.name}`);

  // Update session with selected background
  ctx.session.selectedBackground = selectedBg;
  ctx.session.finalMockupPath = selectedBg.mockupPath;

  // Send final approval before Shopify
  await ctx.reply(
    `✅ <b>Background Selected: ${selectedBg.name}</b>\n\n` +
    `<b>Design:</b> ${currentDesign.designBrief.title}\n` +
    `<b>Category:</b> ${currentDesign.category}\n\n` +
    `Ready to create Shopify product?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Create Shopify Product', callback_data: 'shopify:create' },
            { text: '🔙 Change Background', callback_data: `bg:back:${currentDesign.category}` }
          ],
          [
            { text: '❌ Cancel', callback_data: 'flow:cancel' }
          ]
        ]
      }
    }
  );
}

/**
 * Handle background regeneration request - generates 3 NEW backgrounds with Gemini
 */
export async function handleBackgroundRegenerate(ctx) {
  const category = ctx.callbackQuery.data.split(':')[2];
  const currentDesign = ctx.session?.currentDesign;

  if (!currentDesign) {
    await ctx.answerCbQuery('Session expired. Start over with /trends');
    return;
  }

  await ctx.answerCbQuery('Generating new AI backgrounds...');
  const statusMsg = await ctx.reply('🎨 Generating 3 NEW backgrounds with AI...\nThis may take 30-60 seconds.');

  try {
    const generatedBackgrounds = [];

    // Generate 3 new backgrounds with Gemini
    for (let i = 0; i < 3; i++) {
      const bg = await generateBackgroundWithGemini(category, i);
      generatedBackgrounds.push(bg);
    }

    // Generate mockups with the new backgrounds
    const mockupPaths = [];

    for (let i = 0; i < generatedBackgrounds.length; i++) {
      const bg = generatedBackgrounds[i];
      const outputName = `bg-gen-option-${i + 1}-${Date.now()}`;

      const mockupResult = await generateMockup({
        designUrl: currentDesign.designPath,
        outputName,
        settings: {
          backgroundPath: bg.filepath,
          width: MOCKUP_SETTINGS.designWidthPercent,
          yOffset: MOCKUP_SETTINGS.designYOffset,
          lifestyle: true,
          shirtWidth: MOCKUP_SETTINGS.shirtWidthPercent,
          shirtY: MOCKUP_SETTINGS.shirtYOffset,
          threshold: MOCKUP_SETTINGS.bgThreshold
        }
      });

      mockupPaths.push({
        ...bg,
        mockupPath: mockupResult.url
      });
    }

    // Delete status message
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);

    // Send all 3 options as a media group
    const mediaGroup = mockupPaths.map((mp, i) => ({
      type: 'photo',
      media: mp.mockupPath.startsWith('http') ? mp.mockupPath : { source: mp.mockupPath },
      caption: i === 0 ? `🎨 <b>AI-Generated Backgrounds</b>\n\nOption ${i + 1}: ${mp.name}` : `Option ${i + 1}: ${mp.name}`,
      parse_mode: 'HTML'
    }));

    await ctx.replyWithMediaGroup(mediaGroup);

    // Send selection buttons
    const buttons = mockupPaths.map((mp, i) => ({
      text: `${i + 1}. ${mp.name}`,
      callback_data: `bg:select:${i}:${mp.id}`
    }));

    await ctx.reply('Select your preferred background:', {
      reply_markup: {
        inline_keyboard: [
          buttons,
          [{ text: '🔄 Generate More', callback_data: `bg:regenerate:${category}` }],
          [{ text: '📁 Use Original Backgrounds', callback_data: `bg:back:${category}` }]
        ]
      }
    });

    // Store options in session
    ctx.session.backgroundOptions = mockupPaths;

  } catch (error) {
    console.error('Background regeneration error:', error);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `❌ AI background generation failed: ${error.message}\n\nFalling back to original backgrounds...`
    );

    // Fall back to showing original backgrounds
    await handleBackgroundSelection(ctx, category);
  }
}

export default {
  handleBackgroundSelection,
  handleBackgroundSelect,
  handleBackgroundRegenerate
};
