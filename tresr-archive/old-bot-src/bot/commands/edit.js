/**
 * /edit command - Edit product mockups
 *
 * Usage:
 * /edit <product-url> <instruction>
 *
 * Examples:
 * /edit https://tresr.com/products/my-shirt move design down 30px
 * /edit https://tresr.com/products/my-shirt move design up 20px
 * /edit https://tresr.com/products/my-shirt make design smaller
 * /edit https://tresr.com/products/my-shirt make design larger
 */

import { generateMockup } from '../../services/mockupService.js';
import { syncSingleProduct } from './sync.js';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKGROUNDS_DIR = path.join(__dirname, '..', '..', '..', 'backgrounds');

// Default mockup settings (from CLAUDE.md - LOCKED parameters)
const DEFAULT_SETTINGS = {
  yOffset: 510,        // Default vertical position
  width: 0.35,         // Design width as % of shirt
  threshold: 60,       // Background removal threshold
  shirtWidth: 1.0,     // Shirt fills frame
  shirtY: 0            // Shirt centered
};

/**
 * Escape HTML for Telegram
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

/**
 * Parse edit instruction to extract adjustments
 */
function parseEditInstruction(instruction) {
  const lower = instruction.toLowerCase();
  const adjustments = { ...DEFAULT_SETTINGS };

  // Parse vertical movement
  const downMatch = lower.match(/(?:move\s+)?(?:design\s+)?down\s+(\d+)\s*(?:px|pixels?)?/);
  const upMatch = lower.match(/(?:move\s+)?(?:design\s+)?up\s+(\d+)\s*(?:px|pixels?)?/);

  if (downMatch) {
    adjustments.yOffset = DEFAULT_SETTINGS.yOffset + parseInt(downMatch[1]);
    adjustments.description = `Moved design down ${downMatch[1]}px`;
  } else if (upMatch) {
    adjustments.yOffset = DEFAULT_SETTINGS.yOffset - parseInt(upMatch[1]);
    adjustments.description = `Moved design up ${upMatch[1]}px`;
  }

  // Parse size changes
  const smallerMatch = lower.match(/(?:make\s+)?(?:design\s+)?(?:smaller|shrink)\s*(?:by\s+)?(\d+)?%?/);
  const largerMatch = lower.match(/(?:make\s+)?(?:design\s+)?(?:larger|bigger|enlarge)\s*(?:by\s+)?(\d+)?%?/);

  if (smallerMatch) {
    const percent = smallerMatch[1] ? parseInt(smallerMatch[1]) : 10;
    adjustments.width = DEFAULT_SETTINGS.width * (1 - percent / 100);
    adjustments.description = (adjustments.description ? adjustments.description + ', ' : '') +
      `Made design ${percent}% smaller`;
  } else if (largerMatch) {
    const percent = largerMatch[1] ? parseInt(largerMatch[1]) : 10;
    adjustments.width = DEFAULT_SETTINGS.width * (1 + percent / 100);
    adjustments.description = (adjustments.description ? adjustments.description + ', ' : '') +
      `Made design ${percent}% larger`;
  }

  // Parse explicit Y position
  const yPosMatch = lower.match(/(?:y|vertical)\s*(?:position|offset)?\s*[=:]?\s*(\d+)/);
  if (yPosMatch) {
    adjustments.yOffset = parseInt(yPosMatch[1]);
    adjustments.description = `Set Y position to ${yPosMatch[1]}px`;
  }

  // Parse explicit width
  const widthMatch = lower.match(/(?:width|size)\s*[=:]?\s*(0?\.\d+|\d+%?)/);
  if (widthMatch) {
    let width = parseFloat(widthMatch[1]);
    if (width > 1) width = width / 100; // Convert percentage
    adjustments.width = width;
    adjustments.description = (adjustments.description ? adjustments.description + ', ' : '') +
      `Set width to ${(width * 100).toFixed(0)}%`;
  }

  if (!adjustments.description) {
    adjustments.description = 'No changes detected';
  }

  return adjustments;
}

/**
 * Handle /edit command
 */
export async function handleEditCommand(ctx, shopifyManager) {
  const text = ctx.message.text;
  const parts = text.split(' ').slice(1); // Remove /edit

  if (parts.length < 2) {
    await ctx.reply(
      `✏️ <b>EDIT PRODUCT MOCKUP</b>\n\n` +
      `<b>Usage:</b>\n` +
      `<code>/edit [product-url] [instruction]</code>\n\n` +
      `<b>Examples:</b>\n` +
      `• <code>/edit https://tresr.com/products/my-shirt move design down 30px</code>\n` +
      `• <code>/edit https://tresr.com/products/my-shirt move design up 20px</code>\n` +
      `• <code>/edit https://tresr.com/products/my-shirt make design smaller</code>\n` +
      `• <code>/edit https://tresr.com/products/my-shirt make design 20% larger</code>\n` +
      `• <code>/edit https://tresr.com/products/my-shirt y=480</code>\n\n` +
      `<b>With design URL (for products without stored design):</b>\n` +
      `<code>/edit [product-url] design=[design-url] [instruction]</code>\n\n` +
      `<b>Default Y Position:</b> 510px (chest level)`,
      { parse_mode: 'HTML' }
    );
    return;
  }

  // Extract URL and instruction
  const urlOrId = parts[0];
  let instruction = parts.slice(1).join(' ');

  // Check if a design URL was provided inline
  let providedDesignUrl = null;
  const designMatch = instruction.match(/design=(\S+)/i);
  if (designMatch) {
    providedDesignUrl = designMatch[1];
    instruction = instruction.replace(/design=\S+\s*/i, '').trim();
  }

  const statusMsg = await ctx.reply(
    `✏️ <b>EDITING PRODUCT</b>\n\n` +
    `🔍 Looking up product...\n` +
    `📝 Instruction: "${escapeHtml(instruction)}"`,
    { parse_mode: 'HTML' }
  );

  try {
    // Fetch product from Shopify
    const product = await shopifyManager.getProductFromUrl(urlOrId);

    if (!product) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        null,
        `❌ <b>PRODUCT NOT FOUND</b>\n\n` +
        `Could not find: ${escapeHtml(urlOrId.substring(0, 50))}`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Get design URL from metafields
    const metafields = await shopifyManager.apiRequest(`products/${product.id}/metafields.json`);
    const designMetafield = metafields.metafields?.find(
      m => m.namespace === 'tresr' && (m.key === 'artwork_url' || m.key === 'high_res_artwork')
    );

    let designUrl = designMetafield?.value;

    // Use provided design URL if metafield not found
    if (!designUrl && providedDesignUrl) {
      designUrl = providedDesignUrl;
    }

    // If still no design URL, try auto-sync from Cloudinary
    if (!designUrl) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        null,
        `⏳ <b>NO DESIGN FOUND</b>\n\n` +
        `Product: ${escapeHtml(product.title)}\n\n` +
        `Searching Cloudinary for matching design...`,
        { parse_mode: 'HTML' }
      );

      try {
        const syncResult = await syncSingleProduct(product.id, shopifyManager);
        if (syncResult.success) {
          designUrl = syncResult.designUrl;
          await ctx.telegram.editMessageText(
            ctx.chat.id,
            statusMsg.message_id,
            null,
            `✏️ <b>EDITING PRODUCT</b>\n\n` +
            `✅ Found: ${escapeHtml(product.title)}\n` +
            `✅ Auto-synced design from Cloudinary\n` +
            `⏳ Regenerating mockup...`,
            { parse_mode: 'HTML' }
          );
        }
      } catch (syncError) {
        console.error('Auto-sync failed:', syncError);
      }
    }

    // If STILL no design URL, show error
    if (!designUrl) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        null,
        `⚠️ <b>NO DESIGN FOUND</b>\n\n` +
        `Product: ${escapeHtml(product.title)}\n\n` +
        `Could not find matching design in Cloudinary.\n\n` +
        `<b>Options:</b>\n` +
        `1. Run <code>/sync run</code> to sync all products\n` +
        `2. Provide design URL inline:\n` +
        `<code>/edit ${escapeHtml(urlOrId.substring(0, 30))}... design=URL move down 30px</code>`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Parse the edit instruction
    const adjustments = parseEditInstruction(instruction);

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `✏️ <b>EDITING PRODUCT</b>\n\n` +
      `✅ Found: ${escapeHtml(product.title)}\n` +
      `✅ Design URL found\n` +
      `⏳ Regenerating mockup...\n\n` +
      `<b>Changes:</b> ${escapeHtml(adjustments.description)}\n` +
      `<b>Y Offset:</b> ${adjustments.yOffset}px (default: 510px)\n` +
      `<b>Width:</b> ${(adjustments.width * 100).toFixed(0)}% (default: 35%)`,
      { parse_mode: 'HTML' }
    );

    // Get background based on category
    const nicheMetafield = metafields.metafields?.find(m => m.namespace === 'tresr' && m.key === 'niche');
    const niche = nicheMetafield?.value || 'default';

    // Use blank tee with white background for product images
    const backgroundPath = path.join(BACKGROUNDS_DIR, 'blank-black-tee-whitebg.png');

    // Generate new mockup
    const mockupResult = await generateMockup({
      designUrl: designUrl,
      outputName: `edit_${product.id}_${Date.now()}`,
      settings: {
        backgroundPath,
        yOffset: adjustments.yOffset,
        width: adjustments.width,
        threshold: adjustments.threshold
      }
    });

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `✏️ <b>EDITING PRODUCT</b>\n\n` +
      `✅ Found: ${escapeHtml(product.title)}\n` +
      `✅ Design URL found\n` +
      `✅ Mockup regenerated\n` +
      `⏳ Uploading to Shopify...`,
      { parse_mode: 'HTML' }
    );

    // Store in session for preview/confirm flow
    ctx.session = ctx.session || {};
    ctx.session.pendingEdit = {
      productId: product.id,
      productTitle: product.title,
      productHandle: product.handle,
      oldImageUrl: product.images?.[0]?.src,
      newMockupUrl: mockupResult.url,
      newMockupLocalPath: mockupResult.localPath,
      adjustments
    };

    // Delete status and show preview
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);

    // Send preview with before/after
    const caption =
      `✏️ <b>MOCKUP EDIT PREVIEW</b>\n\n` +
      `<b>Product:</b> ${escapeHtml(product.title)}\n` +
      `<b>Changes:</b> ${escapeHtml(adjustments.description)}\n\n` +
      `<b>New Settings:</b>\n` +
      `• Y Offset: ${adjustments.yOffset}px\n` +
      `• Width: ${(adjustments.width * 100).toFixed(0)}%\n\n` +
      `Apply this change to Shopify?`;

    // Send new mockup as photo
    const photoSource = mockupResult.localPath || mockupResult.url;
    await ctx.replyWithPhoto(
      photoSource.startsWith('http') ? photoSource : { source: photoSource },
      {
        caption,
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Apply to Shopify', callback_data: 'edit:apply' },
              { text: '❌ Cancel', callback_data: 'edit:cancel' }
            ],
            [
              { text: '🔄 Adjust More (+10px down)', callback_data: 'edit:adjust:down:10' },
              { text: '🔄 Adjust More (-10px up)', callback_data: 'edit:adjust:up:10' }
            ]
          ]
        }
      }
    );

  } catch (error) {
    console.error('Edit command error:', error);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `❌ <b>EDIT FAILED</b>\n\n${escapeHtml(error.message)}`,
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * Handle edit apply callback
 */
export async function handleEditApply(ctx, shopifyManager) {
  const pendingEdit = ctx.session?.pendingEdit;

  if (!pendingEdit) {
    await ctx.answerCbQuery('Session expired. Use /edit again.');
    return;
  }

  await ctx.answerCbQuery('Applying changes to Shopify...');

  try {
    // Update product images
    await shopifyManager.updateProductImages(pendingEdit.productId, [pendingEdit.newMockupUrl]);

    // Update metafield with new mockup settings
    await shopifyManager.updateMetafield(
      pendingEdit.productId,
      'tresr',
      'mockup_settings',
      JSON.stringify(pendingEdit.adjustments),
      'json_string'
    );

    await ctx.reply(
      `✅ <b>CHANGES APPLIED!</b>\n\n` +
      `<b>Product:</b> ${escapeHtml(pendingEdit.productTitle)}\n` +
      `<b>Changes:</b> ${escapeHtml(pendingEdit.adjustments.description)}\n\n` +
      `<a href="https://tresr.com/products/${pendingEdit.productHandle}">View on TRESR</a>`,
      { parse_mode: 'HTML', disable_web_page_preview: true }
    );

    // Clear session
    ctx.session.pendingEdit = null;

  } catch (error) {
    console.error('Error applying edit:', error);
    await ctx.reply(`❌ Failed to apply: ${escapeHtml(error.message)}`);
  }
}

/**
 * Handle edit cancel callback
 */
export async function handleEditCancel(ctx) {
  ctx.session.pendingEdit = null;
  await ctx.answerCbQuery('Edit cancelled');
  await ctx.reply('❌ Edit cancelled. No changes made.');
}

/**
 * Handle adjustment callbacks
 */
export async function handleEditAdjust(ctx, shopifyManager) {
  const pendingEdit = ctx.session?.pendingEdit;

  if (!pendingEdit) {
    await ctx.answerCbQuery('Session expired. Use /edit again.');
    return;
  }

  const data = ctx.callbackQuery.data; // edit:adjust:down:10 or edit:adjust:up:10
  const parts = data.split(':');
  const direction = parts[2];
  const amount = parseInt(parts[3]) || 10;

  // Calculate new Y offset
  let newYOffset = pendingEdit.adjustments.yOffset;
  if (direction === 'down') {
    newYOffset += amount;
  } else if (direction === 'up') {
    newYOffset -= amount;
  }

  await ctx.answerCbQuery(`Adjusting ${direction} ${amount}px...`);

  // Get design URL from the product
  const metafields = await shopifyManager.apiRequest(`products/${pendingEdit.productId}/metafields.json`);
  const designMetafield = metafields.metafields?.find(
    m => m.namespace === 'tresr' && (m.key === 'artwork_url' || m.key === 'high_res_artwork')
  );

  if (!designMetafield?.value) {
    await ctx.reply('❌ Design URL not found');
    return;
  }

  const backgroundPath = path.join(BACKGROUNDS_DIR, 'blank-black-tee-whitebg.png');

  // Regenerate mockup
  const mockupResult = await generateMockup({
    designUrl: designMetafield.value,
    outputName: `edit_${pendingEdit.productId}_${Date.now()}`,
    settings: {
      backgroundPath,
      yOffset: newYOffset,
      width: pendingEdit.adjustments.width,
      threshold: pendingEdit.adjustments.threshold || 60
    }
  });

  // Update session
  pendingEdit.adjustments.yOffset = newYOffset;
  pendingEdit.adjustments.description = `Y offset: ${newYOffset}px`;
  pendingEdit.newMockupUrl = mockupResult.url;
  pendingEdit.newMockupLocalPath = mockupResult.localPath;

  // Send new preview
  const caption =
    `✏️ <b>ADJUSTED PREVIEW</b>\n\n` +
    `<b>Product:</b> ${escapeHtml(pendingEdit.productTitle)}\n` +
    `<b>Y Offset:</b> ${newYOffset}px\n\n` +
    `Apply this change?`;

  const photoSource = mockupResult.localPath || mockupResult.url;
  await ctx.replyWithPhoto(
    photoSource.startsWith('http') ? photoSource : { source: photoSource },
    {
      caption,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '✅ Apply to Shopify', callback_data: 'edit:apply' },
            { text: '❌ Cancel', callback_data: 'edit:cancel' }
          ],
          [
            { text: '🔄 +10px down', callback_data: 'edit:adjust:down:10' },
            { text: '🔄 -10px up', callback_data: 'edit:adjust:up:10' }
          ]
        ]
      }
    }
  );
}

export default {
  handleEditCommand,
  handleEditApply,
  handleEditCancel,
  handleEditAdjust
};
