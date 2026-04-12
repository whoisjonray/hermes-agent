/**
 * /trends command - Find trending opportunities
 * First pulls from pre-researched database, falls back to live API research
 */

import { hybridDesignResearch } from '../../services/designResearch.js';
import { searchDesignStyles } from '../../services/styleResearch.js';
import {
  getRandomConcept,
  getAvailableCount,
  incrementRejection,
  conceptTextExists,
  addConcept
} from '../../services/conceptDatabase.js';

// Categories to monitor - synced with Shopify homepage collections
const CATEGORIES = [
  'coffee',
  'fitness',
  'gaming',
  'dog lovers',
  'cat lovers',
  'mental health',
  'crypto',
  'entrepreneur',
  'developer',
  '80s/90s nostalgia',
  'meme/humor',
  'custom'  // User describes their own idea
];

/**
 * Handle /trends command
 */
export async function handleTrendsCommand(ctx) {
  const chatId = ctx.chat.id;

  // Check if category was specified
  const args = ctx.message.text.split(' ').slice(1);

  if (args.length === 0) {
    // Show category selection - separate custom from research categories
    const researchCategories = CATEGORIES.filter(cat => cat !== 'custom');
    const buttons = researchCategories.map(cat => [{
      text: cat.charAt(0).toUpperCase() + cat.slice(1),
      callback_data: `trends:${cat}`
    }]);

    // Add custom option with different styling
    buttons.push([{
      text: '✨ Custom Idea (describe your own)',
      callback_data: 'trends:custom'
    }]);

    await ctx.reply(
      '🎯 <b>Create a New Design</b>\n\n' +
      '<b>Research-based:</b> Pick a category and I\'ll find trending designs\n\n' +
      '<b>Custom:</b> Describe your own shirt idea (text or voice)',
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: buttons
        }
      }
    );
    return;
  }

  // Category specified, run research
  const category = args.join(' ').toLowerCase();
  if (category === 'custom') {
    await promptCustomDescription(ctx);
  } else {
    await runTrendResearch(ctx, category);
  }
}

/**
 * Handle category selection callback
 */
export async function handleTrendsCallback(ctx) {
  const category = ctx.callbackQuery.data.replace('trends:', '');

  // Handle custom option differently
  if (category === 'custom') {
    await ctx.answerCbQuery('Describe your idea...');
    await promptCustomDescription(ctx);
    return;
  }

  // Handle 'menu' to show category selection again
  if (category === 'menu') {
    await ctx.answerCbQuery();
    await handleTrendsCommand({ ...ctx, message: { text: '/trends' } });
    return;
  }

  await ctx.answerCbQuery(`Researching ${category}...`);
  await runTrendResearch(ctx, category);
}

/**
 * Prompt user to describe their custom idea
 */
async function promptCustomDescription(ctx) {
  ctx.session = ctx.session || {};
  ctx.session.awaitingCustomDescription = true;

  await ctx.reply(
    '✨ <b>Describe Your Shirt Idea</b>\n\n' +
    'Tell me what you want on your shirt. Be specific about:\n' +
    '• The text/phrase you want\n' +
    '• The style (vintage, minimalist, funny, etc.)\n' +
    '• Any graphics or imagery\n' +
    '• The vibe/mood\n\n' +
    '<b>Examples:</b>\n' +
    '• "A vintage coffee mug with steam that says \'But First, Coffee\'"\n' +
    '• "Minimalist line art of a dog with \'Dog Dad\' underneath"\n' +
    '• "Retro 80s style text saying \'Code Sleep Repeat\'"\n\n' +
    '💬 <b>Type your description</b> or 🎤 <b>send a voice message</b>',
    { parse_mode: 'HTML' }
  );
}

/**
 * Handle custom text description
 */
export async function handleCustomTextDescription(ctx) {
  if (!ctx.session?.awaitingCustomDescription) return false;

  const description = ctx.message.text;
  ctx.session.awaitingCustomDescription = false;

  await processCustomDescription(ctx, description);
  return true;
}

/**
 * Handle custom voice description
 */
export async function handleCustomVoiceDescription(ctx) {
  if (!ctx.session?.awaitingCustomDescription) return false;

  const voice = ctx.message.voice;
  ctx.session.awaitingCustomDescription = false;

  const statusMsg = await ctx.reply('🎤 Transcribing your voice message...');

  try {
    // Download voice file
    const fileLink = await ctx.telegram.getFileLink(voice.file_id);
    const response = await fetch(fileLink.href);
    const buffer = await response.arrayBuffer();

    // Transcribe with Gemini
    const transcription = await transcribeVoiceForCustom(Buffer.from(buffer));

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `📝 Heard: "${transcription}"\n\n⏳ Generating design concept...`
    );

    await processCustomDescription(ctx, transcription, statusMsg);
    return true;

  } catch (error) {
    console.error('Voice transcription error:', error);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `❌ Couldn't transcribe audio: ${error.message}\n\nPlease type your description instead.`
    );
    ctx.session.awaitingCustomDescription = true;
    return true;
  }
}

/**
 * Transcribe voice message
 */
async function transcribeVoiceForCustom(audioBuffer) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const audioBase64 = audioBuffer.toString('base64');

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType: 'audio/ogg',
                data: audioBase64
              }
            },
            {
              text: 'Transcribe this voice message describing a t-shirt design idea. Return only the transcription.'
            }
          ]
        }]
      })
    }
  );

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!text) throw new Error('Could not transcribe audio');
  return text.trim();
}

/**
 * Extract key topic keywords from user description for style research
 */
function extractTopicKeywords(description) {
  const lowerDesc = description.toLowerCase();

  // Common themes to detect
  const themes = {
    coffee: ['coffee', 'caffeine', 'espresso', 'latte', 'brew', 'morning'],
    fitness: ['gym', 'workout', 'fitness', 'lift', 'gains', 'muscle', 'exercise'],
    crypto: ['crypto', 'bitcoin', 'hodl', 'wagmi', 'degen', 'blockchain', 'nft'],
    gaming: ['game', 'gamer', 'player', 'controller', 'esport', 'level', 'respawn'],
    dogs: ['dog', 'puppy', 'paw', 'bark', 'canine', 'pet'],
    motivation: ['hustle', 'grind', 'success', 'boss', 'entrepreneur', 'work'],
    developer: ['code', 'developer', 'programming', 'debug', 'software', 'engineer'],
    'mental health': ['mental', 'anxiety', 'therapy', 'self care', 'mindful']
  };

  // Find matching theme
  for (const [theme, keywords] of Object.entries(themes)) {
    if (keywords.some(kw => lowerDesc.includes(kw))) {
      return theme;
    }
  }

  // Extract first few meaningful words as fallback
  const words = description.split(' ')
    .filter(w => w.length > 3)
    .slice(0, 3)
    .join(' ');

  return words || 'trendy graphic';
}

/**
 * Process custom description and generate design brief
 * First researches popular styles, then generates an informed design brief
 */
async function processCustomDescription(ctx, description, existingStatusMsg = null) {
  const statusMsg = existingStatusMsg || await ctx.reply('⏳ Researching popular styles for your idea...');

  try {
    // Step 1: Research popular design styles related to the user's description
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      '🔍 Step 1: Researching popular designs similar to your idea...'
    );

    // Extract key topic from description for research
    const topicKeywords = extractTopicKeywords(description);
    console.log('Researching styles for:', topicKeywords);

    const styleResearch = await searchDesignStyles(topicKeywords, description);
    console.log('Style research result:', styleResearch);

    // Step 2: Generate design brief informed by research
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `🎨 Step 2: Creating concept based on popular ${styleResearch.dominantStyles?.join(', ') || 'modern'} styles...`
    );

    // Generate design brief with style research context
    const designBrief = await generateCustomDesignBrief(description, styleResearch);

    // Store in session
    ctx.session = ctx.session || {};
    ctx.session.pendingDesignBrief = designBrief;
    ctx.session.pendingCategory = 'custom';
    ctx.session.customDescription = description;

    // Delete status message
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
    } catch (e) {}

    // Show the generated concept
    let msg = `✨ <b>CUSTOM DESIGN CONCEPT</b>\n\n`;
    const descStr = String(description || '');
    msg += `<b>📝 Your idea:</b>\n"${descStr.substring(0, 150)}${descStr.length > 150 ? '...' : ''}"\n\n`;
    msg += `<b>💡 Generated Concept:</b>\n`;
    msg += `<b>Title:</b> ${designBrief.title || 'Untitled Design'}\n`;
    msg += `<b>Type:</b> ${designBrief.designType || 'typography'}\n`;
    msg += `<b>Text:</b> "${designBrief.textContent || 'N/A'}"\n`;
    if (designBrief.visualDescription && typeof designBrief.visualDescription === 'string') {
      msg += `<b>Visual:</b> ${designBrief.visualDescription.substring(0, 100)}...\n`;
    }

    const buttons = [[{
      text: `✅ Create This Design`,
      callback_data: `concept:select:custom`
    }]];

    buttons.push([
      { text: '✏️ Describe Again', callback_data: 'trends:custom' },
      { text: '📋 Pick Category', callback_data: 'trends:menu' }
    ]);

    await ctx.reply(msg, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: buttons
      }
    });

  } catch (error) {
    console.error('Custom design error:', error);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `❌ Failed to generate concept: ${error.message}\n\nTry describing your idea differently.`,
      {
        reply_markup: {
          inline_keyboard: [[
            { text: '🔄 Try Again', callback_data: 'trends:custom' }
          ]]
        }
      }
    );
  }
}

/**
 * Generate design brief from custom description using Gemini
 * Informed by market research on what actually sells
 */
async function generateCustomDesignBrief(description, styleResearch = null) {
  const geminiKey = process.env.GEMINI_API_KEY;

  // Build context from style research
  let marketContext = '';
  if (styleResearch) {
    marketContext = `
MARKET RESEARCH (what's actually SELLING):
- Proven styles: ${styleResearch.dominantStyles?.join(', ') || 'bold typography'}
- Emotional triggers that make people BUY: ${styleResearch.emotionalTriggers?.join(', ') || 'identity, belonging'}
- Visual patterns that convert: ${styleResearch.visualPatterns?.join(', ') || 'clean, bold'}
- Buyer psychology: ${styleResearch.buyerPsychology || 'Identity expression'}
- Style recommendation: ${styleResearch.styleRecommendation || 'Bold minimal typography'}

USE THESE INSIGHTS to make the design more likely to SELL, not just look good.
`;
  }

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Convert this t-shirt design idea into a SELLABLE design brief:

USER'S IDEA: "${description}"
${marketContext}

Create a design brief optimized for SALES, not just aesthetics. The design should:
- Appeal to buyer's emotional triggers
- Use proven visual patterns that convert
- Feel like something they'd actually wear and show off

Return JSON:
{
  "title": "Product title (catchy, max 60 chars)",
  "designType": "stacked|dynamic|geometric|minimalist|vintage",
  "textContent": "The exact text to appear (short, punchy, memorable)",
  "visualDescription": "Description of visual elements",
  "styleProfile": "stacked|dynamic|geometric|minimalist|vintage",
  "style": "The overall aesthetic",
  "whyItWillSell": "Why someone would BUY this (emotional reason)",
  "imagePrompt": "Detailed prompt for the design. IMPORTANT: Bold typography, white/cream on pure black background, NO borders or frames, NO t-shirt mockup. Just the isolated graphic."
}

CRITICAL: The imagePrompt must specify NO borders, NO frames, NO boxes around the design. Clean professional typography like bestselling shirts.`
          }]
        }],
        generationConfig: { temperature: 0.5 }
      })
    }
  );

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    const brief = JSON.parse(jsonMatch[0]);
    // Add style research to brief for use in prompt building
    brief.styleResearch = styleResearch;
    return brief;
  }

  throw new Error('Could not generate design brief');
}

/**
 * Run trend research for a category
 * First checks database for pre-researched concepts, falls back to live API
 */
async function runTrendResearch(ctx, category) {
  ctx.session = ctx.session || {};
  ctx.session.shownConceptIds = ctx.session.shownConceptIds || [];

  // First, try to get a concept from the database (instant!)
  const availableCount = getAvailableCount(category);

  if (availableCount > 0) {
    // Get random concept from database, excluding already shown ones
    const concept = getRandomConcept(category, ctx.session.shownConceptIds);

    if (concept) {
      // Track this concept as shown
      ctx.session.shownConceptIds.push(concept.id);

      // Convert database concept to design brief format
      const designBrief = {
        title: concept.title,
        textContent: concept.text_content,
        designType: concept.design_type,
        visualDescription: concept.visual_description,
        styleNotes: concept.style_notes,
        sourceData: concept.sourceData
      };

      // Store in session
      ctx.session.pendingDesignBrief = designBrief;
      ctx.session.pendingCategory = category;
      ctx.session.pendingConceptId = concept.id;  // Track for rejection/publish

      // Show the concept instantly
      await showDatabaseConcept(ctx, category, concept, designBrief, availableCount);
      return;
    }
  }

  // No concepts in database - fall back to live API research
  const statusMsg = await ctx.reply(`🔍 Researching ${category} trends...\n\nThis takes 30-60 seconds.\n\n💡 <i>Tip: Run "npm run research" to pre-populate concepts for instant results!</i>`, { parse_mode: 'HTML' });

  try {
    // Try up to 3 times to get a unique concept
    let research = null;
    let attempts = 0;
    const maxAttempts = 3;

    while (attempts < maxAttempts) {
      attempts++;
      research = await hybridDesignResearch(category);

      // Check if this concept already exists in database
      const textContent = research.designBrief?.textContent;
      if (textContent && conceptTextExists(textContent, category)) {
        console.log(`Duplicate concept detected: "${textContent}" - retrying (${attempts}/${maxAttempts})`);
        if (attempts < maxAttempts) {
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            null,
            `🔍 Researching ${category} trends...\n\n⚠️ Found duplicate, searching for fresh ideas... (${attempts}/${maxAttempts})`,
            { parse_mode: 'HTML' }
          );
          continue;
        }
      }
      break;  // Got a unique concept
    }

    // Save this new concept to database for future deduplication
    if (research.designBrief) {
      const saved = addConcept({
        category,
        title: research.designBrief.title,
        textContent: research.designBrief.textContent,
        designType: research.designBrief.designType || 'typography',
        visualDescription: research.designBrief.visualDescription,
        styleNotes: research.designBrief.styleNotes || research.designBrief.styleRecommendation,
        sourceData: {
          salesSignals: research.salesSignals,
          dominantStyles: research.dominantStyles,
          source: 'live_search',
          researchedAt: new Date().toISOString()
        }
      });

      if (saved.isNew && saved.id) {
        ctx.session.pendingConceptId = saved.id;  // Track this concept
        console.log(`Saved live search concept to database: ${saved.id}`);
      }
    }

    // Format results
    const message = formatResearchResults(category, research);

    // Store design brief in session for later retrieval
    ctx.session.pendingDesignBrief = research.designBrief;
    ctx.session.pendingCategory = category;
    if (!ctx.session.pendingConceptId) {
      ctx.session.pendingConceptId = null;  // No database concept if save failed
    }

    // Create concept selection buttons (keep callback_data under 64 bytes)
    const buttons = [];

    if (research.designBrief?.title) {
      const shortTitle = research.designBrief.title.substring(0, 25);
      buttons.push([{
        text: `✅ Create: "${shortTitle}..."`,
        callback_data: `concept:select:${category}`
      }]);
    } else if (research.designBrief) {
      buttons.push([{
        text: `✅ Create Design`,
        callback_data: `concept:select:${category}`
      }]);
    }

    buttons.push([
      { text: '🔄 Research Again', callback_data: `trends:${category}` },
      { text: '📋 Different Category', callback_data: 'trends:menu' }
    ]);

    // Delete status message and send results
    try {
      await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);
    } catch (e) {
      // Message may already be deleted
    }

    await ctx.reply(message, {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: buttons
      }
    });

  } catch (error) {
    console.error('Trend research error:', error);
    try {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        null,
        `❌ Research failed: ${error.message}\n\nTry again or choose a different category.`
      );
    } catch (e) {
      // Message may be deleted, send new one
      await ctx.reply(`❌ Research failed: ${error.message}\n\nTry again or choose a different category.`);
    }
  }
}

/**
 * Show a concept from the database (instant response)
 */
async function showDatabaseConcept(ctx, category, concept, designBrief, availableCount) {
  let msg = `🎯 <b>${category.toUpperCase()} DESIGN CONCEPT</b>\n\n`;

  msg += `<b>💡 Concept:</b>\n`;
  msg += `<b>Title:</b> ${designBrief.title || 'Untitled Design'}\n`;
  msg += `<b>Type:</b> ${designBrief.designType || 'typography'}\n`;
  msg += `<b>Text:</b> "${designBrief.textContent || 'N/A'}"\n`;

  if (designBrief.visualDescription) {
    msg += `<b>Visual:</b> ${String(designBrief.visualDescription).substring(0, 250)}\n`;
  }

  msg += `\n<i>📦 ${availableCount} concepts available in this category</i>`;

  // Build buttons with Show Another and Not Interested
  const buttons = [];

  // Create button
  const shortTitle = (designBrief.title || 'Design').substring(0, 20);
  buttons.push([{
    text: `✅ Create: "${shortTitle}..."`,
    callback_data: `concept:select:${category}`
  }]);

  // Show Another (no penalty) and Not Interested (rejection)
  buttons.push([
    { text: '🔄 Show Another', callback_data: `concept:another:${category}` },
    { text: '❌ Not Interested', callback_data: `concept:reject:${category}` }
  ]);

  // Category menu
  buttons.push([
    { text: '📋 Different Category', callback_data: 'trends:menu' }
  ]);

  await ctx.reply(msg, {
    parse_mode: 'HTML',
    reply_markup: {
      inline_keyboard: buttons
    }
  });
}

/**
 * Handle "Show Another" - get next concept without rejection
 */
export async function handleShowAnother(ctx) {
  const data = ctx.callbackQuery.data;
  const category = data.split(':')[2];

  await ctx.answerCbQuery('Loading another concept...');

  // Just run the research again - it will exclude already shown concepts
  await runTrendResearch(ctx, category);
}

/**
 * Handle "Not Interested" - reject and show next
 */
export async function handleConceptReject(ctx) {
  const data = ctx.callbackQuery.data;
  const category = data.split(':')[2];

  const conceptId = ctx.session?.pendingConceptId;

  if (conceptId) {
    // Increment rejection count in database
    const result = incrementRejection(conceptId);
    if (result?.status === 'exhausted') {
      await ctx.answerCbQuery('Concept removed from rotation');
    } else {
      await ctx.answerCbQuery('Noted! Showing another...');
    }
  } else {
    await ctx.answerCbQuery('Showing another...');
  }

  // Show next concept
  await runTrendResearch(ctx, category);
}

/**
 * Format research results for Telegram
 */
function formatResearchResults(category, research) {
  const { designAnalysis, designBrief, sources, searchResultsCount, dataSources, salesSignals, amazonProductsAnalyzed } = research;

  let msg = `🎯 <b>${category.toUpperCase()} TREND RESEARCH</b>\n\n`;

  // Data sources used - show combined sources
  msg += `<b>📚 Data Sources:</b>\n`;

  if (dataSources?.includes('amazon')) {
    msg += `🛒 Amazon Best Sellers`;
    if (amazonProductsAnalyzed > 0) {
      msg += ` (${amazonProductsAnalyzed} products)`;
    }
    msg += `\n`;
  }

  if (dataSources?.includes('google_images')) {
    msg += `🖼️ Google Images (${searchResultsCount || 0} designs analyzed)\n`;
  }

  if (salesSignals?.length > 0) {
    msg += `\n<b>📈 Sales Insights:</b>\n`;
    salesSignals.slice(0, 2).forEach(signal => {
      msg += `• ${signal}\n`;
    });
  }

  if (sources?.length > 0) {
    const uniqueSources = [...new Set(sources.map(s => s.source))].slice(0, 4);
    msg += `• Sources: ${uniqueSources.join(', ')}\n`;
  }
  msg += '\n';

  // Design patterns found
  if (designAnalysis) {
    msg += `<b>📊 Patterns From Best-Sellers:</b>\n`;

    if (designAnalysis.designStyles?.length) {
      msg += `• Styles: ${designAnalysis.designStyles.slice(0, 3).join(', ')}\n`;
    }
    if (designAnalysis.textPatterns?.length) {
      msg += `• Text types: ${designAnalysis.textPatterns.slice(0, 3).join(', ')}\n`;
    }
    if (designAnalysis.examplePhrases?.length) {
      msg += `• Example phrases: "${designAnalysis.examplePhrases.slice(0, 2).join('", "')}"\n`;
    }
    if (designAnalysis.whyTheySell && typeof designAnalysis.whyTheySell === 'string') {
      msg += `• Why they sell: ${designAnalysis.whyTheySell.substring(0, 120)}...\n`;
    }
    msg += '\n';
  }

  // Generated concept with reasoning
  if (designBrief) {
    msg += `<b>💡 Generated Concept:</b>\n`;
    msg += `<b>Title:</b> ${designBrief.title || 'Untitled Design'}\n`;
    msg += `<b>Type:</b> ${designBrief.designType || 'typography'}\n`;
    msg += `<b>Text:</b> "${designBrief.textContent || 'N/A'}"\n\n`;

    msg += `<b>🧠 Why This Concept:</b>\n`;
    if (designBrief.whyItWillSell) {
      msg += `${designBrief.whyItWillSell}\n`;
    }
  }

  return msg;
}

/**
 * Handle concept selection
 */
export async function handleConceptSelect(ctx) {
  const data = ctx.callbackQuery.data;
  const parts = data.split(':');
  const category = parts[2] || ctx.session?.pendingCategory;

  // Get design brief from session (stored during research)
  const designBrief = ctx.session?.pendingDesignBrief;

  if (!designBrief) {
    await ctx.answerCbQuery('Session expired. Run /trends again.');
    return;
  }

  await ctx.answerCbQuery('Starting design generation...');

  // Store in session for next step
  ctx.session.currentConcept = {
    category,
    designBrief,
    step: 'design'
  };

  // Trigger design generation (Step 2)
  const { handleDesignGeneration } = await import('./design.js');
  await handleDesignGeneration(ctx, category, designBrief);
}

export default {
  handleTrendsCommand,
  handleTrendsCallback,
  handleConceptSelect,
  handleCustomTextDescription,
  handleCustomVoiceDescription,
  handleShowAnother,
  handleConceptReject
};
