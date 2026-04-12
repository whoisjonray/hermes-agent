/**
 * Design Researcher Module
 * Scrapes and analyzes t-shirt designs from X, ads, and marketplaces
 * Builds a database of proven design styles and patterns
 */

import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { db } from '../services/database.js';

export class DesignResearcher {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    this.bearerToken = process.env.X_BEARER_TOKEN;
  }

  /**
   * Research trending t-shirt designs for a niche
   * Returns analyzed design patterns with image examples
   */
  async researchDesigns(niche, onProgress = null) {
    const report = (msg) => onProgress && onProgress(msg);

    report(`🔬 Researching ${niche} t-shirt designs...`);

    // 1. Search X for t-shirt images in this niche
    const xImages = await this.searchXForDesigns(niche);
    report(`   Found ${xImages.length} design images on X`);

    // 2. Analyze images with Claude Vision to extract patterns
    const patterns = await this.analyzeDesignPatterns(xImages, niche);
    report(`   Extracted ${patterns.length} design patterns`);

    // 3. Get historical performance data from our database
    const historicalData = this.getHistoricalPerformance(niche);

    // 4. Synthesize into actionable design guidance
    const designGuidance = await this.synthesizeGuidance(patterns, historicalData, niche);

    // 5. Store patterns for future use
    this.storePatterns(niche, patterns, designGuidance);

    return {
      niche,
      imagesSampled: xImages.length,
      patterns,
      guidance: designGuidance,
      topStyles: designGuidance.topStyles || []
    };
  }

  /**
   * Search X for t-shirt design images
   */
  async searchXForDesigns(niche) {
    if (!this.bearerToken) {
      console.log('X API not configured');
      return [];
    }

    try {
      // Search for t-shirt designs with images
      const queries = [
        `${niche} t-shirt design has:images`,
        `${niche} tee shirt merch has:images`,
        `${niche} shirt mockup has:images`,
        `"${niche}" apparel design has:images`
      ];

      const allImages = [];

      for (const query of queries.slice(0, 2)) { // Limit to avoid rate limits
        const response = await fetch(
          `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=20&tweet.fields=created_at,public_metrics&expansions=attachments.media_keys&media.fields=url,preview_image_url,type`,
          {
            headers: {
              'Authorization': `Bearer ${this.bearerToken}`
            }
          }
        );

        if (!response.ok) {
          console.log(`X API error: ${response.status}`);
          continue;
        }

        const data = await response.json();

        // Extract media URLs
        const mediaMap = {};
        if (data.includes?.media) {
          for (const media of data.includes.media) {
            if (media.type === 'photo') {
              mediaMap[media.media_key] = media.url || media.preview_image_url;
            }
          }
        }

        // Match tweets to images
        if (data.data) {
          for (const tweet of data.data) {
            const mediaKeys = tweet.attachments?.media_keys || [];
            for (const key of mediaKeys) {
              if (mediaMap[key]) {
                allImages.push({
                  imageUrl: mediaMap[key],
                  tweetText: tweet.text,
                  engagement: tweet.public_metrics,
                  tweetId: tweet.id
                });
              }
            }
          }
        }
      }

      return allImages.slice(0, 10); // Limit for API costs
    } catch (error) {
      console.error('X image search error:', error.message);
      return [];
    }
  }

  /**
   * Analyze design patterns using Claude Vision
   */
  async analyzeDesignPatterns(images, niche) {
    if (images.length === 0) {
      // Return default patterns if no images found
      return this.getDefaultPatterns(niche);
    }

    const patterns = [];

    for (const img of images.slice(0, 5)) { // Analyze up to 5 images
      try {
        // Fetch image and convert to base64
        const imageResponse = await fetch(img.imageUrl);
        const imageBuffer = await imageResponse.arrayBuffer();
        const base64Image = Buffer.from(imageBuffer).toString('base64');
        const mediaType = img.imageUrl.includes('.png') ? 'image/png' : 'image/jpeg';

        const response = await this.anthropic.messages.create({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 1000,
          messages: [{
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Image
                }
              },
              {
                type: 'text',
                text: `Analyze this t-shirt design image. Extract:
1. Typography style (font type, weight, case)
2. Color palette (primary, secondary, accent)
3. Layout/composition (centered, offset, full-bleed)
4. Design elements (icons, illustrations, photos, text-only)
5. Humor/tone (sarcastic, wholesome, edgy, minimalist)
6. Production complexity (simple screen print vs DTG vs embroidery)

Return as JSON:
{
  "typography": {"style": "", "weight": "", "case": ""},
  "colors": {"primary": "", "secondary": "", "palette_type": ""},
  "layout": "",
  "elements": [],
  "tone": "",
  "complexity": "",
  "sellability_score": 0-100,
  "key_insight": "one sentence on why this design works or doesn't"
}`
              }
            ]
          }]
        });

        const text = response.content[0].text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const pattern = JSON.parse(jsonMatch[0]);
          pattern.sourceUrl = img.imageUrl;
          pattern.engagement = img.engagement;
          patterns.push(pattern);
        }
      } catch (error) {
        console.error('Image analysis error:', error.message);
      }
    }

    return patterns.length > 0 ? patterns : this.getDefaultPatterns(niche);
  }

  /**
   * Get default patterns for a niche when no images found
   */
  getDefaultPatterns(niche) {
    const defaults = {
      coffee: {
        typography: { style: 'bold sans-serif', weight: 'heavy', case: 'mixed' },
        colors: { primary: 'brown', secondary: 'cream', palette_type: 'warm earth tones' },
        layout: 'centered with icon above text',
        elements: ['coffee cup icon', 'steam wisps', 'coffee beans'],
        tone: 'self-deprecating humor',
        complexity: 'simple screen print',
        sellability_score: 75
      },
      fitness: {
        typography: { style: 'athletic block', weight: 'black', case: 'uppercase' },
        colors: { primary: 'black', secondary: 'neon', palette_type: 'high contrast' },
        layout: 'bold centered text',
        elements: ['dumbbells', 'motivational phrases', 'geometric shapes'],
        tone: 'motivational/aggressive',
        complexity: 'simple screen print',
        sellability_score: 70
      },
      gaming: {
        typography: { style: 'pixel/retro', weight: 'medium', case: 'mixed' },
        colors: { primary: 'black', secondary: 'RGB colors', palette_type: 'neon on dark' },
        layout: 'graphic-heavy',
        elements: ['controllers', 'pixel art', 'game references'],
        tone: 'nostalgic/humorous',
        complexity: 'DTG for complex graphics',
        sellability_score: 72
      }
    };

    return [defaults[niche] || defaults.coffee];
  }

  /**
   * Get historical performance data from database
   */
  getHistoricalPerformance(niche) {
    try {
      const approvedDesigns = db.prepare(`
        SELECT * FROM design_feedback
        WHERE niche = ? AND feedback = 'approved'
        ORDER BY created_at DESC LIMIT 20
      `).all(niche);

      const rejectedDesigns = db.prepare(`
        SELECT * FROM design_feedback
        WHERE niche = ? AND feedback = 'rejected'
        ORDER BY created_at DESC LIMIT 20
      `).all(niche);

      return { approved: approvedDesigns, rejected: rejectedDesigns };
    } catch (error) {
      return { approved: [], rejected: [] };
    }
  }

  /**
   * Synthesize research into actionable design guidance
   */
  async synthesizeGuidance(patterns, historicalData, niche) {
    const prompt = `You are a POD (print-on-demand) design strategist. Based on this research data, create actionable design guidance.

NICHE: ${niche}

ANALYZED DESIGN PATTERNS FROM X:
${JSON.stringify(patterns, null, 2)}

HISTORICAL PERFORMANCE (what we've learned works/doesn't work):
Approved designs: ${historicalData.approved.length}
Rejected designs: ${historicalData.rejected.length}
${JSON.stringify(historicalData.approved.slice(0, 5), null, 2)}

Create a design guidance document:
{
  "topStyles": [
    {
      "name": "Style name",
      "description": "When to use this style",
      "typography": "specific font recommendations",
      "colors": "specific hex codes or color names",
      "layout": "specific composition rules",
      "examplePrompt": "A DALL-E prompt that would generate this style"
    }
  ],
  "avoidPatterns": ["things that don't work"],
  "nicheSpecificTips": ["tips for this specific niche"],
  "currentTrend": "what's hot right now based on the data",
  "recommendedPromptTemplate": "A template DALL-E prompt incorporating best practices"
}

Return ONLY the JSON.`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 2000,
        messages: [{ role: 'user', content: prompt }]
      });

      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (error) {
      console.error('Synthesis error:', error.message);
    }

    // Return default guidance
    return {
      topStyles: [{
        name: 'Classic Text Tee',
        description: 'Simple, bold text designs',
        typography: 'Bold sans-serif, uppercase',
        colors: 'Black on white or white on black',
        layout: 'Centered, single line or stacked',
        examplePrompt: `A minimalist t-shirt design with bold typography saying "[TEXT]" in black on white background, centered composition, clean and simple`
      }],
      avoidPatterns: ['overly complex designs', 'tiny text', 'too many colors'],
      nicheSpecificTips: ['Keep it relatable', 'Use insider humor'],
      currentTrend: 'Minimalist designs with bold typography',
      recommendedPromptTemplate: `A ${niche}-themed t-shirt design, minimalist style, bold typography, [CONCEPT], centered composition, print-ready, high contrast`
    };
  }

  /**
   * Store patterns in database for learning
   */
  storePatterns(niche, patterns, guidance) {
    try {
      db.prepare(`
        INSERT OR REPLACE INTO design_patterns (niche, patterns, guidance, updated_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(niche, JSON.stringify(patterns), JSON.stringify(guidance));
    } catch (error) {
      console.error('Error storing patterns:', error.message);
    }
  }

  /**
   * Get stored patterns for a niche
   */
  getStoredPatterns(niche) {
    try {
      const row = db.prepare('SELECT * FROM design_patterns WHERE niche = ?').get(niche);
      if (row) {
        return {
          patterns: JSON.parse(row.patterns),
          guidance: JSON.parse(row.guidance),
          updatedAt: row.updated_at
        };
      }
    } catch (error) {
      console.error('Error getting patterns:', error.message);
    }
    return null;
  }

  /**
   * Record feedback on a design for learning
   */
  recordFeedback(designId, niche, feedback, designData) {
    try {
      db.prepare(`
        INSERT INTO design_feedback (design_id, niche, feedback, design_data, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(designId, niche, feedback, JSON.stringify(designData));
    } catch (error) {
      console.error('Error recording feedback:', error.message);
    }
  }
}

export default DesignResearcher;
