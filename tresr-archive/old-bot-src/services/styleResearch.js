/**
 * Style Research Service
 * Researches what's ACTUALLY SELLING - not just what's popular
 *
 * SALES SIGNALS we prioritize:
 * 1. Etsy best sellers & star sellers (verified sales)
 * 2. Amazon best seller rank in clothing category
 * 3. High review counts (social proof = sales)
 * 4. "Sold X items" indicators
 * 5. Trending on Redbubble/Teepublic (POD-specific)
 *
 * We look for patterns in designs that have these sales signals,
 * NOT just what looks nice in search results.
 *
 * NOTE: DataForSEO returns PRODUCT DATA (titles, prices, ratings, reviews)
 * NOT images. We analyze text patterns to understand what sells.
 */

import 'dotenv/config';

const SERPAPI_KEY = process.env.SERPAPI_KEY;
const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const GOOGLE_CX = process.env.GOOGLE_CX;
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY;

// DataForSEO credentials (we have these!)
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;

/**
 * DATA SOURCE PRIORITY:
 * 1. DataForSEO Amazon API - Real Amazon best seller data (WE HAVE THIS!)
 * 2. DataForSEO Google Shopping - Product data with reviews
 * 3. AI analysis (Gemini's knowledge - educated guess)
 */

/**
 * Search for BEST-SELLING designs (not just popular ones)
 * Uses sales-focused search queries to find what's actually converting
 */
export async function searchDesignStyles(category, text = '') {
  console.log(`Researching what sells in "${category}" category...`);

  try {
    // PRIORITY 1: DataForSEO Amazon API - Real Amazon best seller data
    if (DATAFORSEO_LOGIN && DATAFORSEO_PASSWORD) {
      console.log('Using DataForSEO Amazon API for real sales data...');
      const amazonData = await searchAmazonBestSellers(category);
      if (amazonData?.salesSignals?.length > 0) {
        console.log('Got real Amazon sales data!');
        return amazonData;
      }
    }

    // PRIORITY 2: AI analysis enriched with what we know sells
    if (GEMINI_API_KEY) {
      console.log('Using AI market analysis...');
      const aiInsights = await analyzeMarketWithAI(category, text);
      aiInsights.dataSource = 'ai_analysis';
      return aiInsights;
    }

    // Fallback to defaults
    console.log('No APIs configured, using default styles');
    return getDefaultStyleInsights(category);

  } catch (error) {
    console.error('Style research error:', error.message);
    return getDefaultStyleInsights(category);
  }
}

/**
 * Search Amazon best sellers using DataForSEO Merchant API
 * This gives us REAL sales data from Amazon
 *
 * API docs: https://docs.dataforseo.com/v3/merchant/amazon/products/task_post/
 * Valid sort_by: relevance, featured, avg_customer_review, price_low_to_high, price_high_to_low, newest_arrival
 * We look for is_best_seller and is_amazon_choice flags in results
 */
async function searchAmazonBestSellers(category) {
  const auth = Buffer.from(`${DATAFORSEO_LOGIN}:${DATAFORSEO_PASSWORD}`).toString('base64');

  // Search for t-shirts in this category - keep it simple for better results
  const searchQuery = `${category} t-shirt`;
  console.log(`   DataForSEO search: "${searchQuery}"`);

  try {
    // Create a task to search Amazon products
    // Using 'featured' sort to get promoted/popular items, plus we'll check is_best_seller flag
    const taskResponse = await fetch('https://api.dataforseo.com/v3/merchant/amazon/products/task_post', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify([{
        keyword: searchQuery,
        language_name: 'English (United States)',
        location_name: 'United States',
        depth: 30, // Get more results to find best sellers
        sort_by: 'featured', // Featured items tend to be popular
        priority: 2 // High priority for faster results
      }])
    });

    const taskData = await taskResponse.json();
    console.log(`   Task response status: ${taskData.status_code}`);

    if (taskData.status_code !== 20000) {
      console.error('   DataForSEO task creation failed:', taskData.status_message);
      return null;
    }

    const taskId = taskData.tasks?.[0]?.id;
    if (!taskId) {
      console.error('   No task ID returned');
      return null;
    }
    console.log(`   Task ID: ${taskId}`);

    // Wait for results (poll every 3 seconds, max 30 seconds for reliability)
    let results = null;
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 3000));
      console.log(`   Polling attempt ${i + 1}/10...`);

      const resultResponse = await fetch(`https://api.dataforseo.com/v3/merchant/amazon/products/task_get/advanced/${taskId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Basic ${auth}`
        }
      });

      const resultData = await resultResponse.json();
      const taskStatus = resultData.tasks?.[0]?.status_code;
      const taskStatusMsg = resultData.tasks?.[0]?.status_message;

      console.log(`   Status: ${taskStatus} - ${taskStatusMsg}`);

      if (taskStatus === 20000 && resultData.tasks?.[0]?.result) {
        results = resultData.tasks[0].result;
        console.log(`   ✅ Got results!`);
        break;
      }

      // If task is still pending, continue polling
      if (taskStatus === 40601) {
        console.log(`   Task still processing...`);
        continue;
      }
    }

    if (!results || results.length === 0) {
      console.log('   No Amazon results found after polling');
      return null;
    }

    // Analyze the best-selling products
    return analyzeAmazonResults(results, category);

  } catch (error) {
    console.error('   DataForSEO Amazon API error:', error.message);
    return null;
  }
}

/**
 * Analyze Amazon results to extract style patterns from best sellers
 * Looks for is_best_seller and is_amazon_choice flags
 */
function analyzeAmazonResults(results, category) {
  const items = results[0]?.items || [];
  console.log(`   Analyzing ${items.length} Amazon products...`);

  if (items.length === 0) {
    return null;
  }

  // Prioritize items with best seller or Amazon's choice badges
  const bestSellers = items.filter(item => item.is_best_seller === true);
  const amazonChoice = items.filter(item => item.is_amazon_choice === true);

  console.log(`   Best Sellers: ${bestSellers.length}, Amazon's Choice: ${amazonChoice.length}`);

  // Use best sellers if available, otherwise use featured items
  const priorityItems = bestSellers.length > 0 ? bestSellers :
                        amazonChoice.length > 0 ? amazonChoice :
                        items.slice(0, 15);

  // Extract patterns from best-selling shirts
  const titles = priorityItems.map(item => item.title || '').join(' ').toLowerCase();
  const allTitles = items.map(item => item.title || '').join(' ').toLowerCase();

  // Get ratings - handle different data structures
  const ratings = priorityItems.map(item => {
    if (typeof item.rating === 'object') return item.rating?.value || 0;
    if (typeof item.rating === 'number') return item.rating;
    return 0;
  }).filter(r => r > 0);

  const reviewCounts = priorityItems.map(item => {
    if (typeof item.rating === 'object') return item.rating?.votes_count || 0;
    return item.reviews_count || item.reviews || 0;
  }).filter(r => r > 0);

  // Find common style keywords in best sellers
  const stylePatterns = {
    vintage: titles.includes('vintage') || titles.includes('retro') || titles.includes('distressed'),
    funny: titles.includes('funny') || titles.includes('humor') || titles.includes('sarcastic') || titles.includes('hilarious'),
    minimalist: titles.includes('minimalist') || titles.includes('simple') || titles.includes('clean'),
    bold: titles.includes('bold') || titles.includes('graphic') || titles.includes('statement'),
    motivational: titles.includes('motivational') || titles.includes('inspirational') || titles.includes('positiv'),
    novelty: titles.includes('novelty') || titles.includes('gift') || titles.includes('birthday'),
  };

  const dominantStyles = Object.entries(stylePatterns)
    .filter(([_, found]) => found)
    .map(([style]) => style);

  // Get top sellers for reference with more detail
  const topSellers = priorityItems.slice(0, 5).map(item => ({
    title: item.title,
    rating: typeof item.rating === 'object' ? item.rating?.value : item.rating,
    reviews: typeof item.rating === 'object' ? item.rating?.votes_count : (item.reviews_count || item.reviews),
    price: typeof item.price === 'object' ? item.price?.current : item.price,
    isBestSeller: item.is_best_seller || false,
    isAmazonChoice: item.is_amazon_choice || false
  }));

  // Log top sellers for debugging
  topSellers.slice(0, 3).forEach((s, i) => {
    console.log(`   Top ${i + 1}: "${s.title?.substring(0, 50)}..." (${s.reviews} reviews)`);
  });

  // Calculate average rating of best sellers (social proof)
  const avgRating = ratings.length > 0
    ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1)
    : 'N/A';

  const totalReviews = reviewCounts.reduce((a, b) => a + b, 0);

  return {
    category,
    dataSource: 'amazon_dataforseo',
    salesSignals: [
      `Real Amazon data: ${items.length} products analyzed`,
      bestSellers.length > 0 ? `${bestSellers.length} Best Sellers found` : null,
      amazonChoice.length > 0 ? `${amazonChoice.length} Amazon's Choice items` : null,
      `Average rating: ${avgRating}/5`,
      `Total reviews: ${totalReviews.toLocaleString()}`
    ].filter(Boolean),
    dominantStyles: dominantStyles.length > 0 ? dominantStyles : ['bold', 'graphic'],
    topSellers,
    styleRecommendation: generateStyleFromAmazonData(dominantStyles, topSellers, category),
    buyerPsychology: `Buyers in ${category} respond to: ${dominantStyles.join(', ') || 'bold graphics and clear messaging'}`
  };
}

/**
 * Generate style recommendation from Amazon best seller data
 */
function generateStyleFromAmazonData(dominantStyles, topSellers, category) {
  if (dominantStyles.includes('funny')) {
    return 'Humor sells well in this category - witty text, sarcastic phrases, relatable jokes';
  }
  if (dominantStyles.includes('vintage')) {
    return 'Vintage/retro aesthetic is popular - distressed textures, throwback designs';
  }
  if (dominantStyles.includes('motivational')) {
    return 'Motivational messages resonate - bold inspiring text, clean typography';
  }
  if (dominantStyles.includes('minimalist')) {
    return 'Minimalist designs convert well - simple, clean, one main element';
  }

  // Default based on what top sellers show
  const topTitles = topSellers.map(s => s.title).join(' ').toLowerCase();
  if (topTitles.includes('gift')) {
    return 'Gift-oriented messaging works - "Perfect for..." or occasion-specific';
  }

  return `Bold graphic typography with ${category}-specific messaging that signals identity`;
}

/**
 * Scrape Etsy best-sellers using Firecrawl
 * This gives us REAL sales data - what people are actually buying
 */
async function scrapeEtsyBestSellers(category) {
  const etsyUrl = `https://www.etsy.com/search?q=${encodeURIComponent(category + ' t-shirt')}&order=most_relevant&explicit=1&ship_to=US`;

  const response = await fetch('https://api.firecrawl.dev/v0/scrape', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${FIRECRAWL_API_KEY}`
    },
    body: JSON.stringify({
      url: etsyUrl,
      extractorOptions: {
        mode: 'llm-extraction',
        extractionPrompt: `Extract the top 5 best-selling t-shirt designs from this Etsy search. For each:
          1. Title/text on the shirt
          2. Number of sales/reviews (as a sales signal)
          3. Visual style (vintage, minimalist, bold, etc.)
          4. Price
          Return as JSON array.`
      }
    })
  });

  const data = await response.json();

  if (data.error) {
    console.error('Firecrawl error:', data.error);
    return null;
  }

  // Parse the extracted data
  const extracted = data.data?.extractedContent;
  if (extracted) {
    return {
      category,
      salesSignals: ['Real Etsy sales data'],
      dataSource: 'etsy_scrape',
      bestSellers: extracted,
      styleRecommendation: 'Based on what\'s actually selling on Etsy right now'
    };
  }

  return null;
}

/**
 * Use Gemini to analyze what sells in a category
 * Based on its knowledge of market trends and buyer psychology
 */
async function analyzeMarketWithAI(category, userDescription = '') {
  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': GEMINI_API_KEY
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Analyze what t-shirt designs ACTUALLY SELL in the "${category}" niche.

${userDescription ? `User's idea: "${userDescription}"` : ''}

Think about:
1. What emotional triggers make people BUY (not just like) shirts in this category?
2. What text/phrases have proven to sell (insider jokes, identity statements)?
3. What visual styles convert best (vintage, minimalist, bold, etc.)?
4. What makes someone stop scrolling and click "buy"?

Return JSON:
{
  "dominantStyles": ["array of 2-3 proven selling styles"],
  "emotionalTriggers": ["what makes them BUY - identity, humor, belonging"],
  "provenPhrases": ["3-5 types of text that sell in this niche"],
  "visualPatterns": ["visual elements that convert"],
  "buyerPsychology": "Brief insight into why people buy in this category",
  "styleRecommendation": "Specific style recommendation for maximum sales potential",
  "salesSignals": ["indicators this style sells"]
}`
          }]
        }],
        generationConfig: { temperature: 0.3 }
      })
    }
  );

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    const insights = JSON.parse(jsonMatch[0]);
    return {
      category,
      ...insights,
      searchQuery: 'ai_analysis'
    };
  }

  return getDefaultStyleInsights(category);
}

/**
 * Search using SerpAPI (Google Images)
 */
async function searchWithSerpAPI(query, category) {
  const url = new URL('https://serpapi.com/search.json');
  url.searchParams.set('q', query);
  url.searchParams.set('tbm', 'isch'); // Image search
  url.searchParams.set('api_key', SERPAPI_KEY);
  url.searchParams.set('num', '10');

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.error) {
    throw new Error(data.error);
  }

  // Analyze image results for style patterns
  const images = data.images_results || [];
  return analyzeDesignPatterns(images, category);
}

/**
 * Search using Google Custom Search
 */
async function searchWithGoogleCSE(query, category) {
  const url = new URL('https://www.googleapis.com/customsearch/v1');
  url.searchParams.set('q', query);
  url.searchParams.set('key', GOOGLE_API_KEY);
  url.searchParams.set('cx', GOOGLE_CX);
  url.searchParams.set('searchType', 'image');
  url.searchParams.set('num', '10');

  const response = await fetch(url.toString());
  const data = await response.json();

  if (data.error) {
    throw new Error(data.error.message);
  }

  const images = data.items || [];
  return analyzeDesignPatterns(images, category);
}

/**
 * Analyze design patterns from search results
 * Extracts common style elements from titles and snippets
 */
function analyzeDesignPatterns(images, category) {
  // Extract text patterns from titles
  const titles = images.map(img => img.title || img.snippet || '').join(' ').toLowerCase();

  // Identify common style keywords
  const styleKeywords = {
    vintage: titles.includes('vintage') || titles.includes('retro') || titles.includes('distressed'),
    minimalist: titles.includes('minimalist') || titles.includes('simple') || titles.includes('clean'),
    bold: titles.includes('bold') || titles.includes('typography') || titles.includes('block'),
    funny: titles.includes('funny') || titles.includes('humor') || titles.includes('sarcastic'),
    motivational: titles.includes('motivational') || titles.includes('inspirational'),
    graphic: titles.includes('graphic') || titles.includes('illustration') || titles.includes('icon'),
  };

  // Find dominant styles
  const dominantStyles = Object.entries(styleKeywords)
    .filter(([_, found]) => found)
    .map(([style]) => style);

  // Get image URLs for reference (first 3)
  const referenceImages = images.slice(0, 3).map(img => ({
    url: img.original || img.link,
    title: img.title,
    source: img.source
  }));

  return {
    category,
    dominantStyles: dominantStyles.length > 0 ? dominantStyles : ['bold', 'typography'],
    referenceImages,
    styleRecommendation: generateStyleRecommendation(dominantStyles, category),
    searchQuery: images.length > 0 ? 'live_search' : 'default'
  };
}

/**
 * Generate style recommendation based on found patterns
 */
function generateStyleRecommendation(styles, category) {
  if (styles.includes('vintage')) {
    return 'vintage distressed look with worn texture, retro lettering';
  }
  if (styles.includes('minimalist')) {
    return 'clean minimalist design, simple bold text, no decorative elements';
  }
  if (styles.includes('funny')) {
    return 'playful typography with humorous tone, might include simple icon';
  }
  if (styles.includes('motivational')) {
    return 'bold impactful text, strong typography, possibly stacked layout';
  }
  if (styles.includes('graphic')) {
    return 'typography with integrated graphic element or icon';
  }

  // Default based on category
  return getCategoryDefaultStyle(category);
}

/**
 * Get default style based on category (when no search available)
 */
function getCategoryDefaultStyle(category) {
  const categoryStyles = {
    crypto: 'bold modern typography, tech-inspired, possibly with chart/diamond icon',
    fitness: 'aggressive bold typography, athletic block letters, might include weight icon',
    coffee: 'warm inviting typography, possibly vintage or hand-drawn style',
    gaming: 'bold tech typography, could be pixel-inspired or glitch style',
    'dog lovers': 'friendly playful typography with paw or dog silhouette',
    'mental health': 'clean supportive typography, warm and approachable',
    entrepreneur: 'bold motivational typography, modern professional look',
    developer: 'clean tech typography, monospace or code-inspired',
  };

  return categoryStyles[category] || 'bold modern typography, clean professional look';
}

/**
 * Get default style insights when no API is available
 */
function getDefaultStyleInsights(category) {
  return {
    category,
    dominantStyles: ['bold', 'typography'],
    referenceImages: [],
    styleRecommendation: getCategoryDefaultStyle(category),
    searchQuery: 'default'
  };
}

/**
 * Research style based on user feedback
 * When user says "make it more X", search for X-style designs
 */
export async function researchFeedbackStyle(feedback, category) {
  // Extract style keywords from feedback
  const feedbackLower = feedback.toLowerCase();

  let searchTerm = '';
  if (feedbackLower.includes('vintage') || feedbackLower.includes('retro')) {
    searchTerm = 'vintage retro';
  } else if (feedbackLower.includes('bold') || feedbackLower.includes('bigger')) {
    searchTerm = 'bold typography';
  } else if (feedbackLower.includes('minimalist') || feedbackLower.includes('simple')) {
    searchTerm = 'minimalist clean';
  } else if (feedbackLower.includes('icon') || feedbackLower.includes('graphic')) {
    searchTerm = 'graphic icon';
  } else if (feedbackLower.includes('logo')) {
    searchTerm = 'logo badge';
  }

  if (searchTerm) {
    return await searchDesignStyles(category, searchTerm);
  }

  return getDefaultStyleInsights(category);
}

export default {
  searchDesignStyles,
  researchFeedbackStyle,
  getDefaultStyleInsights
};
