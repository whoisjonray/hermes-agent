/**
 * Design generation and approval flow
 * Step 2: Generate design, get approval with text/voice feedback
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { generateDesignImage } from '../../services/designGenerator.js';
import { generateMockup } from '../../services/mockupService.js';
import { incrementRejection } from '../../services/conceptDatabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', '..', '..', 'output');
const BACKGROUNDS_DIR = path.join(__dirname, '..', '..', '..', 'backgrounds');

/**
 * Handle design generation after concept selection
 */
export async function handleDesignGeneration(ctx, category, designBrief) {
  const statusMsg = await ctx.reply(
    `🎨 <b>Generating Design</b>\n\n` +
    `Concept: "${designBrief.title}"\n` +
    `Text: "${designBrief.textContent || 'N/A'}"\n\n` +
    `⏳ Creating isolated design with Gemini...`,
    { parse_mode: 'HTML' }
  );

  try {
    // Generate design image (returns object with localPath, url, cloudinaryUrl)
    const designResult = await generateDesignImage(designBrief);
    // Handle both old string format and new object format
    const designPath = typeof designResult === 'string' ? designResult : designResult.localPath;
    const designCloudinaryUrl = typeof designResult === 'string' ? null : designResult.cloudinaryUrl;

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `🎨 <b>Generating Design</b>\n\n` +
      `✅ Design generated${designCloudinaryUrl ? ' (uploaded to Cloudinary)' : ''}\n` +
      `⏳ Creating mockup preview...`,
      { parse_mode: 'HTML' }
    );

    // Create quick mockup with BLANK tee on white bg (background selection comes after approval)
    const blankTee = path.join(BACKGROUNDS_DIR, 'blank-black-tee-whitebg.png');

    const mockupResult = await generateMockup({
      designUrl: designPath,
      settings: {
        backgroundPath: blankTee,
        yOffset: 460,  // Chest position
        threshold: 80  // Aggressive bg removal for preview (handles gray backgrounds from AI)
      }
    });
    // Use localPath for Telegram (more reliable than remote URL)
    // Use url for Shopify/external services
    const mockupPathForTelegram = mockupResult.localPath || mockupResult.url;
    const mockupPathForShopify = mockupResult.url;

    // Delete status message
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);

    // Send mockup with approval buttons
    // Always use local file for Telegram if available (more reliable)
    const photoSource = mockupPathForTelegram.startsWith('http')
      ? mockupPathForTelegram
      : { source: mockupPathForTelegram };
    await ctx.replyWithPhoto(
      photoSource,
      {
        caption:
          `🎯 <b>DESIGN PREVIEW</b>\n\n` +
          `<b>Title:</b> ${designBrief.title}\n` +
          `<b>Category:</b> ${category}\n\n` +
          `✅ <b>Approve</b> → Pick backgrounds\n` +
          `🔄 <b>Remix</b> → Auto-generate new variation\n` +
          `✏️🎤 <b>Feedback</b> → Type or voice message\n` +
          `❌ <b>Reject</b> → Start over`,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Approve Design', callback_data: `design:approve:${category}` },
              { text: '❌ Reject', callback_data: `design:reject:${category}` }
            ],
            [
              { text: '🔄 Remix', callback_data: `design:remix:${category}` },
              { text: '✏️🎤 Feedback', callback_data: `design:feedback:${category}` }
            ]
          ]
        }
      }
    );

    // Store design info in session
    // Use Cloudinary URL for Shopify, local path for Telegram previews
    ctx.session = ctx.session || {};
    ctx.session.currentDesign = {
      category,
      designBrief,
      designPath,
      designCloudinaryUrl,  // CRITICAL: This is the raw design file URL for print shop + metafield
      mockupPath: mockupPathForShopify,  // Cloudinary URL for Shopify product image
      mockupLocalPath: mockupPathForTelegram,  // Local path for Telegram
      iteration: 1
    };

  } catch (error) {
    console.error('Design generation error:', error);
    // Try to edit status message, but if it's already deleted, send a new message
    try {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        null,
        `❌ Design generation failed: ${error.message}\n\nTry again or modify the concept.`
      );
    } catch (editError) {
      // Status message was already deleted, send new message
      await ctx.reply(`❌ Design generation failed: ${error.message}\n\nTry again or modify the concept.`);
    }
  }
}

/**
 * Handle design approval
 */
export async function handleDesignApprove(ctx) {
  const category = ctx.callbackQuery.data.split(':')[2];
  await ctx.answerCbQuery('Design approved! Selecting backgrounds...');

  // Trigger background selection (Step 3)
  const { handleBackgroundSelection } = await import('./backgrounds.js');
  await handleBackgroundSelection(ctx, category);
}

/**
 * Handle design rejection
 */
export async function handleDesignReject(ctx) {
  // Track rejection in concept database if we have a concept ID
  const conceptId = ctx.session?.pendingConceptId;
  if (conceptId) {
    const result = incrementRejection(conceptId);
    if (result?.status === 'exhausted') {
      console.log(`Concept ${conceptId} exhausted after design rejection`);
    }
  }

  await ctx.answerCbQuery('Design rejected');
  await ctx.reply(
    '❌ Design rejected.\n\n' +
    'Use /trends to start a new concept, or send feedback to iterate on this one.'
  );
}

/**
 * Handle remix request - generate new variation without specific feedback
 */
export async function handleDesignRemix(ctx) {
  const category = ctx.callbackQuery.data.split(':')[2];
  const currentDesign = ctx.session?.currentDesign;

  if (!currentDesign) {
    await ctx.answerCbQuery('No active design');
    await ctx.reply('No active design to remix. Use /trends to start.');
    return;
  }

  await ctx.answerCbQuery('Remixing design...');

  // Style profiles based on proven BALLN patterns
  const styleProfiles = [
    { name: 'Bold Stacked', styleProfile: 'stacked', description: 'Bold stacked text like "LEGACY LOADING"' },
    { name: 'Dynamic Arc', styleProfile: 'dynamic', description: 'Dynamic curved layout with integrated icon' },
    { name: 'Geometric Angular', styleProfile: 'geometric', description: 'Sharp angular typography with icon' },
    { name: 'Clean Minimalist', styleProfile: 'minimalist', description: 'Simple bold text, no decorations' },
    { name: 'Vintage Distressed', styleProfile: 'vintage', description: 'Retro worn texture style' }
  ];

  // Pick a random style profile
  const randomStyle = styleProfiles[Math.floor(Math.random() * styleProfiles.length)];

  await ctx.reply(`🔄 Remixing with: ${randomStyle.name}\n${randomStyle.description}\n\n⏳ Generating new variation...`);

  // Modify the design brief with new style profile
  const remixedBrief = {
    ...currentDesign.designBrief,
    styleProfile: randomStyle.styleProfile,
    feedback: null // Clear previous feedback for fresh style
  };

  // Increment iteration count
  ctx.session.currentDesign.iteration = (ctx.session.currentDesign.iteration || 1) + 1;

  // Regenerate design
  await handleDesignGeneration(ctx, category, remixedBrief);
}

/**
 * Handle text feedback request
 */
export async function handleFeedbackRequest(ctx) {
  const category = ctx.callbackQuery.data.split(':')[2];
  await ctx.answerCbQuery();

  ctx.session = ctx.session || {};
  ctx.session.awaitingFeedback = true;
  ctx.session.feedbackCategory = category;

  await ctx.reply(
    '✏️ <b>Send your feedback</b>\n\n' +
    'Type what you\'d like to change about the design:\n' +
    '• "Make the text bigger"\n' +
    '• "Use a different font style"\n' +
    '• "Add a coffee cup icon"\n' +
    '• "Make it more vintage looking"\n\n' +
    'Or send a 🎤 <b>voice message</b> with your feedback.',
    { parse_mode: 'HTML' }
  );
}

/**
 * Handle text feedback message
 */
export async function handleTextFeedback(ctx) {
  if (!ctx.session?.awaitingFeedback) return false;

  const feedback = ctx.message.text;
  const category = ctx.session.feedbackCategory;
  const currentDesign = ctx.session.currentDesign;

  if (!currentDesign) {
    await ctx.reply('No active design to modify. Use /trends to start.');
    return true;
  }

  ctx.session.awaitingFeedback = false;

  await ctx.reply(`📝 Feedback received: "${feedback}"\n\n⏳ Regenerating design...`);

  // Modify the design brief with feedback
  // IMPORTANT: Re-emphasize black background requirement to prevent artifacts
  const modifiedBrief = {
    ...currentDesign.designBrief,
    feedback: `${feedback}. CRITICAL: Background MUST be pure solid black (#000000) with NO texture, pattern, or noise.`
  };

  // Regenerate design
  await handleDesignGeneration(ctx, category, modifiedBrief);

  return true;
}

/**
 * Handle voice feedback message
 */
export async function handleVoiceFeedback(ctx) {
  const voice = ctx.message.voice;
  const currentDesign = ctx.session?.currentDesign;

  if (!currentDesign) {
    await ctx.reply('No active design to modify. Use /trends to start.');
    return;
  }

  await ctx.reply('🎤 Voice message received!\n\n⏳ Transcribing...');

  try {
    // Download voice file
    const fileLink = await ctx.telegram.getFileLink(voice.file_id);
    const response = await fetch(fileLink.href);
    const buffer = await response.arrayBuffer();

    // Save temporarily
    const voicePath = path.join(OUTPUT_DIR, `voice-${Date.now()}.ogg`);
    fs.writeFileSync(voicePath, Buffer.from(buffer));

    // Transcribe with Gemini
    const transcription = await transcribeVoice(voicePath);

    // Clean up
    fs.unlinkSync(voicePath);

    await ctx.reply(`📝 Transcribed: "${transcription}"\n\n⏳ Applying feedback...`);

    // Modify design with voice feedback
    const modifiedBrief = {
      ...currentDesign.designBrief,
      feedback: transcription,
      imagePrompt: `${currentDesign.designBrief.imagePrompt}. User feedback: ${transcription}`
    };

    await handleDesignGeneration(ctx, currentDesign.category, modifiedBrief);

  } catch (error) {
    console.error('Voice processing error:', error);
    await ctx.reply(`❌ Could not process voice: ${error.message}\n\nTry typing your feedback instead.`);
  }
}

/**
 * Transcribe voice message with Gemini
 */
async function transcribeVoice(voicePath) {
  const geminiKey = process.env.GEMINI_API_KEY;

  // Read audio file
  const audioBuffer = fs.readFileSync(voicePath);
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
              text: 'Transcribe this voice message. Return only the transcription text, nothing else.'
            }
          ]
        }]
      })
    }
  );

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  if (!text) {
    throw new Error('Could not transcribe audio');
  }

  return text.trim();
}

export default {
  handleDesignGeneration,
  handleDesignApprove,
  handleDesignReject,
  handleDesignRemix,
  handleFeedbackRequest,
  handleTextFeedback,
  handleVoiceFeedback
};
