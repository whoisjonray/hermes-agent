/**
 * TRESR Telegram Bot
 * Automated POD trend detection, product creation, and fulfillment
 */

import 'dotenv/config';
import { Telegraf, Markup, session } from 'telegraf';
import express from 'express';
import cron from 'node-cron';
import { initDatabase, db } from './services/database.js';
import { TrendDetector } from './modules/trend-detector.js';
import { DesignGenerator } from './modules/design-generator.js';
import { ShopifyManager } from './modules/shopify-manager.js';
import { FulfillmentManager } from './modules/fulfillment-manager.js';
import { formatStatus, formatTrendOpportunity, formatDailyReport } from './services/formatters.js';
import { generateMockup } from './services/mockupService.js';
import {
  handleTrendsCommand,
  handleTrendsCallback,
  handleConceptSelect,
  handleShowAnother,
  handleConceptReject,
  handleCustomTextDescription,
  handleCustomVoiceDescription
} from './bot/commands/trends.js';

import {
  handleDesignApprove,
  handleDesignReject,
  handleDesignRemix,
  handleFeedbackRequest,
  handleTextFeedback,
  handleVoiceFeedback
} from './bot/commands/design.js';

import {
  handleBackgroundSelection,
  handleBackgroundSelect,
  handleBackgroundRegenerate
} from './bot/commands/backgrounds.js';

import {
  handleShopifyCreate,
  handleShopifyPublish,
  handleEditTitle,
  handleEditDescription,
  handleEditInput
} from './bot/commands/shopify.js';

import {
  handleAdsCreate,
  handleAdsLaunch,
  handleAdsActivate,
  handleAdsCommand
} from './bot/commands/ads.js';

import {
  handleEditCommand,
  handleEditApply,
  handleEditCancel,
  handleEditAdjust
} from './bot/commands/edit.js';

import { handleSyncCommand } from './bot/commands/sync.js';

// Initialize bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);
bot.use(session()); // Enable session for storing pending design briefs
const app = express();
app.use(express.json());

// Module instances
let trendDetector, designGenerator, shopifyManager, fulfillmentManager;

// ===================
// MIDDLEWARE
// ===================

// Auth check - only allow configured admins
bot.use(async (ctx, next) => {
  const adminIds = (process.env.TELEGRAM_ADMIN_IDS || '').split(',').map(id => id.trim());
  const userId = String(ctx.from?.id);

  if (!adminIds.includes(userId)) {
    console.log(`Unauthorized access attempt from user ${userId}`);
    return ctx.reply('⛔ Unauthorized. Contact admin for access.');
  }
  return next();
});

// Error handling
bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply(`❌ Error: ${err.message}`).catch(() => {});
});

// ===================
// COMMANDS
// ===================

bot.command('start', async (ctx) => {
  await ctx.replyWithHTML(`
🎯 <b>TRESR Automation Bot</b>

Welcome! I help you find trends, create products, and manage fulfillment.

<b>Commands:</b>
/status - System overview
/trends - Scan for trending opportunities
/products - Product management
/orders - Recent orders & fulfillment
/pending - View pending approvals
/report - Generate performance report
/help - Show all commands

<b>Quick Actions:</b>
• Reply to any notification with feedback
• Use inline buttons to approve/reject
• Send /pause to stop automations
  `);
});

bot.command('help', async (ctx) => {
  await ctx.replyWithHTML(`
📚 <b>TRESR Bot Commands</b>

<b>📊 Status & Reports</b>
/status - System status overview
/report - Daily performance report
/report weekly - Weekly summary

<b>🎯 Trend Detection</b>
/trends - Scan all niches now
/trends [niche] - Scan specific niche
/niches - List monitored niches

<b>📦 Products</b>
/products - Product overview
/products today - Products created today
/products winners - Top performers

<b>🚚 Fulfillment</b>
/orders - Recent orders
/orders pending - Orders needing artwork
/artwork [order_id] - Send artwork to print shop

<b>⏸️ Control</b>
/pause - Pause all automations
/resume - Resume automations
/pending - View pending approvals

<b>⚙️ Settings</b>
/settings - View current settings
/threshold [number] - Set trend score threshold
  `);
});

bot.command('status', async (ctx) => {
  try {
    const status = await getSystemStatus();
    await ctx.replyWithHTML(formatStatus(status), {
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('🔄 Refresh', 'refresh_status'),
          Markup.button.callback('📊 Full Report', 'full_report')
        ],
        [
          Markup.button.callback('🎯 Scan Trends', 'scan_trends'),
          Markup.button.callback('📦 View Orders', 'view_orders')
        ]
      ])
    });
  } catch (error) {
    await ctx.reply(`❌ Error getting status: ${error.message}`);
  }
});

// New database-aware /trends command (checks pre-researched concepts first)
bot.command('trends', handleTrendsCommand);

// Trends callback handlers (category selection, show another, reject)
bot.action(/^trends:(.+)$/, handleTrendsCallback);
bot.action(/^concept:select:(.+)$/, handleConceptSelect);
bot.action(/^concept:another:(.+)$/, handleShowAnother);
bot.action(/^concept:reject:(.+)$/, handleConceptReject);

// Design callback handlers (approve, reject, remix, feedback)
bot.action(/^design:approve:(.+)$/, handleDesignApprove);
bot.action(/^design:reject:(.+)$/, handleDesignReject);
bot.action(/^design:remix:(.+)$/, handleDesignRemix);
bot.action(/^design:feedback:(.+)$/, handleFeedbackRequest);

// Background callback handlers
bot.action(/^bg:select:(.+)$/, handleBackgroundSelect);
bot.action(/^bg:regenerate:(.+)$/, handleBackgroundRegenerate);
bot.action(/^bg:back:(.+)$/, async (ctx) => {
  const category = ctx.callbackQuery.data.split(':')[2];
  await handleBackgroundSelection(ctx, category);
});

// Shopify callback handlers
bot.action('shopify:create', handleShopifyCreate);
bot.action('shopify:publish', handleShopifyPublish);
bot.action('shopify:edit:title', handleEditTitle);
bot.action('shopify:edit:description', handleEditDescription);

// Ads callback handlers
bot.action('ads:create', handleAdsCreate);
bot.action(/^ads:launch:(.+)$/, handleAdsLaunch);
bot.action(/^ads:activate:(.+)$/, handleAdsActivate);

// Flow control handlers
bot.action('flow:complete', async (ctx) => {
  await ctx.answerCbQuery('Flow complete!');
  await ctx.reply(
    `✅ <b>PRODUCT CREATION COMPLETE!</b>\n\n` +
    `Your product is live and (optionally) advertising.\n\n` +
    `Use /trends to create another product.`,
    { parse_mode: 'HTML' }
  );
});

bot.action('flow:cancel', async (ctx) => {
  await ctx.answerCbQuery('Flow cancelled');
  await ctx.reply('Flow cancelled. Use /trends to start over.');
  ctx.session = {};
});

// Handle custom voice messages for trends and design feedback
bot.on('voice', async (ctx, next) => {
  // Check if this is a custom design description
  const handledCustom = await handleCustomVoiceDescription(ctx);
  if (handledCustom) return;

  // Check if we're in design feedback mode
  if (ctx.session?.currentDesign || ctx.session?.awaitingFeedback) {
    await handleVoiceFeedback(ctx);
    return;
  }

  return next();
});

bot.command('orders', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  const filter = args[0] || 'recent';

  try {
    const orders = await shopifyManager.getOrders(filter);

    if (orders.length === 0) {
      return ctx.reply('No orders found matching that filter.');
    }

    let message = `📦 <b>Orders (${filter})</b>\n\n`;

    for (const order of orders.slice(0, 10)) {
      const artworkStatus = order.artworkSent ? '✅' : '⏳';
      message += `${artworkStatus} <b>#${order.orderNumber}</b>\n`;
      message += `   ${order.lineItems.map(li => li.title).join(', ')}\n`;
      message += `   $${order.total} - ${order.createdAt}\n\n`;
    }

    await ctx.replyWithHTML(message, {
      ...Markup.inlineKeyboard([
        [Markup.button.callback('📤 Send All Artwork', 'send_all_artwork')],
        [Markup.button.callback('🔄 Refresh', 'refresh_orders')]
      ])
    });
  } catch (error) {
    await ctx.reply(`❌ Error fetching orders: ${error.message}`);
  }
});

// /ads command - view performance or create ad for existing product
bot.command('ads', async (ctx) => {
  await handleAdsCommand(ctx, shopifyManager);
});

// /edit command - edit product mockups
bot.command('edit', async (ctx) => {
  await handleEditCommand(ctx, shopifyManager);
});

// Edit callbacks
bot.action('edit:apply', async (ctx) => {
  await handleEditApply(ctx, shopifyManager);
});
bot.action('edit:cancel', handleEditCancel);
bot.action(/^edit:adjust:(.+):(\d+)$/, async (ctx) => {
  await handleEditAdjust(ctx, shopifyManager);
});

// /sync command - sync design URLs to Shopify metafields
bot.command('sync', async (ctx) => {
  await handleSyncCommand(ctx, shopifyManager);
});

bot.command('pending', async (ctx) => {
  try {
    const pending = db.prepare(`
      SELECT * FROM pending_approvals
      WHERE status = 'pending'
      ORDER BY created_at DESC
      LIMIT 10
    `).all();

    if (pending.length === 0) {
      return ctx.reply('✅ No pending approvals!');
    }

    await ctx.reply(`📋 ${pending.length} pending approval(s):`);

    for (const item of pending) {
      await sendApprovalRequest(ctx, item);
    }
  } catch (error) {
    await ctx.reply(`❌ Error: ${error.message}`);
  }
});

bot.command('pause', async (ctx) => {
  db.prepare(`UPDATE system_state SET value = 'paused' WHERE key = 'automation_status'`).run();
  await ctx.reply('⏸️ Automations paused. Use /resume to restart.');
});

bot.command('resume', async (ctx) => {
  db.prepare(`UPDATE system_state SET value = 'running' WHERE key = 'automation_status'`).run();
  await ctx.reply('▶️ Automations resumed.');
});

bot.command('metrics', async (ctx) => {
  try {
    // Get design metrics
    const designStats = db.prepare(`
      SELECT
        COUNT(*) as total_designs,
        SUM(previews) as total_previews,
        SUM(approvals) as total_approvals,
        SUM(rejections) as total_rejections,
        SUM(regenerations) as total_regenerations
      FROM designs
    `).get();

    // Get by niche
    const byNiche = db.prepare(`
      SELECT niche,
             COUNT(*) as designs,
             SUM(approvals) as approved,
             SUM(rejections) as rejected
      FROM designs
      GROUP BY niche
      ORDER BY designs DESC
      LIMIT 5
    `).all();

    // Get research stats
    const researchStats = db.prepare(`
      SELECT COUNT(*) as scans, SUM(image_count) as images_analyzed
      FROM design_research
    `).get();

    // Get feedback breakdown
    const feedbackStats = db.prepare(`
      SELECT feedback, COUNT(*) as count
      FROM design_feedback
      GROUP BY feedback
      ORDER BY count DESC
    `).all();

    // Calculate approval rate
    const totalDecisions = (designStats.total_approvals || 0) + (designStats.total_rejections || 0);
    const approvalRate = totalDecisions > 0
      ? Math.round((designStats.total_approvals / totalDecisions) * 100)
      : 'N/A';

    let message = `📊 <b>TRESR Bot Metrics</b>\n\n`;

    message += `<b>Design Performance:</b>\n`;
    message += `• Total designs: ${designStats.total_designs || 0}\n`;
    message += `• Previews: ${designStats.total_previews || 0}\n`;
    message += `• Approvals: ${designStats.total_approvals || 0}\n`;
    message += `• Rejections: ${designStats.total_rejections || 0}\n`;
    message += `• Regenerations: ${designStats.total_regenerations || 0}\n`;
    message += `• <b>Approval Rate: ${approvalRate}%</b>\n\n`;

    message += `<b>Research Data:</b>\n`;
    message += `• X API scans: ${researchStats.scans || 0}\n`;
    message += `• Images analyzed: ${researchStats.images_analyzed || 0}\n\n`;

    if (byNiche.length > 0) {
      message += `<b>By Niche:</b>\n`;
      for (const n of byNiche) {
        const nicheApproval = (n.approved || 0) + (n.rejected || 0) > 0
          ? Math.round((n.approved / ((n.approved || 0) + (n.rejected || 0))) * 100)
          : 'N/A';
        message += `• ${n.niche}: ${n.designs} designs (${nicheApproval}% approved)\n`;
      }
      message += '\n';
    }

    if (feedbackStats.length > 0) {
      message += `<b>Feedback Types:</b>\n`;
      for (const f of feedbackStats.slice(0, 5)) {
        message += `• ${f.feedback}: ${f.count}\n`;
      }
    }

    message += `\n<i>Use this data to understand what designs work best.</i>`;

    await ctx.replyWithHTML(message);
  } catch (error) {
    await ctx.reply(`❌ Error getting metrics: ${error.message}`);
  }
});

bot.command('artwork', async (ctx) => {
  const args = ctx.message.text.split(' ').slice(1);
  const orderId = args[0];

  if (!orderId) {
    return ctx.reply('Usage: /artwork [order_id or order_number]');
  }

  try {
    await ctx.reply('📤 Sending artwork to print shop...');
    const result = await fulfillmentManager.sendArtwork(orderId);
    await ctx.reply(`✅ Artwork sent!\n\nOrder: #${result.orderNumber}\nFiles: ${result.filesSent}\nSent to: ${result.destination}`);
  } catch (error) {
    await ctx.reply(`❌ Error sending artwork: ${error.message}`);
  }
});

// ===================
// CALLBACK HANDLERS
// ===================

bot.action(/approve:(.+)/, async (ctx) => {
  const id = ctx.match[1];

  try {
    const item = db.prepare('SELECT * FROM pending_approvals WHERE id = ?').get(id);

    if (!item) {
      return ctx.answerCbQuery('Item not found or already processed');
    }

    // Execute the approved action
    await executeApproval(item);

    // Update status
    db.prepare(`UPDATE pending_approvals SET status = 'approved', resolved_at = datetime('now') WHERE id = ?`).run(id);

    // Update message
    await ctx.editMessageText(
      ctx.callbackQuery.message.text + '\n\n✅ <b>APPROVED</b>',
      { parse_mode: 'HTML' }
    );

    await ctx.answerCbQuery('Approved!');
  } catch (error) {
    await ctx.answerCbQuery(`Error: ${error.message}`);
  }
});

bot.action(/reject:(.+)/, async (ctx) => {
  const id = ctx.match[1];

  try {
    db.prepare(`UPDATE pending_approvals SET status = 'rejected', resolved_at = datetime('now') WHERE id = ?`).run(id);

    await ctx.editMessageText(
      ctx.callbackQuery.message.text + '\n\n❌ <b>REJECTED</b>',
      { parse_mode: 'HTML' }
    );

    await ctx.answerCbQuery('Rejected');
  } catch (error) {
    await ctx.answerCbQuery(`Error: ${error.message}`);
  }
});

bot.action(/preview:(.+)/, async (ctx) => {
  const trendId = ctx.match[1];

  try {
    const trend = db.prepare('SELECT * FROM trends WHERE id = ?').get(trendId);

    if (!trend) {
      return ctx.answerCbQuery('Trend not found');
    }

    await ctx.answerCbQuery('Generating mockup...');

    const data = JSON.parse(trend.data);
    const statusMsg = await ctx.reply('🎨 <b>Generating Design Mockup...</b>\n\n⏳ Researching real data from X...', { parse_mode: 'HTML' });

    // Progress callback
    const updateStatus = async (msg) => {
      try {
        await ctx.telegram.editMessageText(
          ctx.chat.id,
          statusMsg.message_id,
          undefined,
          `🎨 <b>Generating Design Mockup...</b>\n\n${msg}`,
          { parse_mode: 'HTML' }
        );
      } catch (e) {}
    };

    // Research real designs from X API first
    await updateStatus('🔍 Fetching real t-shirt designs from X...');
    const research = await designGenerator.researchRealDesigns(data.niche, updateStatus);

    // Generate design brief based on real data
    await updateStatus(`📊 Analyzed ${research.tweetImages?.length || 0} real designs\n🎨 Creating design concept...`);

    const brief = await designGenerator.generateBrief({
      ...data,
      researchData: research // Include real data
    });

    // Try to generate actual mockup image
    await updateStatus('🖼️ Generating design image...');
    let artwork = null;
    try {
      artwork = await designGenerator.generateArtwork(brief, updateStatus);
    } catch (imgError) {
      console.log('Image generation failed:', imgError.message);
      await updateStatus(`⚠️ Image generation unavailable: ${imgError.message}`);
    }

    if (artwork?.url) {
      // Generate mockup using BALLN-style PIL compositing
      await updateStatus('🖼️ Compositing onto t-shirt template...');

      let mockupUrl = artwork.url; // fallback to raw design
      let mockupStatus = 'design_only';

      try {
        const mockup = await generateMockup({
          designUrl: artwork.url,
          outputName: `mockup_${Date.now()}`,
          settings: {
            width: 0.35,
            yOffset: 340,
            bgMode: 'black',
            threshold: 35
          }
        });

        if (mockup?.url) {
          mockupUrl = mockup.url;
          mockupStatus = mockup.status;
          await updateStatus('✅ Mockup generated!');
        }
      } catch (mockupError) {
        console.log('Mockup generation failed, using raw design:', mockupError.message);
        await updateStatus(`⚠️ Using raw design (mockup failed: ${mockupError.message})`);
      }

      // Send the mockup image
      await ctx.replyWithPhoto(mockupUrl, {
        caption: `🎨 <b>${brief.title}</b>\n\n` +
          `<b>Text:</b> ${brief.textContent || 'No text'}\n` +
          `<b>Style:</b> ${brief.designType}\n` +
          `<b>Colors:</b> ${brief.colorPalette?.primary} / ${brief.colorPalette?.secondary}\n\n` +
          `<b>Based on:</b> ${research.tweetImages?.length || 0} real X designs analyzed\n` +
          `<b>Top engagement found:</b> ${research.tweetImages?.[0]?.engagement || 0} interactions\n` +
          `<b>Mockup:</b> ${mockupStatus}`,
        parse_mode: 'HTML',
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Approve & Create', `approve_design:${trendId}`),
            Markup.button.callback('🔄 Regenerate', `regenerate:${trendId}`)
          ],
          [
            Markup.button.callback('💬 Give Feedback', `feedback:${trendId}`),
            Markup.button.callback('❌ Reject', `reject:${trendId}`)
          ]
        ])
      });

      // Delete status message
      await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);

      // Store design for tracking
      const designId = `design_${Date.now()}`;
      db.prepare(`
        INSERT INTO designs (id, niche, concept_name, tagline, style, dalle_prompt, image_url, mockup_url, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'previewed', datetime('now'))
      `).run(designId, data.niche, brief.title, brief.textContent, brief.designType, brief.imagePrompt, artwork.url, mockupUrl);

      // Track preview metric
      db.prepare(`UPDATE designs SET previews = previews + 1 WHERE id = ?`).run(designId);

    } else {
      // Fallback: Show text-based preview when image generation fails
      await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);

      let preview = `🎨 <b>DESIGN CONCEPT: ${brief.title}</b>\n\n`;
      preview += `<b>📝 Text/Tagline:</b> ${brief.textContent || 'Visual design'}\n`;
      preview += `<b>🎯 Style:</b> ${brief.designType}\n`;
      preview += `<b>🎨 Colors:</b> ${brief.colorPalette?.primary || 'TBD'} / ${brief.colorPalette?.secondary || 'TBD'}\n`;
      preview += `<b>📍 Placement:</b> ${brief.placement || 'Front'}\n\n`;
      preview += `<b>💡 Design Description:</b>\n${brief.visualDescription || brief.imagePrompt}\n\n`;
      preview += `<b>📊 Based on:</b> ${research.tweetImages?.length || 0} real X designs analyzed\n\n`;
      preview += `<i>⚠️ Image generation unavailable - approve to create product with manual design upload</i>`;

      await ctx.replyWithHTML(preview, {
        ...Markup.inlineKeyboard([
          [
            Markup.button.callback('✅ Approve Concept', `approve_design:${trendId}`),
            Markup.button.callback('🔄 Try Again', `preview:${trendId}`)
          ],
          [
            Markup.button.callback('💬 Give Feedback', `feedback:${trendId}`),
            Markup.button.callback('❌ Reject', `reject:${trendId}`)
          ]
        ])
      });

      // Store design concept for tracking
      const designId = `design_${Date.now()}`;
      db.prepare(`
        INSERT INTO designs (id, niche, concept_name, tagline, style, dalle_prompt, status, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 'concept_only', datetime('now'))
      `).run(designId, data.niche, brief.title, brief.textContent, brief.designType, brief.imagePrompt);
    }
  } catch (error) {
    console.error('Preview error:', error);
    await ctx.reply(`❌ Error generating preview: ${error.message}`);
  }
});

bot.action(/defer:(.+)/, async (ctx) => {
  const id = ctx.match[1];

  try {
    db.prepare(`UPDATE trends SET status = 'deferred' WHERE id = ?`).run(id);
    await ctx.answerCbQuery('Saved for later');
    await ctx.editMessageText(
      ctx.callbackQuery.message.text + '\n\n⏰ <b>DEFERRED</b>',
      { parse_mode: 'HTML' }
    );
  } catch (error) {
    await ctx.answerCbQuery(`Error: ${error.message}`);
  }
});

// Approve design and create Shopify product
bot.action(/approve_design:(.+)/, async (ctx) => {
  const trendId = ctx.match[1];

  try {
    await ctx.answerCbQuery('Creating Shopify product...');

    const trend = db.prepare('SELECT * FROM trends WHERE id = ?').get(trendId);
    if (!trend) {
      return ctx.reply('❌ Trend not found');
    }

    const data = JSON.parse(trend.data);
    const statusMsg = await ctx.reply('📦 <b>Creating Shopify Product...</b>\n\n⏳ Please wait...', { parse_mode: 'HTML' });

    // Get the most recent design for this trend
    const design = db.prepare(`
      SELECT * FROM designs
      WHERE niche = ?
      ORDER BY created_at DESC LIMIT 1
    `).get(data.niche);

    if (!design) {
      return ctx.reply('❌ No design found. Generate a preview first.');
    }

    // Create Shopify product
    const product = await shopifyManager.createProduct({
      title: design.concept_name,
      description: `${design.tagline}\n\nStyle: ${design.style}`,
      imageUrl: design.image_url,
      niche: design.niche,
      tags: [design.niche, design.style, 'tresr-bot'].filter(Boolean)
    });

    // Update design status
    db.prepare(`UPDATE designs SET status = 'approved', approvals = approvals + 1 WHERE id = ?`).run(design.id);
    db.prepare(`UPDATE trends SET status = 'converted', product_id = ? WHERE id = ?`).run(product.id, trendId);

    // Track feedback for learning
    db.prepare(`
      INSERT INTO design_feedback (design_id, niche, feedback, design_data, created_at)
      VALUES (?, ?, 'approved', ?, datetime('now'))
    `).run(design.id, design.niche, JSON.stringify({ trendId, productId: product.id }));

    // Update self-improving prompt system
    designGenerator.updatePromptGuidance(design.style, {
      style: design.style,
      prompt: design.dalle_prompt
    }, true); // true = approved

    await ctx.telegram.editMessageText(
      ctx.chat.id,
      statusMsg.message_id,
      undefined,
      `✅ <b>Product Created!</b>\n\n` +
      `<b>Title:</b> ${product.title}\n` +
      `<b>ID:</b> ${product.id}\n` +
      `<b>Status:</b> ${product.status}\n\n` +
      `<a href="${product.url}">View in Shopify</a>`,
      { parse_mode: 'HTML', disable_web_page_preview: true }
    );

  } catch (error) {
    console.error('Approve error:', error);
    await ctx.reply(`❌ Error creating product: ${error.message}`);
  }
});

// Regenerate design with feedback
bot.action(/regenerate:(.+)/, async (ctx) => {
  const trendId = ctx.match[1];

  await ctx.answerCbQuery('Enter your feedback...');
  await ctx.reply(
    '💬 <b>What should I change?</b>\n\n' +
    'Reply to this message with your feedback and I\'ll regenerate the design.\n\n' +
    '<i>Examples:</i>\n' +
    '• "Make it more minimalist"\n' +
    '• "Use bolder typography"\n' +
    '• "Different color scheme - try black and gold"\n' +
    '• "More funny, less serious"',
    {
      parse_mode: 'HTML',
      reply_markup: {
        force_reply: true,
        selective: true,
        input_field_placeholder: 'Type your feedback...'
      }
    }
  );

  // Store pending feedback request
  db.prepare(`
    INSERT OR REPLACE INTO pending_approvals (id, type, title, data, status, created_at)
    VALUES (?, 'regenerate', 'Regenerate Design', ?, 'awaiting_feedback', datetime('now'))
  `).run(`regen_${trendId}`, JSON.stringify({ trendId }));
});

// Handle feedback replies and custom text descriptions
bot.on('text', async (ctx, next) => {
  // First, check if this is a custom design description
  const handledCustom = await handleCustomTextDescription(ctx);
  if (handledCustom) return;

  // Check if we're waiting for design feedback
  if (ctx.session?.awaitingFeedback) {
    const handled = await handleTextFeedback(ctx);
    if (handled) return;
  }

  // Check if we're waiting for Shopify edits
  if (ctx.session?.awaitingEdit) {
    const handled = await handleEditInput(ctx);
    if (handled) return;
  }

  // Check if this is a reply to our feedback request
  if (ctx.message.reply_to_message?.text?.includes('What should I change?')) {
    const feedback = ctx.message.text;

    // Find the pending regeneration
    const pending = db.prepare(`
      SELECT * FROM pending_approvals
      WHERE type = 'regenerate' AND status = 'awaiting_feedback'
      ORDER BY created_at DESC LIMIT 1
    `).get();

    if (!pending) {
      return next();
    }

    const data = JSON.parse(pending.data);
    const trendId = data.trendId;

    const trend = db.prepare('SELECT * FROM trends WHERE id = ?').get(trendId);
    if (!trend) {
      return ctx.reply('❌ Original trend not found');
    }

    const trendData = JSON.parse(trend.data);

    const statusMsg = await ctx.reply('🔄 <b>Regenerating with your feedback...</b>\n\n⏳ Please wait...', { parse_mode: 'HTML' });

    try {
      // Get the design that needs regeneration
      const oldDesign = db.prepare(`
        SELECT * FROM designs WHERE niche = ? ORDER BY created_at DESC LIMIT 1
      `).get(trendData.niche);

      // Track regeneration for learning
      if (oldDesign) {
        db.prepare(`UPDATE designs SET regenerations = regenerations + 1 WHERE id = ?`).run(oldDesign.id);
        db.prepare(`
          INSERT INTO design_feedback (design_id, niche, feedback, design_data, created_at)
          VALUES (?, ?, 'regenerate', ?, datetime('now'))
        `).run(oldDesign.id, oldDesign.niche, JSON.stringify({ feedback, originalPrompt: oldDesign.dalle_prompt }));
      }

      // Generate new brief incorporating feedback
      const improvedBrief = await designGenerator.generateBrief({
        ...trendData,
        userFeedback: feedback,
        previousAttempt: oldDesign?.concept_name
      });

      // Generate new artwork
      const artwork = await designGenerator.generateArtwork(improvedBrief);

      if (artwork.url) {
        // Store new design
        const newDesignId = `design_${Date.now()}`;
        db.prepare(`
          INSERT INTO designs (id, niche, concept_name, tagline, style, dalle_prompt, image_url, status, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'previewed', datetime('now'))
        `).run(newDesignId, trendData.niche, improvedBrief.title, improvedBrief.textContent, improvedBrief.designType, improvedBrief.imagePrompt, artwork.url);

        await ctx.telegram.deleteMessage(ctx.chat.id, statusMsg.message_id);

        await ctx.replyWithPhoto(artwork.url, {
          caption: `🔄 <b>Regenerated: ${improvedBrief.title}</b>\n\n` +
            `<b>Your feedback:</b> "${feedback}"\n\n` +
            `<b>Text:</b> ${improvedBrief.textContent || 'No text'}\n` +
            `<b>Style:</b> ${improvedBrief.designType}`,
          parse_mode: 'HTML',
          ...Markup.inlineKeyboard([
            [
              Markup.button.callback('✅ Approve & Create', `approve_design:${trendId}`),
              Markup.button.callback('🔄 Regenerate Again', `regenerate:${trendId}`)
            ],
            [
              Markup.button.callback('❌ Reject', `reject:${trendId}`)
            ]
          ])
        });
      }

      // Clear pending
      db.prepare(`DELETE FROM pending_approvals WHERE id = ?`).run(pending.id);

    } catch (error) {
      console.error('Regenerate error:', error);
      await ctx.reply(`❌ Error regenerating: ${error.message}`);
    }

    return; // Don't process as regular text
  }

  return next();
});

// Feedback button (for structured feedback without regeneration)
bot.action(/feedback:(.+)/, async (ctx) => {
  const trendId = ctx.match[1];

  await ctx.answerCbQuery('Recording feedback...');
  await ctx.reply(
    '📝 <b>Quick Feedback</b>\n\n' +
    'What did you think of this design?',
    {
      parse_mode: 'HTML',
      ...Markup.inlineKeyboard([
        [
          Markup.button.callback('👍 Good concept', `fb_good:${trendId}`),
          Markup.button.callback('👎 Bad concept', `fb_bad:${trendId}`)
        ],
        [
          Markup.button.callback('🎨 Style issue', `fb_style:${trendId}`),
          Markup.button.callback('✏️ Text issue', `fb_text:${trendId}`)
        ],
        [
          Markup.button.callback('🎯 Wrong audience', `fb_audience:${trendId}`),
          Markup.button.callback('💰 Won\'t sell', `fb_nosell:${trendId}`)
        ]
      ])
    }
  );
});

// Quick feedback handlers
bot.action(/fb_(.+):(.+)/, async (ctx) => {
  const feedbackType = ctx.match[1];
  const trendId = ctx.match[2];

  const feedbackMap = {
    good: 'positive_concept',
    bad: 'negative_concept',
    style: 'style_issue',
    text: 'text_issue',
    audience: 'wrong_audience',
    nosell: 'low_commercial_potential'
  };

  const design = db.prepare(`SELECT * FROM designs ORDER BY created_at DESC LIMIT 1`).get();

  if (design) {
    db.prepare(`
      INSERT INTO design_feedback (design_id, niche, feedback, design_data, created_at)
      VALUES (?, ?, ?, ?, datetime('now'))
    `).run(design.id, design.niche, feedbackMap[feedbackType], JSON.stringify({ trendId, quickFeedback: true }));
  }

  await ctx.answerCbQuery('Feedback recorded! This helps improve future designs.');
  await ctx.editMessageText('✅ Feedback recorded. Thank you!');
});

bot.action(/create_product:(.+)/, async (ctx) => {
  const trendId = ctx.match[1];

  try {
    await ctx.answerCbQuery('Creating product...');

    const trend = db.prepare('SELECT * FROM trends WHERE id = ?').get(trendId);

    if (!trend) {
      return ctx.reply('Trend not found');
    }

    // Generate design
    await ctx.reply('🎨 Generating design...');
    const design = await designGenerator.generateDesign(JSON.parse(trend.data));

    // Create Shopify product
    await ctx.reply('📦 Creating Shopify product...');
    const product = await shopifyManager.createProduct(design);

    // Update trend status
    db.prepare(`UPDATE trends SET status = 'converted', product_id = ? WHERE id = ?`).run(product.id, trendId);

    await ctx.reply(`✅ Product created!\n\n<b>${product.title}</b>\n${product.url}`, { parse_mode: 'HTML' });
  } catch (error) {
    await ctx.reply(`❌ Error creating product: ${error.message}`);
  }
});

bot.action('scan_trends', async (ctx) => {
  await ctx.answerCbQuery('Scanning...');
  // Trigger the trends command
  ctx.message = { text: '/trends' };
  await bot.handleUpdate({ message: ctx.message, ...ctx.update });
});

bot.action('send_all_artwork', async (ctx) => {
  await ctx.answerCbQuery('Sending all pending artwork...');

  try {
    const result = await fulfillmentManager.sendAllPendingArtwork();
    await ctx.reply(`✅ Artwork sent for ${result.count} order(s)`);
  } catch (error) {
    await ctx.reply(`❌ Error: ${error.message}`);
  }
});

bot.action('refresh_status', async (ctx) => {
  await ctx.answerCbQuery('Refreshing...');
  const status = await getSystemStatus();
  await ctx.editMessageText(formatStatus(status), {
    parse_mode: 'HTML',
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('🔄 Refresh', 'refresh_status'),
        Markup.button.callback('📊 Full Report', 'full_report')
      ],
      [
        Markup.button.callback('🎯 Scan Trends', 'scan_trends'),
        Markup.button.callback('📦 View Orders', 'view_orders')
      ]
    ])
  });
});

// ===================
// HELPER FUNCTIONS
// ===================

async function getSystemStatus() {
  const automationStatus = db.prepare(`SELECT value FROM system_state WHERE key = 'automation_status'`).get();

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const trends = db.prepare(`SELECT COUNT(*) as count FROM trends WHERE created_at >= ?`).get(todayStart.toISOString());
  const products = db.prepare(`SELECT COUNT(*) as count FROM products WHERE created_at >= ?`).get(todayStart.toISOString());
  const orders = await shopifyManager.getOrdersCount('today');
  const pending = db.prepare(`SELECT COUNT(*) as count FROM pending_approvals WHERE status = 'pending'`).get();

  return {
    running: automationStatus?.value !== 'paused',
    trendsToday: trends?.count || 0,
    productsToday: products?.count || 0,
    ordersToday: orders,
    pendingApprovals: pending?.count || 0,
    lastScan: db.prepare(`SELECT value FROM system_state WHERE key = 'last_trend_scan'`).get()?.value || 'Never'
  };
}

async function sendTrendOpportunity(ctx, trend) {
  // Store in database
  const id = `trend_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

  db.prepare(`
    INSERT INTO trends (id, niche, concept, score, data, status, created_at)
    VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
  `).run(id, trend.niche, trend.concept, trend.score, JSON.stringify(trend));

  const message = formatTrendOpportunity(trend);

  await ctx.replyWithHTML(message, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Create Product', `create_product:${id}`),
        Markup.button.callback('👀 Preview', `preview:${id}`)
      ],
      [
        Markup.button.callback('❌ Skip', `reject:${id}`),
        Markup.button.callback('⏰ Later', `defer:${id}`)
      ]
    ])
  });
}

async function sendApprovalRequest(ctx, item) {
  const data = JSON.parse(item.data || '{}');

  let message = `📌 <b>${item.type.toUpperCase()}</b>\n\n`;
  message += `<b>${item.title}</b>\n`;
  message += item.description + '\n';

  if (data.details) {
    message += '\n<b>Details:</b>\n';
    for (const [key, value] of Object.entries(data.details)) {
      message += `• ${key}: ${value}\n`;
    }
  }

  await ctx.replyWithHTML(message, {
    ...Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Approve', `approve:${item.id}`),
        Markup.button.callback('❌ Reject', `reject:${item.id}`)
      ]
    ])
  });
}

async function executeApproval(item) {
  const data = JSON.parse(item.data || '{}');

  switch (item.type) {
    case 'product':
      await shopifyManager.createProduct(data);
      break;
    case 'artwork':
      await fulfillmentManager.sendArtwork(data.orderId);
      break;
    default:
      console.log(`Unknown approval type: ${item.type}`);
  }
}

// ===================
// SCHEDULED JOBS
// ===================

function setupScheduledJobs() {
  // Check if automations are paused
  const isPaused = () => {
    const status = db.prepare(`SELECT value FROM system_state WHERE key = 'automation_status'`).get();
    return status?.value === 'paused';
  };

  // Trend scan - 6am and 2pm
  cron.schedule('0 6,14 * * *', async () => {
    if (isPaused()) return;

    console.log('Running scheduled trend scan...');
    try {
      const opportunities = await trendDetector.scan();

      if (opportunities.length > 0) {
        await bot.telegram.sendMessage(
          process.env.TELEGRAM_CHAT_ID,
          `🎯 <b>TREND SCAN COMPLETE</b>\n\nFound ${opportunities.length} opportunities.`,
          { parse_mode: 'HTML' }
        );

        for (const opp of opportunities.slice(0, 3)) {
          await sendTrendOpportunity({ replyWithHTML: (msg, opts) =>
            bot.telegram.sendMessage(process.env.TELEGRAM_CHAT_ID, msg, { parse_mode: 'HTML', ...opts })
          }, opp);
        }
      }

      db.prepare(`UPDATE system_state SET value = datetime('now') WHERE key = 'last_trend_scan'`).run();
    } catch (error) {
      console.error('Trend scan error:', error);
      await bot.telegram.sendMessage(
        process.env.TELEGRAM_CHAT_ID,
        `❌ Trend scan failed: ${error.message}`
      );
    }
  }, { timezone: 'America/Chicago' });

  // Order check - every 2 hours during business hours
  cron.schedule('0 8-20/2 * * *', async () => {
    if (isPaused()) return;

    console.log('Checking for new orders...');
    try {
      const newOrders = await shopifyManager.getNewOrders();

      if (newOrders.length > 0) {
        await bot.telegram.sendMessage(
          process.env.TELEGRAM_CHAT_ID,
          `📦 <b>${newOrders.length} NEW ORDER(S)</b>\n\n` +
          newOrders.map(o => `• #${o.orderNumber} - $${o.total}`).join('\n'),
          {
            parse_mode: 'HTML',
            ...Markup.inlineKeyboard([
              [Markup.button.callback('📤 Send All Artwork', 'send_all_artwork')]
            ])
          }
        );
      }
    } catch (error) {
      console.error('Order check error:', error);
    }
  }, { timezone: 'America/Chicago' });

  // Daily report - 9pm
  cron.schedule('0 21 * * *', async () => {
    console.log('Generating daily report...');
    try {
      const report = await generateDailyReport();
      await bot.telegram.sendMessage(
        process.env.TELEGRAM_CHAT_ID,
        formatDailyReport(report),
        { parse_mode: 'HTML' }
      );
    } catch (error) {
      console.error('Daily report error:', error);
    }
  }, { timezone: 'America/Chicago' });

  console.log('Scheduled jobs configured');
}

async function generateDailyReport() {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  return {
    date: new Date().toLocaleDateString(),
    trends: {
      scanned: db.prepare(`SELECT COUNT(*) as count FROM trends WHERE created_at >= ?`).get(todayStart.toISOString())?.count || 0,
      converted: db.prepare(`SELECT COUNT(*) as count FROM trends WHERE status = 'converted' AND created_at >= ?`).get(todayStart.toISOString())?.count || 0
    },
    products: {
      created: db.prepare(`SELECT COUNT(*) as count FROM products WHERE created_at >= ?`).get(todayStart.toISOString())?.count || 0
    },
    orders: await shopifyManager.getDailyOrderStats(),
    fulfillment: {
      artworkSent: db.prepare(`SELECT COUNT(*) as count FROM fulfillment_log WHERE created_at >= ?`).get(todayStart.toISOString())?.count || 0
    }
  };
}

// ===================
// HEALTH CHECK ENDPOINT
// ===================

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    bot: 'running',
    timestamp: new Date().toISOString()
  });
});

app.get('/', (req, res) => {
  res.send('TRESR Bot is running');
});

// ===================
// STARTUP
// ===================

async function start() {
  console.log('Starting TRESR Bot...');

  // Initialize database
  initDatabase();

  // Initialize modules
  trendDetector = new TrendDetector();
  designGenerator = new DesignGenerator();
  shopifyManager = new ShopifyManager();
  fulfillmentManager = new FulfillmentManager();

  // Setup scheduled jobs
  setupScheduledJobs();

  // Start Express server
  const port = process.env.PORT || 3000;
  app.listen(port, () => {
    console.log(`Health check server running on port ${port}`);
  });

  // Start bot (don't await - launch() resolves when bot stops, not starts)
  bot.launch().catch(err => console.error('Bot launch error:', err));
  console.log('Bot started');

  // Send startup notification
  await bot.telegram.sendMessage(
    process.env.TELEGRAM_CHAT_ID,
    '🟢 <b>TRESR Bot Started</b>\n\nAutomation system is now online.\nUse /status to check system state.',
    { parse_mode: 'HTML' }
  );
}

// Graceful shutdown
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));

start().catch(console.error);

export { bot };
