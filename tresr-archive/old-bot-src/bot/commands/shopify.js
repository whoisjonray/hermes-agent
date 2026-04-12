/**
 * Shopify product creation flow
 * Step 4: Create product with SEO title/description, get approval, publish
 */

import {
  createShopifyProduct,
  uploadImageToShopify,
  addToCollection,
  getCategoryCollectionId,
  getAllFeaturedCollectionId
} from '../../services/shopifyService.js';
import { markPublished } from '../../services/conceptDatabase.js';

// For metafield creation
const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

/**
 * Strip HTML tags from text (Telegram only supports limited HTML)
 */
function stripHtml(html) {
  return html?.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim() || '';
}

/**
 * Handle Shopify product creation request
 */
export async function handleShopifyCreate(ctx) {
  const currentDesign = ctx.session?.currentDesign;
  const finalMockupPath = ctx.session?.finalMockupPath;

  if (!currentDesign || !finalMockupPath) {
    await ctx.answerCbQuery('Session expired. Start over with /trends');
    return;
  }

  await ctx.answerCbQuery('Generating Shopify product...');

  const statusMsg = await ctx.reply('📦 Creating Shopify product...\n\n⏳ Generating SEO title and description...');

  try {
    // Generate SEO-optimized title and description
    const productContent = await generateProductContent(currentDesign);

    // Update status
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      '📦 Creating Shopify product...\n\n✅ Content generated\n⏳ Uploading image...'
    );

    // Store for approval
    ctx.session.pendingProduct = {
      ...productContent,
      mockupPath: finalMockupPath,
      category: currentDesign.category,
      designBrief: currentDesign.designBrief,
      // CRITICAL: Store raw design URL for print shop metafield
      designCloudinaryUrl: currentDesign.designCloudinaryUrl
    };

    // Delete status and send for approval
    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);

    // Strip HTML from description for Telegram display (Telegram only supports limited HTML tags)
    const plainDescription = stripHtml(productContent.description).substring(0, 400);

    await ctx.reply(
      `📦 <b>SHOPIFY PRODUCT PREVIEW</b>\n\n` +
      `<b>Title:</b>\n${productContent.title}\n\n` +
      `<b>Description:</b>\n${plainDescription}...\n\n` +
      `<b>Price:</b> $${productContent.price}\n` +
      `<b>Tags:</b> ${productContent.tags.slice(0, 5).join(', ')}\n\n` +
      `<b>Approve to publish to Shopify</b>`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '✅ Publish to Shopify', callback_data: 'shopify:publish' },
              { text: '✏️ Edit Title', callback_data: 'shopify:edit:title' }
            ],
            [
              { text: '✏️ Edit Description', callback_data: 'shopify:edit:description' },
              { text: '❌ Cancel', callback_data: 'flow:cancel' }
            ]
          ]
        }
      }
    );

  } catch (error) {
    console.error('Shopify creation error:', error);
    // Status message may have been deleted, use try-catch
    try {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        statusMsg.message_id,
        null,
        `❌ Product creation failed: ${error.message}`
      );
    } catch (e) {
      // Message already deleted, send new one
      await ctx.reply(`❌ Product creation failed: ${error.message}`);
    }
  }
}

/**
 * Handle product publish
 */
export async function handleShopifyPublish(ctx) {
  const pendingProduct = ctx.session?.pendingProduct;

  if (!pendingProduct) {
    await ctx.answerCbQuery('Session expired');
    return;
  }

  await ctx.answerCbQuery('Publishing to Shopify...');
  const statusMsg = await ctx.reply('🚀 Publishing to Shopify...');

  try {
    // Create product via Shopify Admin API
    const product = await createShopifyProduct({
      title: pendingProduct.title,
      body_html: pendingProduct.description,
      vendor: 'TRESR',
      product_type: 'T-Shirt',
      tags: pendingProduct.tags,
      variants: [
        { option1: 'S', price: pendingProduct.price, inventory_quantity: 999 },
        { option1: 'M', price: pendingProduct.price, inventory_quantity: 999 },
        { option1: 'L', price: pendingProduct.price, inventory_quantity: 999 },
        { option1: 'XL', price: pendingProduct.price, inventory_quantity: 999 },
        { option1: '2XL', price: pendingProduct.price, inventory_quantity: 999 }
      ],
      options: [{ name: 'Size', values: ['S', 'M', 'L', 'XL', '2XL'] }],
      images: [{ src: await uploadImageToShopify(pendingProduct.mockupPath) }]
    });

    // Store product info
    ctx.session.publishedProduct = {
      id: product.id,
      handle: product.handle,
      url: `https://${process.env.SHOPIFY_PUBLIC_DOMAIN || 'tresr.com'}/products/${product.handle}`,
      ...pendingProduct
    };

    // Add design URL metafield for print shop / edit command
    if (pendingProduct.designCloudinaryUrl) {
      try {
        const metafieldUrl = `https://${SHOPIFY_STORE}/admin/api/2024-01/products/${product.id}/metafields.json`;
        await fetch(metafieldUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Shopify-Access-Token': SHOPIFY_TOKEN
          },
          body: JSON.stringify({
            metafield: {
              namespace: 'tresr',
              key: 'artwork_url',
              value: pendingProduct.designCloudinaryUrl,
              type: 'url'
            }
          })
        });
        console.log(`Artwork URL metafield added for product ${product.id}`);
      } catch (metafieldError) {
        console.error('Failed to add artwork metafield:', metafieldError.message);
        // Don't fail product creation for this
      }
    }

    // Mark concept as published in database (if from pre-researched concepts)
    const conceptId = ctx.session?.pendingConceptId;
    if (conceptId) {
      markPublished(conceptId, String(product.id));
      console.log(`Concept ${conceptId} marked as published (Shopify: ${product.id})`);
    }

    // Add product to collections
    try {
      // 1. Add to all-featured (main shop page)
      const allFeaturedId = getAllFeaturedCollectionId();
      await addToCollection(product.id, allFeaturedId);
      console.log(`Product ${product.id} added to all-featured collection`);

      // 2. Add to category-specific collection (homepage section)
      const categoryCollectionId = getCategoryCollectionId(pendingProduct.category);
      if (categoryCollectionId) {
        await addToCollection(product.id, categoryCollectionId);
        console.log(`Product ${product.id} added to ${pendingProduct.category} collection`);
      }
    } catch (collectionError) {
      console.error('Failed to add to collection:', collectionError.message);
      // Don't fail the whole publish for this
    }

    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);

    await ctx.reply(
      `✅ <b>PRODUCT PUBLISHED!</b>\n\n` +
      `<b>Title:</b> ${pendingProduct.title}\n` +
      `<b>Price:</b> $${pendingProduct.price}\n\n` +
      `<b>Link:</b>\n${ctx.session.publishedProduct.url}\n\n` +
      `Ready to create Facebook ad?`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '📣 Create Facebook Ad', callback_data: 'ads:create' },
              { text: '⏭️ Skip Ads', callback_data: 'flow:complete' }
            ],
            [
              { text: '🔗 View Product', url: ctx.session.publishedProduct.url }
            ]
          ]
        }
      }
    );

  } catch (error) {
    console.error('Shopify publish error:', error);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `❌ Publish failed: ${error.message}\n\nTry again or check Shopify connection.`
    );
  }
}

/**
 * Handle title edit request
 */
export async function handleEditTitle(ctx) {
  await ctx.answerCbQuery();
  ctx.session.awaitingEdit = 'title';

  await ctx.reply(
    '✏️ <b>Edit Title</b>\n\n' +
    `Current: ${ctx.session.pendingProduct.title}\n\n` +
    'Send your new title:',
    { parse_mode: 'HTML' }
  );
}

/**
 * Handle description edit request
 */
export async function handleEditDescription(ctx) {
  await ctx.answerCbQuery();
  ctx.session.awaitingEdit = 'description';

  await ctx.reply(
    '✏️ <b>Edit Description</b>\n\n' +
    'Send your new description (can be multiple lines):',
    { parse_mode: 'HTML' }
  );
}

/**
 * Handle edit text input
 */
export async function handleEditInput(ctx) {
  const editType = ctx.session?.awaitingEdit;
  if (!editType || !ctx.session.pendingProduct) return false;

  const newValue = ctx.message.text;
  ctx.session.pendingProduct[editType] = newValue;
  ctx.session.awaitingEdit = null;

  await ctx.reply(
    `✅ ${editType.charAt(0).toUpperCase() + editType.slice(1)} updated!\n\n` +
    `New ${editType}: ${newValue.substring(0, 200)}${newValue.length > 200 ? '...' : ''}`,
    {
      reply_markup: {
        inline_keyboard: [
          [{ text: '✅ Publish to Shopify', callback_data: 'shopify:publish' }],
          [{ text: '✏️ Edit More', callback_data: 'shopify:create' }]
        ]
      }
    }
  );

  return true;
}

/**
 * Generate SEO-optimized product content using Gemini
 */
async function generateProductContent(design) {
  const geminiKey = process.env.GEMINI_API_KEY;
  const { category, designBrief } = design;

  const prompt = `Generate Shopify product content for a t-shirt:

Category: ${category}
Design Title: ${designBrief.title}
Design Text: ${designBrief.textContent || 'N/A'}
Design Type: ${designBrief.designType || 'typography'}

Return JSON:
{
  "title": "SEO optimized title (max 70 chars) - include category keyword and appeal",
  "description": "HTML description with: 1) Catchy opening, 2) Who it's for, 3) Features (soft cotton, unisex fit), 4) Size guide note, 5) Care instructions. Use <p> tags.",
  "tags": ["tag1", "tag2", "tag3", "tag4", "tag5"],
  "price": "29"
}`;

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
        generationConfig: { temperature: 0.7 }
      })
    }
  );

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  // Fallback
  return {
    title: `${designBrief.title} - ${category} T-Shirt`,
    description: `<p>Show your love for ${category} with this awesome tee!</p><p>Soft, comfortable, and perfect for everyday wear.</p>`,
    tags: [category, 'tshirt', 'gift', designBrief.designType || 'typography'],
    price: '29'
  };
}

export default {
  handleShopifyCreate,
  handleShopifyPublish,
  handleEditTitle,
  handleEditDescription,
  handleEditInput
};
