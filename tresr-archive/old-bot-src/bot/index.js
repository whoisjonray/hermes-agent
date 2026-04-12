/**
 * TRESR Telegram Bot
 * Main entry point that wires all commands and handlers
 *
 * Full automation flow:
 * 1. /trends → Concept selection
 * 2. Design generation → Approval with text/voice feedback
 * 3. Background selection
 * 4. Shopify product creation
 * 5. Facebook ad creation
 * 6. Self-correcting ad optimization (runs every 12 hours)
 */

import 'dotenv/config';
import { Telegraf, session } from 'telegraf';
import cron from 'node-cron';

// Commands
import {
  handleTrendsCommand,
  handleTrendsCallback,
  handleConceptSelect,
  handleCustomTextDescription,
  handleCustomVoiceDescription,
  handleShowAnother,
  handleConceptReject
} from './commands/trends.js';

import {
  handleDesignGeneration,
  handleDesignApprove,
  handleDesignReject,
  handleDesignRemix,
  handleFeedbackRequest,
  handleTextFeedback,
  handleVoiceFeedback
} from './commands/design.js';

import {
  handleBackgroundSelection,
  handleBackgroundSelect,
  handleBackgroundRegenerate
} from './commands/backgrounds.js';

import {
  handleShopifyCreate,
  handleShopifyPublish,
  handleEditTitle,
  handleEditDescription,
  handleEditInput
} from './commands/shopify.js';

import {
  handleAdsCreate,
  handleAdsLaunch,
  handleAdsActivate,
  handleAdsCommand
} from './commands/ads.js';

// Services
import {
  runOptimizationCheck,
  getDailySummary,
  getWeeklyReport,
  formatOptimizationResults,
  formatDailySummary,
  scaleCampaign
} from '../services/adOptimizer.js';

import {
  runWeeklyAnalysis,
  formatWeeklyAnalysis
} from '../services/lifecycleManager.js';

import {
  getCategoryResearch,
  getDesignTextSuggestions,
  RESEARCH_SOURCES
} from '../services/customerResearch.js';

// Email service imports JSX which requires transpilation - lazy load when needed
let emailService = null;
async function getEmailService() {
  if (!emailService) {
    try {
      emailService = await import('../services/emailService.js');
    } catch (e) {
      console.log('Email service not available (JSX needs transpilation)');
      return null;
    }
  }
  return emailService;
}
const initEmailSchedulerDb = async () => (await getEmailService())?.initEmailSchedulerDb?.();
const processScheduledEmails = async () => {
  const service = await getEmailService();
  if (!service) return { processed: 0, sent: 0, failed: 0 };
  return service.processScheduledEmails();
};
const cleanupOldScheduledEmails = async () => (await getEmailService())?.cleanupOldScheduledEmails?.() ?? 0;

import { initDatabase } from '../services/database.js';

// Initialize bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN);

// Session middleware for state management
bot.use(session());

// ============================================
// COMMANDS
// ============================================

// /start - Welcome message
bot.command('start', async (ctx) => {
  await ctx.reply(
    `👕 <b>TRESR POD Automation</b>\n\n` +
    `Welcome to the self-improving print-on-demand system.\n\n` +
    `<b>Commands:</b>\n` +
    `/trends - Find trending opportunities\n` +
    `/research - View customer research for a category\n` +
    `/products - View your products\n` +
    `/ads - Check ad performance\n` +
    `/report - Daily/weekly performance report\n` +
    `/help - Show all commands\n\n` +
    `<b>Start with /trends to create your first product!</b>`,
    { parse_mode: 'HTML' }
  );
});

// /help - Command list
bot.command('help', async (ctx) => {
  await ctx.reply(
    `📖 <b>TRESR BOT COMMANDS</b>\n\n` +
    `<b>Product Creation:</b>\n` +
    `/trends - Find trending opportunities\n` +
    `/research [category] - View customer research\n\n` +
    `<b>Product Management:</b>\n` +
    `/products - View all products\n` +
    `/scale [campaign_id] - Scale a winner\n` +
    `/cut [campaign_id] - Pause a loser\n\n` +
    `<b>Performance:</b>\n` +
    `/ads - Ad performance overview\n` +
    `/report - Daily summary\n` +
    `/weekly - Weekly aggregate report\n\n` +
    `<b>The system automatically:</b>\n` +
    `• Pauses ads with ROAS < 1.0 after $25 spend\n` +
    `• Notifies you to scale ads with ROAS > 2.5\n` +
    `• Sends daily performance summaries at 6pm`,
    { parse_mode: 'HTML' }
  );
});

// /trends - Start the product creation flow
bot.command('trends', handleTrendsCommand);

// /research - View customer research
bot.command('research', async (ctx) => {
  const args = ctx.message.text.split(' ');
  const category = args[1] || 'coffee';

  const research = getCategoryResearch(category);

  if (!research) {
    await ctx.reply(`No research found for category: ${category}`);
    return;
  }

  const confessionSample = research.confessions.slice(0, 3);
  const languageSample = research.languageBank.slice(0, 5);

  await ctx.reply(
    `📊 <b>CUSTOMER RESEARCH: ${category.toUpperCase()}</b>\n\n` +
    `<b>Sample Confessions (what they actually say):</b>\n` +
    confessionSample.map(c =>
      `• "${c.content}"\n  <i>${c.engagement.upvotes || c.engagement.likes}+ engagement</i>`
    ).join('\n\n') +
    `\n\n<b>Language Bank:</b>\n` +
    languageSample.map(p => `• ${p}`).join('\n') +
    `\n\n<b>Root Causes:</b>\n` +
    research.rootCauses.slice(0, 2).map(rc =>
      `• Surface: "${rc.surface}"\n  Root: "${rc.root}"`
    ).join('\n\n') +
    `\n\n<i>This research drives all designs and ad copy for this category.</i>`,
    { parse_mode: 'HTML' }
  );
});

// /ads - Ad performance
bot.command('ads', handleAdsCommand);

// /report - Daily summary
bot.command('report', async (ctx) => {
  await ctx.reply('📊 Generating daily report...');

  try {
    const summary = await getDailySummary();
    await ctx.reply(formatDailySummary(summary), { parse_mode: 'HTML' });
  } catch (error) {
    await ctx.reply(`❌ Could not generate report: ${error.message}`);
  }
});

// /weekly - Weekly report
bot.command('weekly', async (ctx) => {
  await ctx.reply('📊 Generating weekly report...');

  try {
    const report = await getWeeklyReport();

    let message = `📈 <b>WEEKLY PERFORMANCE REPORT</b>\n`;
    message += `<i>${report.period}</i>\n\n`;
    message += `<b>Totals:</b>\n`;
    message += `• Spend: $${report.totalSpend.toFixed(2)}\n`;
    message += `• Revenue: $${report.totalRevenue.toFixed(2)}\n`;
    message += `• ROAS: ${report.overallROAS}x\n\n`;

    if (Object.keys(report.categoryBreakdown).length > 0) {
      message += `<b>By Category:</b>\n`;
      for (const [cat, stats] of Object.entries(report.categoryBreakdown)) {
        message += `\n<b>${cat}</b>\n`;
        message += `• Campaigns: ${stats.campaigns}\n`;
        message += `• ROAS: ${stats.roas}x\n`;
        message += `• Win Rate: ${stats.winRate}\n`;
      }
    }

    if (report.insights.length > 0) {
      message += `\n<b>Insights:</b>\n`;
      for (const insight of report.insights) {
        const icon = insight.type === 'opportunity' ? '💡' : '⚠️';
        message += `${icon} ${insight.message}\n`;
      }
    }

    await ctx.reply(message, { parse_mode: 'HTML' });
  } catch (error) {
    await ctx.reply(`❌ Could not generate weekly report: ${error.message}`);
  }
});

// /scale - Scale a campaign
bot.command('scale', async (ctx) => {
  const args = ctx.message.text.split(' ');
  const campaignId = args[1];
  const newBudget = parseInt(args[2]) || 50;

  if (!campaignId) {
    await ctx.reply('Usage: /scale <campaign_id> [new_daily_budget]');
    return;
  }

  try {
    await scaleCampaign(campaignId, newBudget);
    await ctx.reply(`✅ Campaign ${campaignId} scaled to $${newBudget}/day`);
  } catch (error) {
    await ctx.reply(`❌ Scale failed: ${error.message}`);
  }
});

// ============================================
// CALLBACK QUERIES (Button handlers)
// ============================================

bot.on('callback_query', async (ctx) => {
  const data = ctx.callbackQuery.data;

  try {
    // Category/trends selection
    if (data.startsWith('trends:')) {
      await handleTrendsCallback(ctx);
    }

    // Concept actions
    else if (data.startsWith('concept:select:')) {
      await handleConceptSelect(ctx);
    }
    else if (data.startsWith('concept:another:')) {
      await handleShowAnother(ctx);
    }
    else if (data.startsWith('concept:reject:')) {
      await handleConceptReject(ctx);
    }

    // Design actions
    else if (data.startsWith('design:approve:')) {
      await handleDesignApprove(ctx);
    }
    else if (data.startsWith('design:reject:')) {
      await handleDesignReject(ctx);
    }
    else if (data.startsWith('design:remix:')) {
      await handleDesignRemix(ctx);
    }
    else if (data.startsWith('design:feedback:')) {
      await handleFeedbackRequest(ctx);
    }

    // Background actions
    else if (data.startsWith('bg:select:')) {
      await handleBackgroundSelect(ctx);
    }
    else if (data.startsWith('bg:regenerate:')) {
      await handleBackgroundRegenerate(ctx);
    }
    else if (data.startsWith('bg:back:')) {
      const category = data.split(':')[2];
      await handleBackgroundSelection(ctx, category);
    }

    // Shopify actions
    else if (data === 'shopify:create') {
      await handleShopifyCreate(ctx);
    }
    else if (data === 'shopify:publish') {
      await handleShopifyPublish(ctx);
    }
    else if (data === 'shopify:edit:title') {
      await handleEditTitle(ctx);
    }
    else if (data === 'shopify:edit:description') {
      await handleEditDescription(ctx);
    }

    // Ads actions
    else if (data === 'ads:create') {
      await handleAdsCreate(ctx);
    }
    else if (data.startsWith('ads:launch:')) {
      await handleAdsLaunch(ctx);
    }
    else if (data.startsWith('ads:activate:')) {
      await handleAdsActivate(ctx);
    }
    else if (data.startsWith('ads:scale:')) {
      const parts = data.split(':');
      const campaignId = parts[2];
      const newBudget = parseInt(parts[3]) || 50;
      await scaleCampaign(campaignId, newBudget);
      await ctx.answerCbQuery(`Scaled to $${newBudget}/day`);
      await ctx.reply(`✅ Campaign scaled to $${newBudget}/day`);
    }

    // Flow control
    else if (data === 'flow:complete') {
      await ctx.answerCbQuery('Flow complete!');
      await ctx.reply(
        `✅ <b>PRODUCT CREATION COMPLETE!</b>\n\n` +
        `Your product is live and (optionally) advertising.\n\n` +
        `Use /trends to create another product, or /report to check performance.`,
        { parse_mode: 'HTML' }
      );
    }
    else if (data === 'flow:cancel') {
      await ctx.answerCbQuery('Flow cancelled');
      await ctx.reply('Flow cancelled. Use /trends to start over.');
      ctx.session = {};
    }

    else {
      await ctx.answerCbQuery('Unknown action');
    }
  } catch (error) {
    console.error('Callback error:', error);
    await ctx.answerCbQuery('Error processing action');
    await ctx.reply(`❌ Error: ${error.message}`);
  }
});

// ============================================
// MESSAGE HANDLERS
// ============================================

// Handle text messages (feedback, edits, custom descriptions)
bot.on('text', async (ctx) => {
  // Check if we're waiting for custom design description
  if (ctx.session?.awaitingCustomDescription) {
    const handled = await handleCustomTextDescription(ctx);
    if (handled) return;
  }

  // Check if we're waiting for Shopify edits
  if (ctx.session?.awaitingEdit) {
    const handled = await handleEditInput(ctx);
    if (handled) return;
  }

  // Check if we're waiting for design feedback
  if (ctx.session?.awaitingFeedback) {
    const handled = await handleTextFeedback(ctx);
    if (handled) return;
  }

  // Default: unknown message
  // Don't respond to every message - only commands and expected inputs
});

// Handle voice messages (design feedback, custom descriptions)
bot.on('voice', async (ctx) => {
  // Check if we're waiting for custom design description
  if (ctx.session?.awaitingCustomDescription) {
    await handleCustomVoiceDescription(ctx);
    return;
  }

  // Check if we're in design feedback mode
  if (ctx.session?.currentDesign || ctx.session?.awaitingFeedback) {
    await handleVoiceFeedback(ctx);
  } else {
    await ctx.reply(
      '🎤 Voice messages can be used for:\n' +
      '• Custom design descriptions (use /trends → Custom)\n' +
      '• Design feedback after generating a design\n\n' +
      'Start with /trends first.'
    );
  }
});

// ============================================
// SCHEDULED TASKS
// ============================================

// Run ad optimization every 12 hours
cron.schedule('0 */12 * * *', async () => {
  console.log('Running scheduled ad optimization...');

  try {
    const results = await runOptimizationCheck();
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (chatId) {
      await bot.telegram.sendMessage(
        chatId,
        formatOptimizationResults(results),
        { parse_mode: 'HTML' }
      );
    }
  } catch (error) {
    console.error('Scheduled optimization error:', error);
  }
});

// Send daily summary at 6pm
cron.schedule('0 18 * * *', async () => {
  console.log('Sending daily summary...');

  try {
    const summary = await getDailySummary();
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (chatId) {
      await bot.telegram.sendMessage(
        chatId,
        formatDailySummary(summary),
        { parse_mode: 'HTML' }
      );
    }
  } catch (error) {
    console.error('Daily summary error:', error);
  }
});

// Weekly lifecycle analysis (Sunday 9pm)
cron.schedule('0 21 * * 0', async () => {
  console.log('Running weekly lifecycle analysis...');

  try {
    const results = await runWeeklyAnalysis();
    const chatId = process.env.TELEGRAM_CHAT_ID;

    if (chatId) {
      await bot.telegram.sendMessage(
        chatId,
        formatWeeklyAnalysis(results),
        { parse_mode: 'HTML' }
      );
    }
  } catch (error) {
    console.error('Weekly analysis error:', error);
  }
});

// Process scheduled emails every minute
cron.schedule('* * * * *', async () => {
  try {
    const result = await processScheduledEmails();
    if (result.processed > 0) {
      console.log(`Email scheduler: processed ${result.processed}, sent ${result.sent}, failed ${result.failed}`);
    }
  } catch (error) {
    console.error('Email scheduler error:', error);
  }
});

// Clean up old scheduled emails daily at 3am
cron.schedule('0 3 * * *', async () => {
  console.log('Cleaning up old scheduled emails...');
  try {
    const cleaned = cleanupOldScheduledEmails();
    console.log(`Cleaned up ${cleaned} old scheduled emails`);
  } catch (error) {
    console.error('Email cleanup error:', error);
  }
});

// ============================================
// ERROR HANDLING
// ============================================

bot.catch((err, ctx) => {
  console.error('Bot error:', err);
  ctx.reply('An error occurred. Please try again.').catch(console.error);
});

// ============================================
// LAUNCH
// ============================================

export async function startBot() {
  console.log('Starting TRESR Bot...');

  // Initialize database
  initDatabase();

  // Initialize email scheduler database
  initEmailSchedulerDb();

  // Resume any pending scheduled emails on startup
  console.log('Checking for pending scheduled emails...');
  try {
    const result = await processScheduledEmails();
    if (result.processed > 0) {
      console.log(`Resumed ${result.processed} pending emails on startup (sent: ${result.sent}, failed: ${result.failed})`);
    }
  } catch (error) {
    console.error('Failed to resume scheduled emails:', error);
  }

  // Enable graceful stop
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));

  // Launch bot (this doesn't block in Telegraf v4)
  bot.launch({ dropPendingUpdates: true })
    .then(() => console.log('Bot polling stopped'))
    .catch(err => console.error('Bot error:', err.message));

  // Wait a moment for bot to connect, then confirm it's running
  await new Promise(resolve => setTimeout(resolve, 1000));

  // Verify bot is connected
  const me = await bot.telegram.getMe();
  console.log(`🤖 TRESR Bot @${me.username} is running!`);
  console.log('Commands: /start, /trends, /ads, /report, /weekly, /help');
  console.log('Email scheduler: active (checks every minute)');
}

export default bot;

// Auto-start when run directly (not when imported)
const isMainModule = import.meta.url === `file://${process.argv[1]}`;
if (isMainModule) {
  startBot().catch(err => {
    console.error('Bot startup failed:', err);
    process.exit(1);
  });
}
