/**
 * Meta Ads Service
 * Handles Facebook/Instagram Ads API operations
 *
 * Supports multiple clients under one Business Manager (Awaken Local)
 * Each client has their own ad account, pixel, and page
 */

const API_VERSION = 'v18.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

// Shared access token (System User with access to all client ad accounts)
const META_ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;

// Client configurations (Awaken Local Business Portfolio)
export const CLIENTS = {
  tresr: {
    name: 'TRESR / NFTREASURE',
    adAccountId: process.env.TRESR_AD_ACCOUNT_ID || 'act_431799842093236',
    pixelId: process.env.TRESR_PIXEL_ID,
    pageId: process.env.TRESR_PAGE_ID
  },
  doorgrow: {
    name: 'DoorGrow',
    adAccountId: process.env.DOORGROW_AD_ACCOUNT_ID || 'act_40688230',
    pixelId: process.env.DOORGROW_PIXEL_ID,
    pageId: process.env.DOORGROW_PAGE_ID
  },
  awaken: {
    name: 'Awaken Entrepreneur',
    adAccountId: process.env.AWAKEN_AD_ACCOUNT_ID,
    pixelId: process.env.AWAKEN_PIXEL_ID,
    pageId: process.env.AWAKEN_PAGE_ID
  },
  peanutbrittle: {
    name: "Uncle Ray's Peanut Brittle",
    adAccountId: process.env.PEANUTBRITTLE_AD_ACCOUNT_ID,
    pixelId: process.env.PEANUTBRITTLE_PIXEL_ID,
    pageId: process.env.PEANUTBRITTLE_PAGE_ID
  }
};

// Default client (can be overridden per-call)
let activeClient = 'tresr';

/**
 * Set the active client for subsequent API calls
 */
export function setActiveClient(clientKey) {
  if (!CLIENTS[clientKey]) {
    throw new Error(`Unknown client: ${clientKey}. Available: ${Object.keys(CLIENTS).join(', ')}`);
  }
  activeClient = clientKey;
  return CLIENTS[clientKey];
}

/**
 * Get current client config
 */
export function getClientConfig(clientKey = activeClient) {
  return CLIENTS[clientKey] || CLIENTS[activeClient];
}

/**
 * Get ad account ID for current/specified client
 */
function getAdAccountId(clientKey) {
  const client = getClientConfig(clientKey);
  const id = client.adAccountId;
  // Ensure it starts with act_
  return id.startsWith('act_') ? id : `act_${id}`;
}

/**
 * Get pixel ID for current/specified client
 */
function getPixelId(clientKey) {
  return getClientConfig(clientKey).pixelId;
}

/**
 * Get page ID for current/specified client
 */
function getPageId(clientKey) {
  return getClientConfig(clientKey).pageId;
}

/**
 * Create an ad campaign
 * @param {Object} options - Campaign options
 * @param {string} options.clientKey - Optional client key (defaults to active client)
 */
export async function createAdCampaign({ name, objective, status = 'PAUSED', clientKey }) {
  const adAccountId = getAdAccountId(clientKey);
  const url = `${BASE_URL}/${adAccountId}/campaigns`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: META_ACCESS_TOKEN,
      name,
      objective,
      status,
      special_ad_categories: [],
      // Required when not using Campaign Budget Optimization
      // Set to false to manage budget at ad set level
      is_adset_budget_sharing_enabled: false
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Campaign creation failed: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Create an ad set
 * @param {Object} options - Ad set options
 * @param {string} options.clientKey - Optional client key (defaults to active client)
 */
export async function createAdSet({
  campaignId,
  name,
  dailyBudget,
  targeting,
  optimization_goal,
  billing_event,
  clientKey
}) {
  const adAccountId = getAdAccountId(clientKey);
  const pixelId = getPixelId(clientKey);
  const url = `${BASE_URL}/${adAccountId}/adsets`;

  // Calculate end time (4 days from now for test)
  const startTime = new Date();
  const endTime = new Date(startTime.getTime() + 4 * 24 * 60 * 60 * 1000);

  // If no pixel configured, use LINK_CLICKS optimization instead of OFFSITE_CONVERSIONS
  const effectiveOptGoal = pixelId ? optimization_goal : 'LINK_CLICKS';
  const effectiveBillingEvent = pixelId ? billing_event : 'IMPRESSIONS';

  console.log(`Creating ad set with optimization: ${effectiveOptGoal} (pixel: ${pixelId ? 'configured' : 'not configured'})`);

  // With Advantage+ Audience, age_max must be at least 65
  // The algorithm will optimize to find the best audience anyway
  const adjustedTargeting = {
    ...targeting,
    age_max: 65,  // Required minimum for Advantage+ Audience
    facebook_positions: ['feed', 'instant_article', 'marketplace'],
    instagram_positions: ['stream', 'explore'],
    // Advantage Audience (Advantage+ targeting) - required by Meta as of 2025
    targeting_automation: {
      advantage_audience: 1  // Enable Advantage+ for better reach
    }
  };

  const body = {
    access_token: META_ACCESS_TOKEN,
    campaign_id: campaignId,
    name,
    daily_budget: dailyBudget,
    billing_event: effectiveBillingEvent,
    optimization_goal: effectiveOptGoal,
    bid_strategy: 'LOWEST_COST_WITHOUT_CAP',  // Let Meta optimize for lowest cost
    targeting: adjustedTargeting,
    start_time: startTime.toISOString(),
    end_time: endTime.toISOString(),
    status: 'PAUSED'
  };

  // Only add promoted_object if pixel is configured (required for conversion optimization)
  if (pixelId) {
    body.promoted_object = {
      pixel_id: pixelId,
      custom_event_type: 'PURCHASE'
    };
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Ad set creation failed: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Create an ad creative
 * @param {Object} options - Creative options
 * @param {string} options.clientKey - Optional client key (defaults to active client)
 */
export async function createAdCreative({ name, title, body, link, imageHash, clientKey }) {
  const adAccountId = getAdAccountId(clientKey);
  const pageId = getPageId(clientKey);
  const url = `${BASE_URL}/${adAccountId}/adcreatives`;

  if (!pageId) {
    throw new Error(`No Page ID configured for client. Set TRESR_PAGE_ID or META_PAGE_ID in .env`);
  }

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: META_ACCESS_TOKEN,
      name,
      object_story_spec: {
        page_id: pageId,
        link_data: {
          link,
          message: body,
          name: title,
          image_hash: imageHash,
          call_to_action: {
            type: 'SHOP_NOW',
            value: { link }
          }
        }
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Creative creation failed: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Upload image to Meta and get hash
 * @param {string} imagePath - Path to image file OR URL
 * @param {string} clientKey - Optional client key (defaults to active client)
 */
export async function uploadAdImage(imagePath, clientKey) {
  let imageBuffer;

  // Check if it's a URL or local file
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    // Download image from URL
    console.log(`Downloading image from URL: ${imagePath}`);
    const response = await fetch(imagePath);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    imageBuffer = Buffer.from(arrayBuffer);
  } else {
    // Read from local file
    const fs = await import('fs');
    imageBuffer = fs.readFileSync(imagePath);
  }

  const base64Image = imageBuffer.toString('base64');

  const adAccountId = getAdAccountId(clientKey);
  const url = `${BASE_URL}/${adAccountId}/adimages`;

  const uploadResponse = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: META_ACCESS_TOKEN,
      bytes: base64Image
    })
  });

  if (!uploadResponse.ok) {
    const error = await uploadResponse.json();
    throw new Error(`Image upload failed: ${JSON.stringify(error)}`);
  }

  const data = await uploadResponse.json();
  // Response format: { images: { <filename>: { hash: "..." } } }
  const imageData = Object.values(data.images)[0];
  return imageData.hash;
}

/**
 * Create an ad
 */
export async function createAd({ adSetId, name, creative, clientKey }) {
  // First upload image and get hash
  const imageHash = await uploadAdImage(creative.imageUrl, clientKey);

  // Create creative
  const adCreative = await createAdCreative({
    name: `${name} Creative`,
    title: creative.title,
    body: creative.body,
    link: creative.link,
    imageHash,
    clientKey
  });

  // Create ad
  const adAccountId = getAdAccountId(clientKey);
  const url = `${BASE_URL}/${adAccountId}/ads`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: META_ACCESS_TOKEN,
      adset_id: adSetId,
      name,
      creative: { creative_id: adCreative.id },
      status: 'PAUSED'
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Ad creation failed: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Update campaign/adset/ad status
 */
export async function updateStatus(objectId, status) {
  const url = `${BASE_URL}/${objectId}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      access_token: META_ACCESS_TOKEN,
      status
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Status update failed: ${JSON.stringify(error)}`);
  }

  return response.json();
}

/**
 * Get ad insights (performance metrics)
 */
export async function getAdInsights(adId, datePreset = 'lifetime') {
  const url = `${BASE_URL}/${adId}/insights`;

  const params = new URLSearchParams({
    access_token: META_ACCESS_TOKEN,
    date_preset: datePreset,
    fields: [
      'spend',
      'impressions',
      'clicks',
      'cpc',
      'cpm',
      'ctr',
      'reach',
      'actions',
      'action_values',
      'cost_per_action_type',
      'purchase_roas'
    ].join(',')
  });

  const response = await fetch(`${url}?${params}`);

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Insights fetch failed: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.data?.[0] || null;
}

/**
 * Get ad set insights
 */
export async function getAdSetInsights(adSetId, datePreset = 'lifetime') {
  const url = `${BASE_URL}/${adSetId}/insights`;

  const params = new URLSearchParams({
    access_token: META_ACCESS_TOKEN,
    date_preset: datePreset,
    fields: [
      'spend',
      'impressions',
      'clicks',
      'cpc',
      'cpm',
      'ctr',
      'reach',
      'actions',
      'action_values',
      'cost_per_action_type',
      'purchase_roas'
    ].join(',')
  });

  const response = await fetch(`${url}?${params}`);
  const data = await response.json();
  return data.data?.[0] || null;
}

/**
 * Get campaign insights
 */
export async function getCampaignInsights(campaignId, datePreset = 'lifetime') {
  const url = `${BASE_URL}/${campaignId}/insights`;

  const params = new URLSearchParams({
    access_token: META_ACCESS_TOKEN,
    date_preset: datePreset,
    fields: [
      'spend',
      'impressions',
      'clicks',
      'cpc',
      'cpm',
      'ctr',
      'reach',
      'actions',
      'action_values',
      'cost_per_action_type',
      'purchase_roas'
    ].join(',')
  });

  const response = await fetch(`${url}?${params}`);
  const data = await response.json();
  return data.data?.[0] || null;
}

/**
 * Get all active campaigns
 * @param {string} clientKey - Optional client key (defaults to active client)
 */
export async function getActiveCampaigns(clientKey) {
  const adAccountId = getAdAccountId(clientKey);
  const url = `${BASE_URL}/${adAccountId}/campaigns`;

  const params = new URLSearchParams({
    access_token: META_ACCESS_TOKEN,
    fields: 'id,name,status,objective,created_time',
    filtering: JSON.stringify([
      { field: 'effective_status', operator: 'IN', value: ['ACTIVE', 'PAUSED'] }
    ]),
    limit: 100
  });

  const response = await fetch(`${url}?${params}`);
  const data = await response.json();
  return data.data || [];
}

/**
 * Get all ad sets for a campaign
 */
export async function getCampaignAdSets(campaignId) {
  const url = `${BASE_URL}/${campaignId}/adsets`;

  const params = new URLSearchParams({
    access_token: META_ACCESS_TOKEN,
    fields: 'id,name,status,daily_budget,lifetime_budget,targeting,optimization_goal'
  });

  const response = await fetch(`${url}?${params}`);
  const data = await response.json();
  return data.data || [];
}

/**
 * Get all ads for an ad set
 */
export async function getAdSetAds(adSetId) {
  const url = `${BASE_URL}/${adSetId}/ads`;

  const params = new URLSearchParams({
    access_token: META_ACCESS_TOKEN,
    fields: 'id,name,status,creative'
  });

  const response = await fetch(`${url}?${params}`);
  const data = await response.json();
  return data.data || [];
}

/**
 * Parse ROAS from insights
 */
export function parseROAS(insights) {
  if (!insights) return null;

  // Try purchase_roas first
  if (insights.purchase_roas) {
    const roasEntry = insights.purchase_roas.find(r => r.action_type === 'omni_purchase');
    if (roasEntry) return parseFloat(roasEntry.value);
  }

  // Calculate manually from action_values and spend
  if (insights.action_values && insights.spend) {
    const purchaseValue = insights.action_values.find(
      a => a.action_type === 'omni_purchase' || a.action_type === 'purchase'
    );
    if (purchaseValue) {
      return parseFloat(purchaseValue.value) / parseFloat(insights.spend);
    }
  }

  return null;
}

/**
 * Parse spend from insights
 */
export function parseSpend(insights) {
  if (!insights?.spend) return 0;
  return parseFloat(insights.spend);
}

/**
 * Parse purchases from insights
 */
export function parsePurchases(insights) {
  if (!insights?.actions) return 0;
  const purchase = insights.actions.find(
    a => a.action_type === 'omni_purchase' || a.action_type === 'purchase'
  );
  return purchase ? parseInt(purchase.value) : 0;
}

/**
 * Parse revenue from insights
 */
export function parseRevenue(insights) {
  if (!insights?.action_values) return 0;
  const purchaseValue = insights.action_values.find(
    a => a.action_type === 'omni_purchase' || a.action_type === 'purchase'
  );
  return purchaseValue ? parseFloat(purchaseValue.value) : 0;
}

export default {
  // Client management
  setActiveClient,
  getClientConfig,
  CLIENTS,

  // Campaign operations
  createAdCampaign,
  createAdSet,
  createAdCreative,
  createAd,
  uploadAdImage,
  updateStatus,

  // Insights
  getAdInsights,
  getAdSetInsights,
  getCampaignInsights,
  getActiveCampaigns,
  getCampaignAdSets,
  getAdSetAds,

  // Parsers
  parseROAS,
  parseSpend,
  parsePurchases,
  parseRevenue
};
