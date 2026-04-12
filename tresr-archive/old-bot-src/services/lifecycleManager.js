/**
 * Product Lifecycle Management
 * Manages product status based on performance data
 *
 * Weekly analysis (Sunday 9pm):
 * - ROAS > 2.5 → Winner (scale, add to winners collection)
 * - ROAS 1.5-2.5 → Continue testing
 * - ROAS < 1.5 → Cut (pause ads, keep product live for organic)
 */

import {
  getCampaignInsights,
  getActiveCampaigns,
  updateStatus,
  parseROAS,
  parseSpend,
  parseRevenue
} from './metaAdsService.js';

// Lifecycle states
const LIFECYCLE_STATES = {
  TESTING: 'testing',           // Currently running $25 test
  WINNER: 'winner',             // ROAS > 2.5, scaled or ready to scale
  MARGINAL: 'marginal',         // ROAS 1.5-2.5, continue testing
  CUT: 'cut',                   // ROAS < 1.5, ads paused
  UNTESTED: 'untested',         // Product live, no ads run yet
  PAUSED: 'paused'              // Manually paused
};

// Thresholds
const THRESHOLDS = {
  WINNER_ROAS: 2.5,
  MARGINAL_ROAS: 1.5,
  MIN_SPEND_FOR_DECISION: 25,
  SCALE_CONFIRMATION_SPEND: 50
};

// In-memory product store (use database in production)
const productStore = new Map();

/**
 * Register a product for lifecycle tracking
 */
export function registerProduct(productId, metadata) {
  productStore.set(productId, {
    ...metadata,
    lifecycle: LIFECYCLE_STATES.TESTING,
    createdAt: new Date().toISOString(),
    decisions: [],
    metrics: {
      totalSpend: 0,
      totalRevenue: 0,
      avgROAS: null
    }
  });
}

/**
 * Get product lifecycle status
 */
export function getProductStatus(productId) {
  return productStore.get(productId);
}

/**
 * Update product lifecycle based on performance
 */
export function updateProductLifecycle(productId, metrics) {
  const product = productStore.get(productId);
  if (!product) return null;

  const { spend, revenue, roas } = metrics;

  // Update cumulative metrics
  product.metrics.totalSpend += spend;
  product.metrics.totalRevenue += revenue;
  product.metrics.avgROAS = product.metrics.totalSpend > 0
    ? product.metrics.totalRevenue / product.metrics.totalSpend
    : null;

  // Determine new lifecycle state
  if (product.metrics.totalSpend < THRESHOLDS.MIN_SPEND_FOR_DECISION) {
    product.lifecycle = LIFECYCLE_STATES.TESTING;
  } else if (roas >= THRESHOLDS.WINNER_ROAS) {
    product.lifecycle = LIFECYCLE_STATES.WINNER;
  } else if (roas >= THRESHOLDS.MARGINAL_ROAS) {
    product.lifecycle = LIFECYCLE_STATES.MARGINAL;
  } else {
    product.lifecycle = LIFECYCLE_STATES.CUT;
  }

  productStore.set(productId, product);
  return product;
}

/**
 * Run weekly lifecycle analysis
 * Called every Sunday at 9pm
 */
export async function runWeeklyAnalysis() {
  const results = {
    timestamp: new Date().toISOString(),
    analyzed: 0,
    winners: [],
    marginal: [],
    cut: [],
    untested: [],
    recommendations: []
  };

  try {
    const campaigns = await getActiveCampaigns();
    const tresrCampaigns = campaigns.filter(c => c.name.startsWith('TRESR'));

    for (const campaign of tresrCampaigns) {
      results.analyzed++;

      try {
        const insights = await getCampaignInsights(campaign.id, 'last_7d');
        const spend = parseSpend(insights);
        const revenue = parseRevenue(insights);
        const roas = parseROAS(insights);

        const productData = {
          campaignId: campaign.id,
          campaignName: campaign.name,
          spend7d: spend,
          revenue7d: revenue,
          roas7d: roas?.toFixed(2) || 'N/A'
        };

        // Categorize by performance
        if (spend < THRESHOLDS.MIN_SPEND_FOR_DECISION) {
          results.untested.push({
            ...productData,
            recommendation: 'Continue testing - not enough spend for decision'
          });
        } else if (roas >= THRESHOLDS.WINNER_ROAS) {
          results.winners.push({
            ...productData,
            recommendation: 'WINNER - Scale budget, add to winners collection'
          });

          // Auto-add to recommendations
          results.recommendations.push({
            type: 'scale',
            campaignId: campaign.id,
            reason: `7-day ROAS of ${roas.toFixed(2)}x exceeds ${THRESHOLDS.WINNER_ROAS}x threshold`,
            suggestedAction: 'Double daily budget'
          });
        } else if (roas >= THRESHOLDS.MARGINAL_ROAS) {
          results.marginal.push({
            ...productData,
            recommendation: 'Continue testing - try different creatives or audiences'
          });

          results.recommendations.push({
            type: 'optimize',
            campaignId: campaign.id,
            reason: `7-day ROAS of ${roas.toFixed(2)}x is marginal`,
            suggestedAction: 'Test new ad creative or audience'
          });
        } else {
          results.cut.push({
            ...productData,
            recommendation: 'CUT - Pause ads, keep product for organic'
          });

          // Auto-pause for cut products
          await updateStatus(campaign.id, 'PAUSED');

          results.recommendations.push({
            type: 'cut',
            campaignId: campaign.id,
            reason: `7-day ROAS of ${roas?.toFixed(2) || 0}x below ${THRESHOLDS.MARGINAL_ROAS}x threshold`,
            suggestedAction: 'Ads paused automatically'
          });
        }
      } catch (error) {
        console.error(`Error analyzing campaign ${campaign.id}:`, error);
      }
    }

    // Generate aggregate insights
    results.insights = generateAggregateInsights(results);

  } catch (error) {
    results.error = error.message;
  }

  return results;
}

/**
 * Generate aggregate insights from weekly analysis
 */
function generateAggregateInsights(results) {
  const insights = [];

  // Win rate
  const total = results.winners.length + results.marginal.length + results.cut.length;
  if (total > 0) {
    const winRate = (results.winners.length / total * 100).toFixed(1);
    insights.push({
      metric: 'Win Rate',
      value: `${winRate}%`,
      context: `${results.winners.length} winners out of ${total} tested products`
    });
  }

  // Best performer
  if (results.winners.length > 0) {
    const best = results.winners.reduce((a, b) =>
      parseFloat(a.roas7d) > parseFloat(b.roas7d) ? a : b
    );
    insights.push({
      metric: 'Top Performer',
      value: best.campaignName,
      context: `${best.roas7d}x ROAS with $${best.spend7d.toFixed(2)} spend`
    });
  }

  // Total metrics
  const allProducts = [...results.winners, ...results.marginal, ...results.cut];
  const totalSpend = allProducts.reduce((sum, p) => sum + p.spend7d, 0);
  const totalRevenue = allProducts.reduce((sum, p) => sum + p.revenue7d, 0);

  if (totalSpend > 0) {
    insights.push({
      metric: 'Week Overview',
      value: `${(totalRevenue / totalSpend).toFixed(2)}x ROAS`,
      context: `$${totalSpend.toFixed(2)} spend → $${totalRevenue.toFixed(2)} revenue`
    });
  }

  // Category performance (if extractable from campaign names)
  const categoryStats = {};
  for (const product of allProducts) {
    const parts = product.campaignName.split(' - ');
    const category = parts[1] || 'unknown';

    if (!categoryStats[category]) {
      categoryStats[category] = { spend: 0, revenue: 0, count: 0 };
    }
    categoryStats[category].spend += product.spend7d;
    categoryStats[category].revenue += product.revenue7d;
    categoryStats[category].count++;
  }

  // Find best category
  let bestCategory = null;
  let bestCategoryROAS = 0;
  for (const [cat, stats] of Object.entries(categoryStats)) {
    if (stats.spend > 0) {
      const catROAS = stats.revenue / stats.spend;
      if (catROAS > bestCategoryROAS) {
        bestCategoryROAS = catROAS;
        bestCategory = cat;
      }
    }
  }

  if (bestCategory) {
    insights.push({
      metric: 'Best Category',
      value: bestCategory,
      context: `${bestCategoryROAS.toFixed(2)}x ROAS across ${categoryStats[bestCategory].count} products`
    });
  }

  return insights;
}

/**
 * Get products by lifecycle state
 */
export function getProductsByState(state) {
  const products = [];
  for (const [id, product] of productStore) {
    if (product.lifecycle === state) {
      products.push({ id, ...product });
    }
  }
  return products;
}

/**
 * Get testing queue (products waiting to be tested)
 */
export function getTestingQueue() {
  return getProductsByState(LIFECYCLE_STATES.UNTESTED);
}

/**
 * Get winners ready to scale
 */
export function getWinners() {
  return getProductsByState(LIFECYCLE_STATES.WINNER);
}

/**
 * Format weekly analysis for Telegram
 */
export function formatWeeklyAnalysis(results) {
  let message = `📊 <b>WEEKLY LIFECYCLE ANALYSIS</b>\n`;
  message += `<i>${new Date(results.timestamp).toLocaleString()}</i>\n\n`;

  message += `<b>Analyzed:</b> ${results.analyzed} campaigns\n\n`;

  // Winners
  if (results.winners.length > 0) {
    message += `🏆 <b>WINNERS (${results.winners.length})</b>\n`;
    for (const w of results.winners) {
      message += `• ${w.campaignName.split(' - ').slice(-1)[0]}\n`;
      message += `  $${w.spend7d.toFixed(2)} → $${w.revenue7d.toFixed(2)} (${w.roas7d}x)\n`;
    }
    message += '\n';
  }

  // Marginal
  if (results.marginal.length > 0) {
    message += `⚠️ <b>CONTINUE TESTING (${results.marginal.length})</b>\n`;
    for (const m of results.marginal) {
      message += `• ${m.campaignName.split(' - ').slice(-1)[0]} - ${m.roas7d}x\n`;
    }
    message += '\n';
  }

  // Cut
  if (results.cut.length > 0) {
    message += `🛑 <b>CUT - ADS PAUSED (${results.cut.length})</b>\n`;
    for (const c of results.cut) {
      message += `• ${c.campaignName.split(' - ').slice(-1)[0]} - ${c.roas7d}x\n`;
    }
    message += '\n';
  }

  // Insights
  if (results.insights && results.insights.length > 0) {
    message += `<b>INSIGHTS:</b>\n`;
    for (const insight of results.insights) {
      message += `• <b>${insight.metric}:</b> ${insight.value}\n`;
      message += `  <i>${insight.context}</i>\n`;
    }
    message += '\n';
  }

  // Recommendations
  if (results.recommendations.length > 0) {
    message += `<b>ACTION ITEMS:</b>\n`;
    for (const rec of results.recommendations) {
      const icon = rec.type === 'scale' ? '📈' : rec.type === 'cut' ? '🛑' : '🔧';
      message += `${icon} ${rec.suggestedAction}\n`;
    }
  }

  return message;
}

export default {
  LIFECYCLE_STATES,
  THRESHOLDS,
  registerProduct,
  getProductStatus,
  updateProductLifecycle,
  runWeeklyAnalysis,
  getProductsByState,
  getTestingQueue,
  getWinners,
  formatWeeklyAnalysis
};
