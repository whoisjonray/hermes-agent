/**
 * Facebook Ads flow
 * Step 5: Create ad campaign for new product
 *
 * Uses deep customer research to create ads that make them feel SEEN, not sold to.
 */

/**
 * Escape HTML special characters for safe Telegram display
 */
function escapeHtml(text) {
  if (!text) return '';
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

import {
  createAdCampaign,
  createAdSet,
  createAd,
  getActiveCampaigns,
  getCampaignInsights,
  parseSpend,
  parseRevenue,
  parseROAS,
  getClientConfig,
  CLIENTS
} from '../../services/metaAdsService.js';

// Check if pixel is configured for TRESR
function hasPixelConfigured() {
  const tresrConfig = CLIENTS?.tresr;
  return !!(tresrConfig?.pixelId && tresrConfig.pixelId !== 'undefined');
}
import { generateAdCopy, getRandomConfession } from '../../services/customerResearch.js';

// Targeting templates by category
// NOTE: Using broad targeting (no interests) is often better - lets Meta's algorithm optimize
// Interest IDs can become invalid over time, so we use minimal/no interests
const TARGETING_TEMPLATES = {
  coffee: {
    interests: [],  // Broad targeting - Meta optimizes
    age_min: 25,
    age_max: 55
  },
  fitness: {
    interests: [],
    age_min: 18,
    age_max: 45
  },
  gaming: {
    interests: [],
    age_min: 18,
    age_max: 40
  },
  crypto: {
    interests: [],
    age_min: 21,
    age_max: 55
  },
  developer: {
    interests: [],
    age_min: 22,
    age_max: 50
  },
  'dog lovers': {
    interests: [],
    age_min: 25,
    age_max: 60
  },
  'cat lovers': {
    interests: [],
    age_min: 25,
    age_max: 60
  },
  entrepreneur: {
    interests: [],
    age_min: 25,
    age_max: 55
  },
  'mental health': {
    interests: [],
    age_min: 18,
    age_max: 45
  },
  default: {
    interests: [],
    age_min: 25,
    age_max: 55
  }
};

/**
 * Handle ad creation request
 */
export async function handleAdsCreate(ctx) {
  const publishedProduct = ctx.session?.publishedProduct;

  if (!publishedProduct) {
    await ctx.answerCbQuery('No product to advertise');
    return;
  }

  await ctx.answerCbQuery();

  await ctx.reply(
    `📣 <b>CREATE FACEBOOK AD</b>\n\n` +
    `<b>Product:</b> ${escapeHtml(publishedProduct.title)}\n` +
    `<b>Category:</b> ${escapeHtml(publishedProduct.category)}\n\n` +
    `<b>Test Budget:</b> $25 over 4 days (~$6/day)\n` +
    `<b>Targeting:</b> ${escapeHtml(publishedProduct.category)} interests\n` +
    `<b>Test Window:</b> Thu-Sun (best buying days)\n\n` +
    `<b>Auto-Optimization Rules:</b>\n` +
    `• Auto-pause if ROAS &lt; 1.0 after $25 spend\n` +
    `• Notify to scale if ROAS &gt; 2.5 after $25 spend\n\n` +
    `Launch ad campaign?`,
    {
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🚀 Launch $25 Test', callback_data: 'ads:launch:25' },
            { text: '💰 Launch $50 Test', callback_data: 'ads:launch:50' }
          ],
          [
            { text: '⚙️ Custom Budget', callback_data: 'ads:custom' },
            { text: '❌ Skip Ads', callback_data: 'flow:complete' }
          ]
        ]
      }
    }
  );
}

/**
 * Handle ad launch
 */
export async function handleAdsLaunch(ctx) {
  const budget = parseInt(ctx.callbackQuery.data.split(':')[2]);
  const publishedProduct = ctx.session?.publishedProduct;

  if (!publishedProduct) {
    await ctx.answerCbQuery('Session expired');
    return;
  }

  await ctx.answerCbQuery(`Launching $${budget} campaign...`);
  const statusMsg = await ctx.reply(`🚀 Creating Facebook ad campaign...\n\n⏳ Setting up campaign structure...`);

  try {
    const targeting = TARGETING_TEMPLATES[publishedProduct.category] || TARGETING_TEMPLATES.default;
    const dailyBudget = Math.round((budget / 4) * 100); // cents, 4-day test

    // Step 1: Create Campaign
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `🚀 Creating Facebook ad campaign...\n\n✅ Campaign structure\n⏳ Creating ad set...`
    );

    // Use OUTCOME_TRAFFIC if no pixel configured, otherwise OUTCOME_SALES
    const hasPixel = hasPixelConfigured();
    const campaignObjective = hasPixel ? 'OUTCOME_SALES' : 'OUTCOME_TRAFFIC';
    console.log(`Creating campaign with objective: ${campaignObjective} (pixel configured: ${hasPixel})`);

    const campaign = await createAdCampaign({
      name: `TRESR - ${publishedProduct.category} - ${publishedProduct.title}`,
      objective: campaignObjective,
      status: 'PAUSED' // Start paused, activate after review
    });

    // Step 2: Create Ad Set
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `🚀 Creating Facebook ad campaign...\n\n✅ Campaign created\n✅ Ad set created\n⏳ Creating ad creative...`
    );

    // Build targeting - only include interests if non-empty
    const adSetTargeting = {
      geo_locations: { countries: ['US'] },
      age_min: targeting.age_min,
      age_max: targeting.age_max,
      publisher_platforms: ['facebook', 'instagram']
    };

    // Only add interests if we have them (broad targeting is often better)
    if (targeting.interests && targeting.interests.length > 0) {
      adSetTargeting.interests = targeting.interests;
    }

    const adSet = await createAdSet({
      campaignId: campaign.id,
      name: `${publishedProduct.title} - Broad Targeting`,
      dailyBudget,
      targeting: adSetTargeting,
      optimization_goal: 'OFFSITE_CONVERSIONS',
      billing_event: 'IMPRESSIONS'
    });

    // Step 3: Create Ad with research-driven copy
    // Uses deep customer research to make them feel SEEN, not sold to
    const adCopy = generateAdCopy(publishedProduct.category, publishedProduct.title);

    const ad = await createAd({
      adSetId: adSet.id,
      name: `${publishedProduct.title} - Mockup`,
      creative: {
        title: publishedProduct.title,
        body: adCopy.body,
        link: publishedProduct.url,
        imageUrl: publishedProduct.mockupPath // Will need to upload to FB
      }
    });

    // Store what research was used for learning loop
    ctx.session.adResearch = {
      confession_used: adCopy.confession_used,
      phrases_used: adCopy.phrases_used,
      hook: adCopy.hook
    };

    // Store campaign info
    ctx.session.adCampaign = {
      campaignId: campaign.id,
      adSetId: adSet.id,
      adId: ad.id,
      budget,
      dailyBudget: dailyBudget / 100,
      status: 'PAUSED'
    };

    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);

    await ctx.reply(
      `✅ <b>AD CAMPAIGN CREATED!</b>\n\n` +
      `<b>Campaign:</b> ${campaign.id}\n` +
      `<b>Budget:</b> $${budget} over 4 days ($${dailyBudget / 100}/day)\n` +
      `<b>Status:</b> PAUSED (ready to activate)\n\n` +
      `<b>Targeting:</b>\n` +
      `• Age: ${targeting.age_min}-${targeting.age_max}\n` +
      `• Location: United States\n` +
      `• Interests: ${targeting.interests.map(i => i.name).join(', ') || 'Broad'}\n\n` +
      `<b>Research-Driven Copy:</b>\n` +
      `<i>"${escapeHtml(adCopy.hook)}"</i>\n\n` +
      `Activate campaign to start test?`,
      {
        parse_mode: 'HTML',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '▶️ Activate Now', callback_data: `ads:activate:${campaign.id}` },
              { text: '⏰ Schedule Thu', callback_data: `ads:schedule:${campaign.id}` }
            ],
            [
              { text: '✅ Done (Keep Paused)', callback_data: 'flow:complete' }
            ]
          ]
        }
      }
    );

  } catch (error) {
    console.error('Ad creation error:', error);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `❌ Ad creation failed: ${escapeHtml(error.message)}\n\nProduct is live on Shopify. You can create ads manually later.`,
      {
        reply_markup: {
          inline_keyboard: [
            [{ text: '✅ Complete Without Ads', callback_data: 'flow:complete' }]
          ]
        }
      }
    );
  }
}

/**
 * Handle ad activation
 * Must activate all 3 levels: Campaign → Ad Set → Ad
 */
export async function handleAdsActivate(ctx) {
  const campaignId = ctx.callbackQuery.data.split(':')[2];
  const adCampaign = ctx.session?.adCampaign;

  await ctx.answerCbQuery('Activating all ad levels...');

  try {
    const accessToken = process.env.FACEBOOK_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;

    // Activate Campaign
    await fetch(`https://graph.facebook.com/v18.0/${campaignId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `access_token=${accessToken}&status=ACTIVE`
    });

    // Activate Ad Set (if we have it in session)
    if (adCampaign?.adSetId) {
      await fetch(`https://graph.facebook.com/v18.0/${adCampaign.adSetId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `access_token=${accessToken}&status=ACTIVE`
      });
    }

    // Activate Ad (if we have it in session)
    if (adCampaign?.adId) {
      await fetch(`https://graph.facebook.com/v18.0/${adCampaign.adId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `access_token=${accessToken}&status=ACTIVE`
      });
    }

    await ctx.reply(
      `✅ <b>CAMPAIGN ACTIVATED!</b>\n\n` +
      `All levels activated:\n` +
      `• Campaign: ACTIVE\n` +
      `• Ad Set: ACTIVE\n` +
      `• Ad: ACTIVE\n\n` +
      `Your ad is now live and will start serving.\n\n` +
      `<b>Auto-Optimization Active:</b>\n` +
      `• Checking every 12 hours\n` +
      `• Will pause if ROAS &lt; 1.0 after $25\n` +
      `• Will notify to scale if ROAS &gt; 2.5\n\n` +
      `Use /ads to check performance anytime.`,
      { parse_mode: 'HTML' }
    );

  } catch (error) {
    await ctx.reply(`❌ Activation failed: ${escapeHtml(error.message)}`);
  }
}

/**
 * Handle /ads command
 * - No args: show ad performance
 * - With URL/ID: create ad for existing product
 */
export async function handleAdsCommand(ctx, shopifyManager) {
  const args = ctx.message.text.split(' ').slice(1).join(' ').trim();

  // If a URL or product ID was provided, create an ad for that product
  if (args) {
    await handleCreateAdForProduct(ctx, args, shopifyManager);
    return;
  }

  // Otherwise show ad performance
  const loadingMsg = await ctx.reply(
    `📊 <b>AD PERFORMANCE</b>\n\n` +
    `Loading active campaigns...\n\n` +
    `<i>Tip: Use /ads [product-url] to create an ad for an existing product</i>`,
    { parse_mode: 'HTML' }
  );

  try {
    // Fetch campaigns for TRESR (default client)
    const campaigns = await getActiveCampaigns('tresr');

    if (campaigns.length === 0) {
      await ctx.telegram.editMessageText(
        ctx.chat.id,
        loadingMsg.message_id,
        null,
        `📊 <b>AD PERFORMANCE</b>\n\n` +
        `<b>Active Campaigns:</b> 0\n\n` +
        `No active campaigns found for TRESR.\n\n` +
        `Use /trends to create new products and ads.\n` +
        `Or use /ads [product-url] to advertise an existing product.`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Fetch insights for each campaign
    let totalSpend = 0;
    let totalRevenue = 0;
    let campaignDetails = [];

    for (const campaign of campaigns.slice(0, 5)) { // Limit to 5 for readability
      const insights = await getCampaignInsights(campaign.id, 'today');
      const spend = parseSpend(insights);
      const revenue = parseRevenue(insights);
      const roas = parseROAS(insights);

      totalSpend += spend;
      totalRevenue += revenue;

      const statusIcon = campaign.status === 'ACTIVE' ? '🟢' :
                        campaign.status === 'PAUSED' ? '🟡' : '🔴';

      campaignDetails.push(
        `${statusIcon} <b>${escapeHtml(campaign.name)}</b>\n` +
        `   Spend: $${spend.toFixed(2)} | Rev: $${revenue.toFixed(2)} | ROAS: ${roas ? roas.toFixed(2) + 'x' : 'N/A'}`
      );
    }

    const overallROAS = totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : 'N/A';

    let message = `📊 <b>AD PERFORMANCE - TRESR</b>\n\n`;
    message += `<b>Active Campaigns:</b> ${campaigns.length}\n`;
    message += `<b>Today's Spend:</b> $${totalSpend.toFixed(2)}\n`;
    message += `<b>Today's Revenue:</b> $${totalRevenue.toFixed(2)}\n`;
    message += `<b>Overall ROAS:</b> ${overallROAS}x\n\n`;
    message += `<b>Campaigns:</b>\n`;
    message += campaignDetails.join('\n\n');

    if (campaigns.length > 5) {
      message += `\n\n<i>...and ${campaigns.length - 5} more campaigns</i>`;
    }

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      null,
      message,
      { parse_mode: 'HTML' }
    );

  } catch (error) {
    console.error('Error fetching ad performance:', error);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      loadingMsg.message_id,
      null,
      `📊 <b>AD PERFORMANCE</b>\n\n` +
      `❌ Error fetching data: ${escapeHtml(error.message)}\n\n` +
      `Make sure Meta API access is configured.`,
      { parse_mode: 'HTML' }
    );
  }
}

/**
 * Create ad for an existing Shopify product
 */
async function handleCreateAdForProduct(ctx, urlOrId, shopifyManager) {
  const statusMsg = await ctx.reply(
    `🔍 <b>LOOKING UP PRODUCT</b>\n\n` +
    `Searching for: ${escapeHtml(urlOrId.substring(0, 50))}...`,
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
        `Could not find a product matching:\n` +
        `<code>${escapeHtml(urlOrId.substring(0, 100))}</code>\n\n` +
        `<b>Supported formats:</b>\n` +
        `• https://tresr.com/products/product-name\n` +
        `• https://becc05-b4.myshopify.com/admin/products/123456\n` +
        `• Just the product ID: 123456`,
        { parse_mode: 'HTML' }
      );
      return;
    }

    // Get product image
    const imageUrl = product.images?.[0]?.src || product.image?.src || null;

    // Detect category from tags or title
    const tags = product.tags ? product.tags.toLowerCase() : '';
    const title = product.title.toLowerCase();
    let category = 'default';

    const categoryKeywords = {
      coffee: ['coffee', 'caffeine', 'espresso', 'brew'],
      fitness: ['fitness', 'gym', 'workout', 'muscle'],
      gaming: ['gaming', 'gamer', 'game', 'player'],
      crypto: ['crypto', 'bitcoin', 'hodl', 'blockchain'],
      developer: ['developer', 'code', 'programming', 'dev'],
      'dog lovers': ['dog', 'puppy', 'pup'],
      'cat lovers': ['cat', 'kitten', 'kitty'],
      entrepreneur: ['entrepreneur', 'hustle', 'boss', 'business'],
      'mental health': ['mental', 'anxiety', 'self care']
    };

    for (const [cat, keywords] of Object.entries(categoryKeywords)) {
      if (keywords.some(kw => tags.includes(kw) || title.includes(kw))) {
        category = cat;
        break;
      }
    }

    // Store product info in session
    ctx.session = ctx.session || {};
    ctx.session.publishedProduct = {
      id: product.id,
      title: product.title,
      url: `https://tresr.com/products/${product.handle}`,
      mockupPath: imageUrl,
      category
    };

    await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);

    // Show product details and ad options
    const message =
      `📦 <b>PRODUCT FOUND</b>\n\n` +
      `<b>Title:</b> ${escapeHtml(product.title)}\n` +
      `<b>Category:</b> ${escapeHtml(category)}\n` +
      `<b>Status:</b> ${product.status}\n` +
      `<b>URL:</b> tresr.com/products/${escapeHtml(product.handle)}\n\n` +
      `<b>Create Facebook Ad?</b>\n` +
      `• $25 test budget over 4 days\n` +
      `• Auto-pause if ROAS &lt; 1.0\n` +
      `• Notify to scale if ROAS &gt; 2.5`;

    const buttons = [
      [
        { text: '🚀 Launch $25 Test', callback_data: 'ads:launch:25' },
        { text: '💰 Launch $50 Test', callback_data: 'ads:launch:50' }
      ],
      [
        { text: '❌ Cancel', callback_data: 'flow:cancel' }
      ]
    ];

    if (imageUrl) {
      await ctx.replyWithPhoto(imageUrl, {
        caption: message,
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      });
    } else {
      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: { inline_keyboard: buttons }
      });
    }

  } catch (error) {
    console.error('Error creating ad for product:', error);
    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      null,
      `❌ <b>ERROR</b>\n\n${escapeHtml(error.message)}`,
      { parse_mode: 'HTML' }
    );
  }
}

export default {
  handleAdsCreate,
  handleAdsLaunch,
  handleAdsActivate,
  handleAdsCommand
};
