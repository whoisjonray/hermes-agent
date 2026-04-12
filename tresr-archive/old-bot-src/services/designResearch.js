/**
 * Design Research Service
 * Uses DataForSEO Amazon API for REAL sales data, falls back to Google Images
 * to find winning design opportunities
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { searchDesignStyles } from './styleResearch.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// DataForSEO credentials
const DATAFORSEO_LOGIN = process.env.DATAFORSEO_LOGIN;
const DATAFORSEO_PASSWORD = process.env.DATAFORSEO_PASSWORD;

/**
 * Search Google Images for best-selling designs in a category
 */
export async function searchWinningDesigns(category, topic = '') {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !cx) {
    throw new Error('Google Search API not configured');
  }

  // Search queries optimized for finding actual products
  const queries = [
    `best selling ${category} t-shirt design`,
    `${category} shirt etsy bestseller`,
    `popular ${category} tee design ${topic}`.trim(),
    `${category} t-shirt amazon best seller`
  ];

  const allResults = [];

  for (const query of queries.slice(0, 2)) { // Limit API calls
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&searchType=image&num=5`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.items) {
        allResults.push(...data.items.map(item => ({
          query,
          title: item.title,
          url: item.link,
          source: item.displayLink,
          context: item.image?.contextLink
        })));
      }
    } catch (e) {
      console.log(`Search failed for "${query}": ${e.message}`);
    }
  }

  return allResults;
}

/**
 * Analyze winning designs with Gemini Vision
 */
export async function analyzeWinningDesigns(imageUrls) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error('Gemini API key not configured');

  // Download images
  const images = [];
  for (let i = 0; i < Math.min(imageUrls.length, 5); i++) {
    try {
      const response = await fetch(imageUrls[i]);
      if (response.ok) {
        const buffer = await response.arrayBuffer();
        images.push({
          inlineData: {
            mimeType: 'image/jpeg',
            data: Buffer.from(buffer).toString('base64')
          }
        });
      }
    } catch (e) {
      // Skip failed downloads
    }
  }

  if (images.length === 0) {
    throw new Error('No images could be downloaded');
  }

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [
            ...images,
            {
              text: `Analyze these t-shirt designs that are selling well. Extract:

1. DESIGN STYLES: What visual styles are used? (typography, illustration, vintage, minimalist, etc.)
2. TEXT PATTERNS: What kind of text/phrases appear? (funny, motivational, puns, etc.)
3. COLOR SCHEMES: What colors are most common?
4. GRAPHIC ELEMENTS: What icons/illustrations appear?
5. LAYOUT: How are elements arranged?
6. WHAT MAKES THEM SELL: Why do these designs work?

Return as JSON:
{
  "designStyles": ["style1", "style2"],
  "textPatterns": ["pattern1", "pattern2"],
  "examplePhrases": ["phrase1", "phrase2"],
  "colorSchemes": [{"primary": "#hex", "secondary": "#hex"}],
  "graphicElements": ["element1", "element2"],
  "layoutPatterns": "description",
  "whyTheySell": "analysis of appeal",
  "designPromptTemplate": "A template prompt to generate similar designs"
}`
            }
          ]
        }],
        generationConfig: { temperature: 0.2 }
      })
    }
  );

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    return JSON.parse(jsonMatch[0]);
  }

  return { raw: text };
}

/**
 * Combine trending topic with proven design patterns
 * Creates COMPLETE, punchy text like BALLN designs:
 * - "LEGACY LOADING" (2 words)
 * - "TRUST THE PROCESS" (3 words)
 * - "PAPER HANDS PAPER DREAMS" (4 words)
 */
export async function generateWinningDesignBrief(category, trendingTopic, designAnalysis) {
  const geminiKey = process.env.GEMINI_API_KEY;

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiKey
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: `Create a COMPELLING t-shirt design concept for the ${category} niche.

CONTEXT: ${trendingTopic || 'popular themes in ' + category}

MARKET RESEARCH (from Amazon best-sellers + Google Images):
- Visual styles that sell: ${designAnalysis.designStyles?.join(', ')}
- Popular text patterns: ${designAnalysis.textPatterns?.join(', ')}
- Why people buy: ${designAnalysis.whyTheySell}

YOUR TASK: Create a design that ${category} enthusiasts will WANT to wear.

YOU CAN CREATE:
1. TYPOGRAPHY-FOCUSED: Bold text (1-6 words) with strong visual impact
2. ILLUSTRATED: Graphics/characters with supporting text
3. ICONIC: Strong symbol/icon as hero element with minimal text

Base your design on the research above. What visual styles are selling? Use them!
The goal is identity expression - people wear shirts that say "this is who I am."

Return ONLY JSON:
{
  "title": "Catchy product title for Shopify listing",
  "designType": "typography|illustrated|iconic",
  "textContent": "The text to display",
  "visualDescription": "Describe any illustrations/graphics/icons",
  "styleRecommendation": "Specific style based on research (e.g., vintage distressed, modern minimal, bold geometric)",
  "colorPalette": {"primary": "#FFFFFF", "secondary": "#000000"},
  "whyItWillSell": "Why this resonates with ${category} buyers based on the research",
  "designStyles": ${JSON.stringify(designAnalysis.designStyles || [])}
}`
          }]
        }],
        generationConfig: { temperature: 0.6 }
      })
    }
  );

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  console.log('   Brief response length:', text.length);

  // Try to extract clean JSON from the response
  try {
    // First try: extract JSON block between code fences
    const codeFenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (codeFenceMatch) {
      let parsed = JSON.parse(codeFenceMatch[1].trim());
      // Handle array response - take first item
      if (Array.isArray(parsed)) {
        console.log(`   Parsed array of ${parsed.length} designs, using first`);
        parsed = parsed[0];
      } else {
        console.log('   Parsed from code fence');
      }
      return parsed;
    }

    // Second try: find the first complete JSON object (handle nested objects)
    const jsonMatch = text.match(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/);
    if (jsonMatch) {
      let parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed)) parsed = parsed[0];
      console.log('   Parsed from regex match');
      return parsed;
    }

    // Third try: be more aggressive - find opening brace to last closing brace
    const firstBrace = text.indexOf('{');
    const lastBrace = text.lastIndexOf('}');
    if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
      const jsonStr = text.substring(firstBrace, lastBrace + 1);
      let parsed = JSON.parse(jsonStr);
      if (Array.isArray(parsed)) parsed = parsed[0];
      console.log('   Parsed from brace extraction');
      return parsed;
    }
  } catch (parseError) {
    console.error('   JSON parse error:', parseError.message);
    console.log('   Raw text (first 300 chars):', text.substring(0, 300));
  }

  // Fallback: return a category-specific default design brief
  console.log('   Using fallback design brief for:', category);

  // Category-specific fallback phrases
  const fallbackPhrases = {
    crypto: 'DIAMOND HANDS',
    fitness: 'NO DAYS OFF',
    coffee: 'DEATH BEFORE DECAF',
    developer: 'SHIP IT',
    gaming: 'GAME ON',
    'dog lovers': 'DOG MOM',
    'mental health': 'BE KIND',
    entrepreneur: 'HUSTLE MODE'
  };

  const fallbackText = fallbackPhrases[category] || category.toUpperCase();

  return {
    title: `${fallbackText} T-Shirt`,
    designType: 'typography',
    textContent: fallbackText,
    visualDescription: 'Bold stacked typography on black background',
    colorPalette: { primary: '#FFFFFF', secondary: '#000000' },
    whyItWillSell: 'Identity-based messaging for the niche',
    imagePrompt: `Bold typography design "${fallbackText}" on black background`
  };
}

/**
 * Full hybrid research flow
 * COMBINES both data sources for complete picture:
 * - DataForSEO Amazon = What's SELLING (titles, ratings, reviews, prices)
 * - Google Images = What it LOOKS LIKE (visual styles, layouts, colors)
 */
export async function hybridDesignResearch(category, trendingTopic = null) {
  console.log(`\n🔍 Hybrid Research: ${category}`);
  if (trendingTopic) console.log(`📈 Trending topic: ${trendingTopic}`);

  let salesData = null;
  let visualAnalysis = null;
  let searchResults = [];
  let dataSources = [];

  // Step 1: Get SALES data from DataForSEO Amazon (what's selling)
  if (DATAFORSEO_LOGIN && DATAFORSEO_PASSWORD) {
    console.log('\n1️⃣ Getting Amazon sales data (DataForSEO)...');
    try {
      salesData = await searchDesignStyles(category);
      if (salesData?.salesSignals?.length > 0) {
        console.log(`   ✅ Sales data: ${salesData.salesSignals?.slice(0,2).join(', ')}`);
        dataSources.push('amazon');
      }
    } catch (e) {
      console.log(`   ⚠️ Amazon data unavailable: ${e.message}`);
    }
  }

  // Step 2: Get VISUAL data from Google Images (what it looks like)
  console.log('\n2️⃣ Getting visual patterns (Google Images)...');
  try {
    searchResults = await searchWinningDesigns(category, trendingTopic);
    console.log(`   Found ${searchResults.length} design examples`);

    if (searchResults.length > 0) {
      console.log('   Analyzing visual patterns...');
      const imageUrls = searchResults.map(r => r.url);
      visualAnalysis = await analyzeWinningDesigns(imageUrls);
      console.log('   ✅ Visual styles:', visualAnalysis.designStyles?.slice(0,3).join(', '));
      dataSources.push('google_images');
    }
  } catch (e) {
    console.log(`   ⚠️ Visual analysis failed: ${e.message}`);
  }

  // Step 3: COMBINE both data sources into unified analysis
  console.log('\n3️⃣ Combining sales + visual data...');
  const combinedAnalysis = {
    // Visual patterns from Google Images
    designStyles: visualAnalysis?.designStyles || salesData?.dominantStyles || ['bold', 'typography'],
    textPatterns: visualAnalysis?.textPatterns || salesData?.provenPhrases || ['funny', 'identity'],
    examplePhrases: visualAnalysis?.examplePhrases || [],
    graphicElements: visualAnalysis?.graphicElements || ['minimal icons'],
    layoutPatterns: visualAnalysis?.layoutPatterns || 'centered, clean',
    colorSchemes: visualAnalysis?.colorSchemes || [],

    // Sales insights from Amazon
    salesInsight: salesData?.styleRecommendation || 'Bold graphics with identity messaging',
    buyerPsychology: salesData?.buyerPsychology || 'Identity expression',
    topSellerTitles: salesData?.topSellers?.map(s => s.title) || [],
    avgRating: salesData?.topSellers?.[0]?.rating || 'N/A',

    // Combined "why it sells"
    whyTheySell: combineWhyTheySell(salesData, visualAnalysis)
  };

  // Step 4: Generate design brief with COMBINED insights
  console.log('\n4️⃣ Generating design brief...');
  const topic = trendingTopic || `popular ${category} themes`;
  const designBrief = await generateWinningDesignBrief(category, topic, combinedAnalysis);
  console.log('   Title:', designBrief.title);
  console.log('   Text:', designBrief.textContent);

  // Build sources list
  const sources = [
    ...(salesData?.topSellers?.slice(0, 3).map(s => ({
      title: s.title?.substring(0, 50),
      source: 'Amazon',
      rating: s.rating,
      reviews: s.reviews
    })) || []),
    ...(searchResults.slice(0, 3).map(r => ({
      title: r.title?.substring(0, 50),
      source: r.source
    })))
  ];

  return {
    category,
    trendingTopic,
    dataSources, // ['amazon', 'google_images'] or subset
    salesSignals: salesData?.salesSignals || [],
    searchResultsCount: searchResults.length,
    amazonProductsAnalyzed: salesData?.topSellers?.length || 0,
    sources,
    designAnalysis: combinedAnalysis,
    designBrief
  };
}

/**
 * Combine insights from both sales data and visual analysis
 */
function combineWhyTheySell(salesData, visualAnalysis) {
  const parts = [];

  if (salesData?.buyerPsychology) {
    parts.push(`Sales data shows: ${salesData.buyerPsychology}`);
  }
  if (visualAnalysis?.whyTheySell) {
    parts.push(`Visual patterns: ${visualAnalysis.whyTheySell}`);
  }

  if (parts.length === 0) {
    return 'Identity expression and relatable humor drive purchases in this category';
  }

  return parts.join('. ');
}

export default {
  searchWinningDesigns,
  analyzeWinningDesigns,
  generateWinningDesignBrief,
  hybridDesignResearch
};
