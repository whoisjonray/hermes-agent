/**
 * Design Generator Module
 * Creates design briefs and generates artwork for POD products
 *
 * DATA-DRIVEN: All design decisions based on verified X API data
 * LEARNING SYSTEM: Tracks metrics and improves over time
 */

import Anthropic from '@anthropic-ai/sdk';
import { v2 as cloudinary } from 'cloudinary';
import { db, incrementMetric } from '../services/database.js';
import { generateMockup, generateColorVariants } from '../services/mockupService.js';
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Load style profile configuration
let styleProfile = {};
const styleProfilePath = join(__dirname, '..', '..', 'config', 'design-style-profile.json');
if (existsSync(styleProfilePath)) {
  try {
    styleProfile = JSON.parse(readFileSync(styleProfilePath, 'utf8'));
    console.log('Loaded design style profile');
  } catch (e) {
    console.log('Could not load style profile:', e.message);
  }
}

export class DesignGenerator {
  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY
    });

    this.bearerToken = process.env.X_BEARER_TOKEN;
    this.geminiKey = process.env.GEMINI_API_KEY;

    // Configure Cloudinary for artwork storage
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });
    }

    // Metrics tracking
    this.metrics = {
      designsGenerated: 0,
      designsApproved: 0,
      designsRejected: 0,
      regenerations: 0
    };
  }

  /**
   * Research REAL t-shirt designs from X API
   * NO GUESSING - only verified data
   */
  async researchRealDesigns(niche, onProgress = null) {
    const report = (msg) => onProgress && onProgress(msg);

    if (!this.bearerToken) {
      throw new Error('X API not configured - cannot get real data');
    }

    report(`🔍 Fetching real t-shirt data from X for "${niche}"...`);

    const realData = {
      tweetImages: [],
      engagementData: [],
      trendingPhrases: [],
      analyzedAt: new Date().toISOString()
    };

    // Search for actual t-shirt posts with images
    const queries = [
      `${niche} shirt design has:images`,
      `${niche} tee merch has:images`,
      `#${niche.replace(/\s+/g, '')}shirt has:images`
    ];

    for (const query of queries) {
      try {
        const response = await fetch(
          `https://api.twitter.com/2/tweets/search/recent?query=${encodeURIComponent(query)}&max_results=20&tweet.fields=created_at,public_metrics&expansions=attachments.media_keys&media.fields=url,preview_image_url,type`,
          {
            headers: { 'Authorization': `Bearer ${this.bearerToken}` }
          }
        );

        if (!response.ok) continue;
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

        // Collect tweet data with engagement
        if (data.data) {
          for (const tweet of data.data) {
            const mediaKeys = tweet.attachments?.media_keys || [];
            for (const key of mediaKeys) {
              if (mediaMap[key]) {
                realData.tweetImages.push({
                  imageUrl: mediaMap[key],
                  text: tweet.text,
                  likes: tweet.public_metrics?.like_count || 0,
                  retweets: tweet.public_metrics?.retweet_count || 0,
                  replies: tweet.public_metrics?.reply_count || 0,
                  engagement: (tweet.public_metrics?.like_count || 0) +
                              (tweet.public_metrics?.retweet_count || 0) * 2
                });
              }
            }

            // Extract trending phrases
            realData.engagementData.push({
              text: tweet.text,
              engagement: tweet.public_metrics
            });
          }
        }
      } catch (error) {
        console.error(`Query error: ${error.message}`);
      }
    }

    // Sort by engagement
    realData.tweetImages.sort((a, b) => b.engagement - a.engagement);

    report(`   Found ${realData.tweetImages.length} real design images`);
    report(`   Top engagement: ${realData.tweetImages[0]?.engagement || 0} interactions`);

    // Store research data
    this.storeResearchData(niche, realData);

    return realData;
  }

  /**
   * Store research data for learning
   */
  storeResearchData(niche, data) {
    try {
      db.prepare(`
        INSERT INTO design_research (niche, data, image_count, top_engagement, created_at)
        VALUES (?, ?, ?, ?, datetime('now'))
      `).run(niche, JSON.stringify(data), data.tweetImages.length, data.tweetImages[0]?.engagement || 0);
    } catch (error) {
      // Table might not exist yet, that's ok
      console.log('Research storage skipped:', error.message);
    }
  }

  /**
   * Generate a complete design from a trend opportunity
   * @param {Object} trend - Trend opportunity object
   * @returns {Object} Design object with brief, mockups, and artwork URL
   */
  async generateDesign(trend) {
    console.log(`Generating design for: ${trend.concept}`);

    // Step 1: Generate detailed design brief
    const brief = await this.generateBrief(trend);

    // Step 2: Generate the actual artwork
    // Note: This requires an image generation API
    // Options: DALL-E, Midjourney API, Ideogram, Stable Diffusion
    const artwork = await this.generateArtwork(brief);

    // Step 3: Create mockups
    const mockups = await this.generateMockups(artwork);

    // Store design in database
    const designId = `design_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    db.prepare(`
      INSERT INTO products (id, title, niche, design_url, artwork_url, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'pending', datetime('now'))
    `).run(
      designId,
      brief.title,
      trend.niche,
      JSON.stringify(mockups),
      artwork.url
    );

    return {
      id: designId,
      brief,
      artwork,
      mockups,
      trend
    };
  }

  /**
   * Generate a detailed design brief using Claude
   * Incorporates REAL TREND DATA from X API for data-driven designs
   */
  async generateBrief(trend) {
    // Extract real data from trend research
    const researchData = trend.researchData || {};
    const topEngagementPhrases = researchData.engagementData?.slice(0, 5).map(d => d.text) || [];

    const prompt = `You are a senior t-shirt designer creating a design brief for TRESR.com.

TREND OPPORTUNITY:
Concept: ${trend.concept}
Niche: ${trend.niche}
Design Ideas: ${trend.suggestedDesigns?.join(', ') || 'Open to interpretation'}
Reasoning: ${trend.reasoning || 'Trending topic'}
${trend.userFeedback ? `User Feedback: ${trend.userFeedback}` : ''}
${trend.previousAttempt ? `Previous design title (needs improvement): ${trend.previousAttempt}` : ''}

REAL TREND DATA FROM X API:
- Top engagement images found: ${researchData.tweetImages?.length || 0}
- Highest engagement: ${researchData.tweetImages?.[0]?.engagement || 'N/A'} interactions
${topEngagementPhrases.length > 0 ? `- Viral phrases: ${topEngagementPhrases.slice(0, 3).join(' | ')}` : ''}

CRITICAL DESIGN REQUIREMENTS:
1. The design will be generated as ISOLATED ARTWORK on a solid black background
2. The background will be removed and composited onto a t-shirt template
3. Design must be high-contrast (white on black preferred)
4. Must work when printed on both black and white shirts
5. NO gradients - solid fills only
6. Bold, clean, vector-style graphics

Create a detailed design brief:

1. TITLE: A catchy product title (good for SEO and appeal)

2. DESIGN TYPE: Choose one:
   - Typography (bold text, minimal graphics)
   - Illustration (character or object focused)
   - Vintage/Retro (distressed, nostalgic)
   - Minimalist (clean, simple, modern)
   - Meme/Cultural (recognizable format)

3. VISUAL DESCRIPTION: Exactly what the isolated artwork shows
   - Main elements
   - Text content (exact words - short and punchy, 1-5 words ideal)
   - Layout and positioning (centered, stacked, etc.)

4. COLOR PALETTE:
   - Primary: White (#FFFFFF) for main elements (standard)
   - Secondary: One accent color if needed
   - REMEMBER: Design will be on BLACK background, then removed

5. STYLE NOTES:
   - Font style (bold sans-serif recommended)
   - Line weight (bold, medium, thin)
   - Level of detail (keep it simple for print)

Return as JSON:
{
  "title": "Product title for Shopify",
  "designType": "typography|illustration|vintage|minimalist|meme",
  "visualDescription": "Detailed description of what to create",
  "textContent": "Exact text if any (1-5 words ideal)",
  "colorPalette": {
    "primary": "#FFFFFF",
    "secondary": "#hex or null",
    "worksOn": ["black", "white"]
  },
  "styleNotes": "Font and style details",
  "placement": "front",
  "imagePrompt": "A detailed prompt for generating the ISOLATED ARTWORK on black background. Be specific about composition, style, and that it should NOT include any t-shirt or clothing."
}`;

    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1500,
        messages: [{ role: 'user', content: prompt }]
      });

      const text = response.content[0].text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const brief = JSON.parse(jsonMatch[0]);
        // Add niche and trend data to brief for downstream use
        brief.niche = trend.niche;
        brief.trendData = {
          topPhrases: topEngagementPhrases,
          topEngagement: researchData.tweetImages?.[0]?.engagement,
          imageCount: researchData.tweetImages?.length
        };
        return brief;
      }

      throw new Error('Failed to parse design brief');
    } catch (error) {
      console.error('Brief generation error:', error.message);
      throw error;
    }
  }

  /**
   * Generate artwork using AI image generation
   * Tries Gemini Imagen first, falls back to DALL-E
   */
  async generateArtwork(brief, onProgress = null) {
    const report = (msg) => onProgress && onProgress(msg);
    report('🎨 Generating design artwork...');

    // Try Gemini Imagen first (if configured)
    if (this.geminiKey) {
      try {
        report('   Using Gemini Imagen...');
        return await this.generateWithGemini(brief);
      } catch (error) {
        report(`   Gemini failed: ${error.message}, trying DALL-E...`);
      }
    }

    // Fall back to DALL-E
    if (process.env.OPENAI_API_KEY) {
      report('   Using DALL-E 3...');
      return await this.generateWithDalle(brief);
    }

    throw new Error('No image generation API configured (need GEMINI_API_KEY or OPENAI_API_KEY)');
  }

  /**
   * Generate with Google Gemini Image Generation
   * Using Gemini 2.0 Flash (imagen) for image generation
   * CRITICAL: Generate ISOLATED DESIGN ONLY - no t-shirt, no mockup
   */
  async generateWithGemini(brief) {
    // Get learned prompt improvements
    const promptGuidance = this.getPromptGuidance(brief.designType);

    // Build the BALLN-style prompt for isolated artwork
    const prompt = this.buildIsolatedDesignPrompt(brief, promptGuidance);

    try {
      // Use Gemini 2.0 Flash for image generation
      const model = 'gemini-2.0-flash-exp';

      console.log('Gemini prompt:', prompt.substring(0, 200) + '...');

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': this.geminiKey
          },
          body: JSON.stringify({
            contents: [{
              parts: [{ text: prompt }]
            }],
            generationConfig: {
              responseModalities: ['IMAGE', 'TEXT']
            }
          })
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Extract image from Gemini generateContent response
      let imageBytes = null;

      if (data.candidates?.[0]?.content?.parts) {
        for (const part of data.candidates[0].content.parts) {
          if (part.inlineData?.mimeType?.startsWith('image/')) {
            imageBytes = part.inlineData.data;
            break;
          }
        }
      }

      if (!imageBytes) {
        // Log what we got for debugging
        console.log('Gemini/Imagen response:', JSON.stringify(data, null, 2).slice(0, 500));
        throw new Error('No image returned from Gemini/Imagen');
      }

      // Upload base64 image to Cloudinary
      if (process.env.CLOUDINARY_CLOUD_NAME) {
        const uploaded = await cloudinary.uploader.upload(
          `data:image/png;base64,${imageBytes}`,
          {
            folder: 'tresr/designs',
            public_id: `design_gemini_${Date.now()}`
          }
        );

        return {
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
          status: 'generated',
          generator: 'imagen-3',
          prompt
        };
      }

      // Return base64 data URL if no Cloudinary
      return {
        url: `data:image/png;base64,${imageBytes}`,
        status: 'generated_temp',
        generator: 'imagen-3',
        prompt
      };
    } catch (error) {
      console.error('Gemini generation error:', error.message);
      throw error;
    }
  }

  /**
   * Generate artwork with DALL-E
   * CRITICAL: Generate ISOLATED DESIGN ONLY - no t-shirt, no mockup
   * The design will be composited onto t-shirt template separately using PIL
   */
  async generateWithDalle(brief) {
    try {
      // Get learned prompt improvements from database
      const promptGuidance = this.getPromptGuidance(brief.designType);

      // Build optimized prompt for ISOLATED ARTWORK ONLY
      const prompt = this.buildIsolatedDesignPrompt(brief, promptGuidance);

      console.log('DALL-E Prompt:', prompt);

      const response = await fetch('https://api.openai.com/v1/images/generations', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'dall-e-3',
          prompt,
          n: 1,
          size: '1024x1024',
          quality: 'hd'
        })
      });

      const data = await response.json();

      if (data.error) {
        throw new Error(data.error.message);
      }

      const imageUrl = data.data[0].url;

      // Upload to Cloudinary for permanent storage
      if (process.env.CLOUDINARY_CLOUD_NAME) {
        const uploaded = await cloudinary.uploader.upload(imageUrl, {
          folder: 'tresr/designs',
          public_id: `design_${Date.now()}`
        });
        return {
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
          status: 'generated',
          prompt // Store prompt for learning
        };
      }

      return {
        url: imageUrl,
        status: 'generated_temp',
        prompt
      };
    } catch (error) {
      console.error('DALL-E generation error:', error.message);
      throw error;
    }
  }

  /**
   * Build prompt for ISOLATED design artwork using BALLN's proven format
   * CRITICAL: This generates the GRAPHIC ONLY, not a t-shirt mockup
   */
  buildIsolatedDesignPrompt(brief, guidance = {}) {
    // BALLN-style prompt format that WORKS:
    // "Bold geometric typography '[TEXT]' in angular sans-serif font,
    //  white design on solid black background, high-contrast vector style,
    //  clean sharp letterforms, solid fill no gradients, screen print ready t-shirt graphic"

    const designTypeMap = {
      'typography': 'Bold typography',
      'illustration': 'Clean vector illustration',
      'vintage': 'Vintage distressed graphic',
      'minimalist': 'Minimalist icon design',
      'meme': 'Bold graphic'
    };

    const designType = designTypeMap[brief.designType] || 'Bold graphic design';
    const textPart = brief.textContent ? `'${brief.textContent.toUpperCase()}'` : '';
    const colorPart = brief.colorPalette?.primary || 'white';

    // Build BALLN-style prompt - PROVEN TO WORK
    let prompt = `${designType} ${textPart} in bold sans-serif font, ${colorPart} design on solid black background, high-contrast vector style, clean sharp edges, solid fill no gradients, screen print ready graphic`;

    // Add visual description if provided
    if (brief.visualDescription) {
      prompt += `. ${brief.visualDescription}`;
    }

    // Add style notes
    if (brief.styleNotes) {
      prompt += `. Style: ${brief.styleNotes}`;
    }

    // Add learned improvements from user feedback
    if (guidance.improvements) {
      prompt += `. ${guidance.improvements}`;
    }

    console.log('BALLN-style prompt:', prompt);

    return prompt;
  }

  /**
   * Get category-specific style profile (like BALLN's basketball category)
   */
  getCategoryStyleProfile(category) {
    const categoryMap = {
      'coffee': 'coffee',
      'Coffee Culture': 'coffee',
      'caffeine': 'coffee',
      'lifestyle': 'lifestyle',
      'fitness': 'lifestyle',
      'gaming': 'lifestyle',
      'vintage': 'vintage',
      'retro': 'vintage'
    };

    const profileKey = categoryMap[category] || 'default';
    return styleProfile.styleProfiles?.[profileKey] || styleProfile.styleProfiles?.default || {};
  }

  /**
   * Build JSON style specification like BALLN approach
   */
  buildJsonStyleSpec(brief, categoryProfile, baseProfile) {
    return {
      styleProfile: {
        name: categoryProfile.name || baseProfile.name || 'TRESR Vector Style',
        description: categoryProfile.description || baseProfile.description,
        visualCharacteristics: {
          colorScheme: {
            background: '#000000',
            foreground: brief.colorPalette?.primary || '#FFFFFF',
            accent: brief.colorPalette?.secondary || categoryProfile.visualCharacteristics?.colorScheme?.accent
          },
          lineQuality: baseProfile.visualCharacteristics?.lineQuality || 'Smooth vector transitions, no jagged edges',
          edgeStyle: baseProfile.visualCharacteristics?.edgeStyle || 'Clean with refined transitions',
          fillType: baseProfile.visualCharacteristics?.fillType || 'Solid fill (no gradients)',
          contrast: 'High-contrast'
        },
        subjectMatter: {
          type: brief.designType || 'Typography',
          concept: brief.imagePrompt,
          text: brief.textContent,
          category: brief.niche
        },
        designDirectives: {
          geometry: baseProfile.designDirectives?.geometry || 'Use clean shapes',
          balance: 'Maintain visual balance between design weight and negative space',
          sizing: 'Fits within a square composition; centered with minimal margin',
          typography: brief.styleNotes || 'Bold sans-serif for text elements'
        },
        fileGuidelines: {
          resolution: '1024x1024px',
          background: 'Solid black only (#000000)',
          transparency: false
        }
      }
    };
  }

  /**
   * Get prompt guidance learned from user feedback
   */
  getPromptGuidance(designType) {
    try {
      const pattern = db.prepare(`
        SELECT patterns, guidance FROM design_patterns WHERE niche = ?
      `).get(designType);

      if (pattern) {
        return JSON.parse(pattern.guidance || '{}');
      }
    } catch (e) {
      // Table might not exist
    }
    return {};
  }

  /**
   * Update prompt guidance based on user feedback
   * Called when designs are approved/rejected
   */
  updatePromptGuidance(designType, feedback, wasApproved) {
    try {
      // Get existing guidance
      const existing = this.getPromptGuidance(designType);

      // Track what works and what doesn't
      if (!existing.approvedStyles) existing.approvedStyles = [];
      if (!existing.rejectedStyles) existing.rejectedStyles = [];
      if (!existing.feedbackNotes) existing.feedbackNotes = [];

      if (wasApproved) {
        existing.approvedStyles.push(feedback.style);
      } else {
        existing.rejectedStyles.push(feedback.style);
        if (feedback.reason) {
          existing.feedbackNotes.push(feedback.reason);
        }
      }

      // Generate improvement notes from patterns
      const improvements = this.generateImprovements(existing);
      existing.improvements = improvements;

      // Save back to database
      db.prepare(`
        INSERT OR REPLACE INTO design_patterns (niche, patterns, guidance, updated_at)
        VALUES (?, ?, ?, datetime('now'))
      `).run(designType, JSON.stringify(existing.approvedStyles), JSON.stringify(existing));

      console.log(`Updated prompt guidance for ${designType}:`, improvements);
    } catch (e) {
      console.log('Could not update prompt guidance:', e.message);
    }
  }

  /**
   * Generate improvement suggestions from feedback patterns
   */
  generateImprovements(guidance) {
    const notes = [];

    if (guidance.rejectedStyles?.length > 0) {
      notes.push(`Avoid: ${guidance.rejectedStyles.slice(-3).join(', ')}`);
    }

    if (guidance.feedbackNotes?.length > 0) {
      notes.push(`User preferences: ${guidance.feedbackNotes.slice(-3).join('; ')}`);
    }

    if (guidance.approvedStyles?.length > 0) {
      notes.push(`Works well: ${guidance.approvedStyles.slice(-3).join(', ')}`);
    }

    return notes.join('. ');
  }

  /**
   * Generate product mockups using BALLN-style PIL compositing
   * Composites design onto t-shirt template
   */
  async generateMockups(artwork, onProgress = null) {
    const report = (msg) => onProgress && onProgress(msg);

    if (!artwork.url) {
      return {
        status: 'pending',
        mockups: []
      };
    }

    report('🖼️ Generating mockup with PIL compositor...');

    try {
      // Generate mockup using Python PIL script
      const mockup = await generateMockup({
        designUrl: artwork.url,
        outputName: `mockup_${Date.now()}`,
        settings: {
          width: 0.35,      // Design takes 35% of template width
          yOffset: 340,     // Positioned on chest area
          bgMode: 'black',  // Remove dark backgrounds from AI designs
          threshold: 35
        }
      });

      report(`   ✅ Mockup generated: ${mockup.status}`);

      return {
        status: 'completed',
        designUrl: artwork.url,
        mockups: [
          {
            type: 'tshirt_white_front',
            url: mockup.url,
            publicId: mockup.publicId,
            status: mockup.status
          }
        ]
      };
    } catch (error) {
      console.error('Mockup generation error:', error.message);
      report(`   ⚠️ Mockup failed: ${error.message}`);

      // Return pending status if mockup fails
      return {
        status: 'mockup_failed',
        designUrl: artwork.url,
        error: error.message,
        mockups: []
      };
    }
  }

  /**
   * Upload a manually created design
   */
  async uploadDesign(filePath, metadata) {
    if (!process.env.CLOUDINARY_CLOUD_NAME) {
      throw new Error('Cloudinary not configured');
    }

    const uploaded = await cloudinary.uploader.upload(filePath, {
      folder: 'tresr/designs',
      public_id: `design_${Date.now()}`,
      resource_type: 'image'
    });

    // Store in database
    const designId = `design_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    db.prepare(`
      INSERT INTO products (id, title, niche, artwork_url, status, created_at)
      VALUES (?, ?, ?, ?, 'ready', datetime('now'))
    `).run(
      designId,
      metadata.title || 'Untitled Design',
      metadata.niche || 'general',
      uploaded.secure_url
    );

    incrementMetric('products_created');

    return {
      id: designId,
      url: uploaded.secure_url,
      publicId: uploaded.public_id
    };
  }

  /**
   * Get high-resolution artwork URL for printing
   * Cloudinary can transform images on-the-fly
   */
  getHighResUrl(artworkUrl, options = {}) {
    if (!artworkUrl || !artworkUrl.includes('cloudinary')) {
      return artworkUrl;
    }

    const {
      width = 4500,
      height = 5400,
      format = 'png',
      quality = 100
    } = options;

    // Transform URL for high-res print version
    return artworkUrl.replace(
      '/upload/',
      `/upload/w_${width},h_${height},c_fit,q_${quality},f_${format}/`
    );
  }
}

export default DesignGenerator;
