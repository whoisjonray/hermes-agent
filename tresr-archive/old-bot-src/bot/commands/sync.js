/**
 * /sync command - Sync design URLs to Shopify metafields
 *
 * Finds designs in Cloudinary and matches them to products
 * by timestamp proximity or product ID reference
 */

import { v2 as cloudinary } from 'cloudinary';
import { db } from '../../services/database.js';

// Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

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
 * Get all DESIGN images from Cloudinary (NOT mockups)
 * Designs are the raw artwork files sent to print shops
 */
async function getCloudinaryDesigns() {
  const designs = [];
  let nextCursor = null;

  do {
    const options = {
      type: 'upload',
      prefix: 'tresr/designs/',
      max_results: 100
    };
    if (nextCursor) options.next_cursor = nextCursor;

    const result = await cloudinary.api.resources(options);
    designs.push(...result.resources);
    nextCursor = result.next_cursor;
  } while (nextCursor);

  // NOTE: We intentionally do NOT include mockups here
  // Mockups are product images (shirt + design), not the raw design file
  // The design file is what gets sent to print shops

  return { designs, mockups: [] };
}

/**
 * Find DESIGN (not mockup) for a product by matching timestamps or IDs
 * Returns null if no raw design file is found
 */
function findDesignForProduct(product, cloudinaryData, conceptData) {
  const { designs } = cloudinaryData;

  if (designs.length === 0) {
    return null;
  }

  // Get product creation timestamp
  const productCreatedAt = new Date(product.created_at).getTime();

  // Strategy 1: Check if we have concept data with design info
  if (conceptData) {
    // Look for design matching concept ID in filename
    const matchingDesign = designs.find(d =>
      d.public_id.includes(conceptData.id) ||
      d.public_id.includes(conceptData.id.split('-')[0])
    );
    if (matchingDesign) return matchingDesign.secure_url;
  }

  // Strategy 2: Find design uploaded within 10 minutes BEFORE product creation
  // (design must be created before product)
  const matchingDesign = designs.find(d => {
    const uploadTime = new Date(d.created_at).getTime();
    const timeDiff = productCreatedAt - uploadTime;
    // Design should be 0-10 minutes before product creation
    return timeDiff >= 0 && timeDiff < 10 * 60 * 1000;
  });
  if (matchingDesign) return matchingDesign.secure_url;

  // Strategy 3: Match by timestamp in filename
  // Design filenames like "design_1768071453554" contain epoch ms
  for (const design of designs) {
    const timestampMatch = design.public_id.match(/(\d{13})/);
    if (timestampMatch) {
      const designTimestamp = parseInt(timestampMatch[1]);
      const timeDiff = productCreatedAt - designTimestamp;
      // If design timestamp is 0-15 minutes before product creation
      if (timeDiff >= 0 && timeDiff < 15 * 60 * 1000) {
        return design.secure_url;
      }
    }
  }

  return null;
}

/**
 * Handle /sync command
 */
export async function handleSyncCommand(ctx, shopifyManager) {
  const text = ctx.message.text;
  const args = text.split(' ').slice(1);

  if (args[0] === 'status') {
    // Show sync status
    return await showSyncStatus(ctx, shopifyManager);
  }

  if (args[0] === 'run') {
    // Run full sync
    return await runFullSync(ctx, shopifyManager);
  }

  // Show help
  await ctx.reply(
    `🔄 <b>DESIGN SYNC</b>\n\n` +
    `Matches Cloudinary designs to Shopify products and fills metafields.\n\n` +
    `<b>Commands:</b>\n` +
    `• <code>/sync status</code> - Check how many products need sync\n` +
    `• <code>/sync run</code> - Run sync for all products\n\n` +
    `This enables /edit to work on any product without manually providing design URLs.`,
    { parse_mode: 'HTML' }
  );
}

/**
 * Show sync status
 */
async function showSyncStatus(ctx, shopifyManager) {
  const statusMsg = await ctx.reply('🔍 Checking sync status...');

  try {
    // Get all products from Shopify
    const result = await shopifyManager.apiRequest('products.json?limit=250');
    const products = result.products;

    let withDesign = 0;
    let withoutDesign = 0;
    const missing = [];

    for (const product of products) {
      const metafields = await shopifyManager.apiRequest(`products/${product.id}/metafields.json`);
      const hasDesign = metafields.metafields?.some(
        m => m.namespace === 'tresr' && (m.key === 'artwork_url' || m.key === 'high_res_artwork') && m.value
      );

      if (hasDesign) {
        withDesign++;
      } else {
        withoutDesign++;
        missing.push(product.title);
      }
    }

    const missingList = missing.slice(0, 10).map(t => `• ${escapeHtml(t)}`).join('\n');
    const moreText = missing.length > 10 ? `\n...and ${missing.length - 10} more` : '';

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `📊 <b>SYNC STATUS</b>\n\n` +
      `✅ Products with design URL: ${withDesign}\n` +
      `❌ Products missing design URL: ${withoutDesign}\n\n` +
      (withoutDesign > 0 ? `<b>Missing:</b>\n${missingList}${moreText}\n\n` : '') +
      (withoutDesign > 0 ? `Run <code>/sync run</code> to attempt auto-matching.` : `All products synced!`),
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `❌ Error: ${escapeHtml(error.message)}`,
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * Run full sync
 */
async function runFullSync(ctx, shopifyManager) {
  const statusMsg = await ctx.reply('🔄 Starting sync...\n\n⏳ Fetching Cloudinary images...');

  try {
    // Get all Cloudinary images
    const cloudinaryData = await getCloudinaryDesigns();

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `🔄 <b>SYNCING</b>\n\n` +
      `✅ Found ${cloudinaryData.designs.length} designs in Cloudinary\n` +
      `✅ Found ${cloudinaryData.mockups.length} mockups in Cloudinary\n` +
      `⏳ Fetching Shopify products...`,
      { parse_mode: 'HTML' }
    );

    // Get all products from Shopify
    const result = await shopifyManager.apiRequest('products.json?limit=250');
    const products = result.products;

    let synced = 0;
    let skipped = 0;
    let failed = 0;
    const results = [];

    for (const product of products) {
      try {
        // Check if already has design URL
        const metafields = await shopifyManager.apiRequest(`products/${product.id}/metafields.json`);
        const hasDesign = metafields.metafields?.some(
          m => m.namespace === 'tresr' && (m.key === 'artwork_url' || m.key === 'high_res_artwork') && m.value
        );

        if (hasDesign) {
          skipped++;
          continue;
        }

        // Get concept data from local DB
        const concept = db.prepare(
          `SELECT * FROM design_concepts WHERE shopify_product_id = ?`
        ).get(product.id.toString());

        // Find matching design
        const designUrl = findDesignForProduct(product, cloudinaryData, concept);

        if (designUrl) {
          // Update metafield
          await shopifyManager.updateMetafield(
            product.id,
            'tresr',
            'artwork_url',
            designUrl,
            'url'
          );
          synced++;
          results.push({ title: product.title, status: 'synced' });
        } else {
          failed++;
          results.push({ title: product.title, status: 'no match' });
        }
      } catch (err) {
        failed++;
        results.push({ title: product.title, status: 'error', error: err.message });
      }
    }

    const syncedList = results
      .filter(r => r.status === 'synced')
      .slice(0, 5)
      .map(r => `✅ ${escapeHtml(r.title)}`)
      .join('\n');

    const failedList = results
      .filter(r => r.status !== 'synced' && r.status !== 'skipped')
      .slice(0, 5)
      .map(r => `❌ ${escapeHtml(r.title)}`)
      .join('\n');

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `✅ <b>SYNC COMPLETE</b>\n\n` +
      `🔗 Synced: ${synced}\n` +
      `⏭️ Skipped (already had URL): ${skipped}\n` +
      `❌ No match found: ${failed}\n\n` +
      (syncedList ? `<b>Synced:</b>\n${syncedList}\n\n` : '') +
      (failedList ? `<b>No match:</b>\n${failedList}\n` : '') +
      `\nProducts with no match may need design URLs added manually via /edit.`,
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    console.error('Sync error:', error);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `❌ Sync failed: ${escapeHtml(error.message)}`,
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * Sync a single product by ID
 */
export async function syncSingleProduct(productId, shopifyManager) {
  try {
    const cloudinaryData = await getCloudinaryDesigns();
    const product = await shopifyManager.getProduct(productId);

    if (!product) return { success: false, error: 'Product not found' };

    const concept = db.prepare(
      `SELECT * FROM design_concepts WHERE shopify_product_id = ?`
    ).get(productId.toString());

    const designUrl = findDesignForProduct(product, cloudinaryData, concept);

    if (designUrl) {
      await shopifyManager.updateMetafield(
        productId,
        'tresr',
        'artwork_url',
        designUrl,
        'url'
      );
      return { success: true, designUrl };
    }

    return { success: false, error: 'No matching design found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

export default {
  handleSyncCommand,
  syncSingleProduct
};
