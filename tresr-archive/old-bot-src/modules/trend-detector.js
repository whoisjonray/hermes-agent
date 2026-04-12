/**
 * Trend Detector Module
 * Monitors X/Twitter, Reddit, Google Trends for POD opportunities
 */

import Anthropic from '@anthropic-ai/sdk';
import { db } from '../services/database.js';

// TRESR's 10 strategic niches
const NICHES = [
  { id: 'coffee', name: 'Coffee Culture', keywords: ['coffee', 'espresso', 'barista', 'caffeine'] },
  { id: 'fitness', name: 'Fitness/Gym', keywords: ['gym', 'fitness', 'workout', 'gains', 'lifting'] },
  { id: 'gaming', name: 'Gaming', keywords: ['gaming', 'gamer', 'video games', 'esports'] },
  { id: 'millennial', name: 'Millennials/Gen X', keywords: ['90s', '80s', 'nostalgia', 'millennial'] },
  { id: 'mental_health', name: 'Mental Health', keywords: ['mental health', 'anxiety', 'therapy', 'self care'] },
  { id: 'dogs', name: 'Dog Lovers', keywords: ['dog', 'puppy', 'dog mom', 'dog dad'] },
  { id: 'science', name: 'Science/Space', keywords: ['science', 'space', 'nasa', 'astronomy', 'physics'] },
  { id: 'crypto', name: 'Crypto', keywords: ['crypto', 'bitcoin', 'ethereum', 'blockchain', 'hodl'] },
  { id: 'entrepreneur', name: 'Entrepreneurs', keywords: ['entrepreneur', 'startup', 'hustle', 'founder'] },
  { id: 'ai', name: 'AI/Developers', keywords: ['ai', 'coding', 'developer', 'programmer', 'tech'] }
];

export class TrendDetector {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    this.scoreThreshold = parseInt(
      db.prepare(`SELECT value FROM system_state WHERE key = 'trend_score_threshold'`).get()?.value || '70'
    );

    // Progress callback for live updates
    this.onProgress = null;
  }

  /**
   * Scan for trending opportunities
   * @param {string} nicheFilter - Optional: only scan specific niche
   * @param {function} onProgress - Callback for progress updates
   * @returns {Array} Array of opportunity objects
   */
  async scan(nicheFilter = null, onProgress = null) {
    this.onProgress = onProgress;
    console.log('Starting trend scan...');

    const nichesToScan = nicheFilter
      ? NICHES.filter(n => n.id === nicheFilter || n.name.toLowerCase().includes(nicheFilter.toLowerCase()))
      : NICHES.slice(0, 5); // Only scan first 5 niches to avoid timeout

    const allOpportunities = [];
    const total = nichesToScan.length;

    for (let i = 0; i < nichesToScan.length; i++) {
      const niche = nichesToScan[i];
      try {
        await this.reportProgress(`📡 [${i + 1}/${total}] Scanning ${niche.name}...`);
        const opportunities = await this.scanNiche(niche);
        allOpportunities.push(...opportunities);

        if (opportunities.length > 0) {
          await this.reportProgress(`   ✓ Found ${opportunities.length} opportunity(s)`);
        }
      } catch (error) {
        console.error(`Error scanning ${niche.name}:`, error.message);
        await this.reportProgress(`   ⚠️ ${niche.name}: ${error.message}`);
      }
    }

    // Sort by score and filter by threshold
    const filtered = allOpportunities
      .filter(opp => opp.score >= this.scoreThreshold)
      .sort((a, b) => b.score - a.score);

    console.log(`Found ${filtered.length} opportunities above threshold`);
    await this.reportProgress(`\n✅ Scan complete! Found ${filtered.length} opportunities above ${this.scoreThreshold}% threshold`);

    return filtered;
  }

  async reportProgress(message) {
    console.log(message);
    if (this.onProgress) {
      try {
        await this.onProgress(message);
      } catch (e) {
        // Ignore progress reporting errors
      }
    }
  }

  /**
   * Scan a specific niche
   */
  async scanNiche(niche) {
    console.log(`Scanning niche: ${niche.name}`);

    // Gather data from multiple sources (in parallel for speed)
    const [twitterData, keywordData, googleData] = await Promise.all([
      this.scanTwitter(niche),
      this.scanDataForSEO(niche),
      this.scanGoogleTrends(niche)
    ]);

    // Combine and analyze with Claude
    const opportunities = await this.analyzeWithClaude(niche, {
      twitter: twitterData,
      keywords: keywordData,
      google: googleData
    });

    return opportunities;
  }

  /**
   * Scan Twitter/X for trending topics
   */
  async scanTwitter(niche) {
    if (!process.env.X_BEARER_TOKEN) {
      console.log('X/Twitter API not configured, skipping...');
      return [];
    }

    try {
      const searchQuery = niche.keywords.map(k => `"${k}" shirt OR "${k}" tee`).join(' OR ');

      const response = await fetch(
        `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(searchQuery)}&max_results=50&tweet.fields=public_metrics,created_at`,
        {
          headers: {
            'Authorization': `Bearer ${process.env.X_BEARER_TOKEN}`
          }
        }
      );

      if (!response.ok) {
        throw new Error(`Twitter API error: ${response.status}`);
      }

      const data = await response.json();

      // Extract trending phrases and engagement
      const trends = this.extractTwitterTrends(data.data || []);
      return trends;
    } catch (error) {
      console.error('Twitter scan error:', error.message);
      return [];
    }
  }

  /**
   * Extract trending phrases from tweets
   */
  extractTwitterTrends(tweets) {
    const phraseCount = {};

    for (const tweet of tweets) {
      // Simple phrase extraction (can be enhanced)
      const words = tweet.text
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 3);

      // Count 2-3 word phrases
      for (let i = 0; i < words.length - 1; i++) {
        const phrase = `${words[i]} ${words[i + 1]}`;
        phraseCount[phrase] = (phraseCount[phrase] || 0) + 1;

        if (i < words.length - 2) {
          const triPhrase = `${words[i]} ${words[i + 1]} ${words[i + 2]}`;
          phraseCount[triPhrase] = (phraseCount[triPhrase] || 0) + 1;
        }
      }
    }

    // Return top phrases
    return Object.entries(phraseCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([phrase, count]) => ({
        phrase,
        count,
        platform: 'twitter'
      }));
  }

  /**
   * Get keyword suggestions from DataForSEO
   */
  async scanDataForSEO(niche) {
    if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
      console.log('DataForSEO not configured, skipping...');
      return [];
    }

    try {
      const searchQuery = `${niche.keywords[0]} t-shirt`;
      const auth = Buffer.from(
        `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
      ).toString('base64');

      const response = await fetch(
        'https://api.dataforseo.com/v3/keywords_data/google_ads/keywords_for_keywords/live',
        {
          method: 'POST',
          headers: {
            'Authorization': `Basic ${auth}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify([{
            keywords: [searchQuery],
            language_code: 'en',
            location_code: 2840, // US
            include_seed_keyword: true,
            include_serp_info: false,
            limit: 20
          }])
        }
      );

      if (!response.ok) {
        throw new Error(`DataForSEO API error: ${response.status}`);
      }

      const data = await response.json();
      const keywords = data.tasks?.[0]?.result?.[0]?.items || [];

      return keywords.map(kw => ({
        keyword: kw.keyword,
        volume: kw.search_volume,
        competition: kw.competition,
        cpc: kw.cpc,
        platform: 'dataforseo'
      }));
    } catch (error) {
      console.error('DataForSEO scan error:', error.message);
      return [];
    }
  }

  /**
   * Scan Google Trends
   */
  async scanGoogleTrends(niche) {
    // Note: Google Trends doesn't have an official API
    // This is a placeholder - you can use google-trends-api npm package
    // or scrape trends.google.com

    try {
      // For now, return placeholder data
      // In production, integrate with google-trends-api package
      return [
        {
          keyword: niche.keywords[0],
          trend: 'rising',
          platform: 'google'
        }
      ];
    } catch (error) {
      console.error('Google Trends error:', error.message);
      return [];
    }
  }

  /**
   * Analyze gathered data with Claude to identify opportunities
   */
  async analyzeWithClaude(niche, data) {
    const prompt = `You are a POD (Print-on-Demand) trend analyst for TRESR.com, a t-shirt company.

Analyze this data from the "${niche.name}" niche and identify the best t-shirt design opportunities.

DATA:
Twitter trending phrases:
${JSON.stringify(data.twitter.slice(0, 10), null, 2)}

Keyword Research (DataForSEO - search volume & competition):
${JSON.stringify(data.keywords.slice(0, 10), null, 2)}

Google Trends:
${JSON.stringify(data.google, null, 2)}

For each opportunity you identify, provide:
1. A catchy concept name (what would go on the shirt)
2. A score from 0-100 based on:
   - Trend velocity (how fast it's growing)
   - Market size (how many people care about this)
   - Merchandise potential (would people wear this?)
   - Competition level (inverted - less competition = higher score)
3. 2-3 specific design ideas
4. Estimated revenue potential ($/month)

Return as JSON array:
[
  {
    "concept": "Design concept or text",
    "score": 85,
    "niche": "${niche.id}",
    "sources": [{"platform": "twitter", "details": "trending phrase with X mentions"}],
    "suggestedDesigns": ["Design idea 1", "Design idea 2"],
    "estimatedPotential": "500-2000",
    "reasoning": "Brief explanation of why this would sell"
  }
]

Only return opportunities with genuine potential. If nothing looks promising, return an empty array.
Return ONLY the JSON array, no other text.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      });

      const text = response.content[0].text;

      // Parse JSON from response
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const opportunities = JSON.parse(jsonMatch[0]);
        return opportunities.filter(opp => opp.score >= 50);
      }

      return [];
    } catch (error) {
      console.error('Claude analysis error:', error.message);
      return [];
    }
  }

  /**
   * Get list of niches
   */
  getNiches() {
    return NICHES;
  }

  /**
   * Set score threshold
   */
  setThreshold(threshold) {
    this.scoreThreshold = threshold;
    db.prepare(`UPDATE system_state SET value = ? WHERE key = 'trend_score_threshold'`).run(String(threshold));
  }
}

export default TrendDetector;
