/**
 * Self-Correcting Ad Optimizer
 * Runs every 12 hours to auto-cut losers and flag winners
 *
 * Rules:
 * - Auto-pause: spend > $25 AND ROAS < 1.0 (execute immediately)
 * - Notify to scale: spend > $25 AND ROAS > 2.5 (require approval)
 * - Continue testing: spend < $25 (keep running)
 */

import {
  getActiveCampaigns,
  getCampaignAdSets,
  getCampaignInsights,
  getAdSetInsights,
  updateStatus,
  parseROAS,
  parseSpend,
  parseRevenue,
  parsePurchases
} from './metaAdsService.js';

// Optimization thresholds
const THRESHOLDS = {
  MIN_SPEND_FOR_DECISION: 25, // $25 minimum spend before making decisions
  CUT_ROAS: 1.0,              // ROAS below this = auto-pause
  SCALE_ROAS: 2.5,            // ROAS above this = notify to scale
  CHECK_INTERVAL_HOURS: 12    // Run optimizer every 12 hours
};

// In-memory store for campaign metadata (in production, use database)
const campaignStore = new Map();

/**
 * Register a campaign for optimization tracking
 */
export function registerCampaign(campaignId, metadata) {
  campaignStore.set(campaignId, {
    ...metadata,
    createdAt: new Date().toISOString(),
    actions: [],
    status: 'testing'
  });
}

/**
 * Get campaign metadata
 */
export function getCampaignMetadata(campaignId) {
  return campaignStore.get(campaignId);
}

/**
 * Run optimization check on all active campaigns
 * Returns actions taken and recommendations
 */
export async function runOptimizationCheck() {
  const results = {
    timestamp: new Date().toISOString(),
    checked: 0,
    autoPaused: [],
    recommendScale: [],
    continuing: [],
    errors: []
  };

  try {
    // Get all TRESR campaigns (filter by naming convention)
    const campaigns = await getActiveCampaigns();
    const tresrCampaigns = campaigns.filter(c => c.name.startsWith('TRESR'));

    for (const campaign of tresrCampaigns) {
      results.checked++;

      try {
        const insights = await getCampaignInsights(campaign.id);
        const spend = parseSpend(insights);
        const roas = parseROAS(insights);
        const revenue = parseRevenue(insights);
        const purchases = parsePurchases(insights);

        const campaignData = {
          id: campaign.id,
          name: campaign.name,
          status: campaign.status,
          spend,
          revenue,
          purchases,
          roas: roas?.toFixed(2) || 'N/A'
        };

        // Decision logic
        if (spend < THRESHOLDS.MIN_SPEND_FOR_DECISION) {
          // Not enough data yet - continue testing
          results.continuing.push({
            ...campaignData,
            reason: `Spend $${spend.toFixed(2)} < $${THRESHOLDS.MIN_SPEND_FOR_DECISION} threshold`
          });
        } else if (roas === null) {
          // Has spend but no purchases/revenue data
          if (spend >= THRESHOLDS.MIN_SPEND_FOR_DECISION) {
            // No conversions after min spend = likely loser, pause it
            await updateStatus(campaign.id, 'PAUSED');
            results.autoPaused.push({
              ...campaignData,
              reason: 'No conversions after minimum spend',
              action: 'AUTO_PAUSED'
            });

            // Log action
            logCampaignAction(campaign.id, 'AUTO_PAUSED', 'No conversions after $25 spend');
          }
        } else if (roas < THRESHOLDS.CUT_ROAS) {
          // ROAS below threshold - auto pause
          await updateStatus(campaign.id, 'PAUSED');
          results.autoPaused.push({
            ...campaignData,
            reason: `ROAS ${roas.toFixed(2)} < ${THRESHOLDS.CUT_ROAS}`,
            action: 'AUTO_PAUSED'
          });

          logCampaignAction(campaign.id, 'AUTO_PAUSED', `ROAS ${roas.toFixed(2)} below threshold`);
        } else if (roas >= THRESHOLDS.SCALE_ROAS) {
          // Winner! Recommend scaling
          results.recommendScale.push({
            ...campaignData,
            reason: `ROAS ${roas.toFixed(2)} >= ${THRESHOLDS.SCALE_ROAS}`,
            recommendation: 'SCALE_UP',
            suggestedBudget: calculateScaleBudget(spend, roas)
          });

          logCampaignAction(campaign.id, 'SCALE_RECOMMENDED', `ROAS ${roas.toFixed(2)} - ready to scale`);
        } else {
          // ROAS between 1.0 and 2.5 - continue monitoring
          results.continuing.push({
            ...campaignData,
            reason: `ROAS ${roas.toFixed(2)} between thresholds, monitoring`
          });
        }
      } catch (error) {
        results.errors.push({
          campaignId: campaign.id,
          campaignName: campaign.name,
          error: error.message
        });
      }
    }
  } catch (error) {
    results.errors.push({
      phase: 'campaign_fetch',
      error: error.message
    });
  }

  return results;
}

/**
 * Calculate recommended scale budget based on current performance
 */
function calculateScaleBudget(currentSpend, roas) {
  // Conservative scaling: 2x budget for proven winners
  // More aggressive for higher ROAS
  if (roas >= 4.0) {
    return Math.round(currentSpend * 3); // 3x for exceptional performers
  } else if (roas >= 3.0) {
    return Math.round(currentSpend * 2.5); // 2.5x for strong performers
  } else {
    return Math.round(currentSpend * 2); // 2x for good performers
  }
}

/**
 * Log action taken on a campaign
 */
function logCampaignAction(campaignId, action, reason) {
  const metadata = campaignStore.get(campaignId);
  if (metadata) {
    metadata.actions.push({
      action,
      reason,
      timestamp: new Date().toISOString()
    });
    metadata.status = action === 'AUTO_PAUSED' ? 'cut' :
                      action === 'SCALE_RECOMMENDED' ? 'winner' : 'testing';
    campaignStore.set(campaignId, metadata);
  }
}

/**
 * Get daily performance summary
 */
export async function getDailySummary() {
  const campaigns = await getActiveCampaigns();
  const tresrCampaigns = campaigns.filter(c => c.name.startsWith('TRESR'));

  let totalSpend = 0;
  let totalRevenue = 0;
  let totalPurchases = 0;
  const campaignStats = [];

  for (const campaign of tresrCampaigns) {
    try {
      const insights = await getCampaignInsights(campaign.id, 'today');
      const spend = parseSpend(insights);
      const revenue = parseRevenue(insights);
      const purchases = parsePurchases(insights);
      const roas = parseROAS(insights);

      totalSpend += spend;
      totalRevenue += revenue;
      totalPurchases += purchases;

      if (spend > 0) {
        campaignStats.push({
          name: campaign.name,
          status: campaign.status,
          spend,
          revenue,
          purchases,
          roas: roas?.toFixed(2) || 'N/A'
        });
      }
    } catch (error) {
      console.error(`Error fetching stats for ${campaign.name}:`, error);
    }
  }

  return {
    date: new Date().toISOString().split('T')[0],
    totalSpend,
    totalRevenue,
    totalPurchases,
    overallROAS: totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : 'N/A',
    activeCampaigns: campaignStats.length,
    campaigns: campaignStats
  };
}

/**
 * Get weekly aggregate report
 */
export async function getWeeklyReport() {
  const campaigns = await getActiveCampaigns();
  const tresrCampaigns = campaigns.filter(c => c.name.startsWith('TRESR'));

  const categoryStats = {};
  let totalSpend = 0;
  let totalRevenue = 0;

  for (const campaign of tresrCampaigns) {
    try {
      const insights = await getCampaignInsights(campaign.id, 'last_7d');
      const spend = parseSpend(insights);
      const revenue = parseRevenue(insights);
      const roas = parseROAS(insights);

      // Extract category from campaign name (e.g., "TRESR - coffee - Title")
      const parts = campaign.name.split(' - ');
      const category = parts[1] || 'unknown';

      if (!categoryStats[category]) {
        categoryStats[category] = {
          campaigns: 0,
          spend: 0,
          revenue: 0,
          winners: 0,
          losers: 0
        };
      }

      categoryStats[category].campaigns++;
      categoryStats[category].spend += spend;
      categoryStats[category].revenue += revenue;

      if (roas !== null) {
        if (roas >= THRESHOLDS.SCALE_ROAS) categoryStats[category].winners++;
        if (roas < THRESHOLDS.CUT_ROAS) categoryStats[category].losers++;
      }

      totalSpend += spend;
      totalRevenue += revenue;
    } catch (error) {
      console.error(`Error in weekly report for ${campaign.name}:`, error);
    }
  }

  // Calculate ROAS per category
  for (const category of Object.keys(categoryStats)) {
    const stats = categoryStats[category];
    stats.roas = stats.spend > 0 ? (stats.revenue / stats.spend).toFixed(2) : 'N/A';
    stats.winRate = stats.campaigns > 0
      ? ((stats.winners / stats.campaigns) * 100).toFixed(1) + '%'
      : 'N/A';
  }

  return {
    period: 'last_7d',
    generatedAt: new Date().toISOString(),
    totalSpend,
    totalRevenue,
    overallROAS: totalSpend > 0 ? (totalRevenue / totalSpend).toFixed(2) : 'N/A',
    categoryBreakdown: categoryStats,
    insights: generateWeeklyInsights(categoryStats)
  };
}

/**
 * Generate actionable insights from weekly data
 */
function generateWeeklyInsights(categoryStats) {
  const insights = [];

  // Find best performing category
  let bestCategory = null;
  let bestROAS = 0;
  let worstCategory = null;
  let worstROAS = Infinity;

  for (const [category, stats] of Object.entries(categoryStats)) {
    const roas = parseFloat(stats.roas) || 0;
    if (roas > bestROAS && stats.spend > 10) {
      bestROAS = roas;
      bestCategory = category;
    }
    if (roas < worstROAS && stats.spend > 10) {
      worstROAS = roas;
      worstCategory = category;
    }
  }

  if (bestCategory && bestROAS >= THRESHOLDS.SCALE_ROAS) {
    insights.push({
      type: 'opportunity',
      message: `${bestCategory} is performing well (${bestROAS}x ROAS). Consider increasing design output for this category.`
    });
  }

  if (worstCategory && worstROAS < THRESHOLDS.CUT_ROAS) {
    insights.push({
      type: 'warning',
      message: `${worstCategory} is underperforming (${worstROAS}x ROAS). Review designs and targeting for this category.`
    });
  }

  return insights;
}

/**
 * Scale a winning campaign
 */
export async function scaleCampaign(campaignId, newDailyBudget) {
  // Get ad sets for the campaign
  const adSets = await getCampaignAdSets(campaignId);

  for (const adSet of adSets) {
    const url = `https://graph.facebook.com/v18.0/${adSet.id}`;
    await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        access_token: process.env.META_ACCESS_TOKEN,
        daily_budget: newDailyBudget * 100 // Convert to cents
      })
    });
  }

  logCampaignAction(campaignId, 'SCALED', `Budget increased to $${newDailyBudget}/day`);

  return { success: true, newDailyBudget };
}

/**
 * Format optimization results for Telegram notification
 */
export function formatOptimizationResults(results) {
  let message = `📊 <b>AD OPTIMIZATION REPORT</b>\n`;
  message += `<i>${new Date(results.timestamp).toLocaleString()}</i>\n\n`;

  message += `<b>Checked:</b> ${results.checked} campaigns\n\n`;

  if (results.autoPaused.length > 0) {
    message += `🛑 <b>AUTO-PAUSED (${results.autoPaused.length})</b>\n`;
    for (const camp of results.autoPaused) {
      message += `• ${camp.name}\n`;
      message += `  Spend: $${camp.spend.toFixed(2)} | ROAS: ${camp.roas}\n`;
      message += `  <i>${camp.reason}</i>\n`;
    }
    message += '\n';
  }

  if (results.recommendScale.length > 0) {
    message += `🚀 <b>WINNERS - READY TO SCALE (${results.recommendScale.length})</b>\n`;
    for (const camp of results.recommendScale) {
      message += `• ${camp.name}\n`;
      message += `  Spend: $${camp.spend.toFixed(2)} | Revenue: $${camp.revenue.toFixed(2)}\n`;
      message += `  ROAS: ${camp.roas} | Suggested budget: $${camp.suggestedBudget}/day\n`;
    }
    message += '\n';
  }

  if (results.continuing.length > 0) {
    message += `⏳ <b>STILL TESTING (${results.continuing.length})</b>\n`;
    for (const camp of results.continuing) {
      message += `• ${camp.name} - $${camp.spend.toFixed(2)} spent\n`;
    }
    message += '\n';
  }

  if (results.errors.length > 0) {
    message += `⚠️ <b>ERRORS (${results.errors.length})</b>\n`;
    for (const err of results.errors) {
      message += `• ${err.campaignName || err.phase}: ${err.error}\n`;
    }
  }

  return message;
}

/**
 * Format daily summary for Telegram
 */
export function formatDailySummary(summary) {
  let message = `📈 <b>DAILY PERFORMANCE</b>\n`;
  message += `<i>${summary.date}</i>\n\n`;

  message += `<b>Today's Totals:</b>\n`;
  message += `• Spend: $${summary.totalSpend.toFixed(2)}\n`;
  message += `• Revenue: $${summary.totalRevenue.toFixed(2)}\n`;
  message += `• Orders: ${summary.totalPurchases}\n`;
  message += `• ROAS: ${summary.overallROAS}x\n\n`;

  if (summary.campaigns.length > 0) {
    message += `<b>Active Campaigns:</b>\n`;
    for (const camp of summary.campaigns) {
      const status = camp.status === 'ACTIVE' ? '🟢' : '🟡';
      message += `${status} ${camp.name}\n`;
      message += `   $${camp.spend.toFixed(2)} → $${camp.revenue.toFixed(2)} (${camp.roas}x)\n`;
    }
  }

  return message;
}

export default {
  registerCampaign,
  getCampaignMetadata,
  runOptimizationCheck,
  getDailySummary,
  getWeeklyReport,
  scaleCampaign,
  formatOptimizationResults,
  formatDailySummary,
  THRESHOLDS
};
