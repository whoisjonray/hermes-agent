/**
 * Design Generator Service
 * Generates t-shirt designs using Gemini Imagen, informed by deep customer research
 *
 * The design text should make them feel SEEN, not sold to.
 * We use their exact language, not marketing speak.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';
import { getDesignTextSuggestions, validateDesignText, scoreConceptAlignment } from './customerResearch.js';
import { searchDesignStyles, researchFeedbackStyle } from './styleResearch.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'output');

// Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
  fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

/**
 * POD Design Guidelines - MANDATORY for print-ready output
 * Based on proven BALLN patterns that work every time
 */
const POD_GUIDELINES = {
  background: 'SOLID BLACK (#000000) - no texture, no noise, no gradient, pure flat black',
  foreground: 'White or single accent color design',
  format: 'Single centered design, isolated graphic only',
  style: 'High-contrast vector style, solid fills only, no gradients',
  restrictions: [
    'NO borders, frames, boxes, or rectangular outlines around the design',
    'NO t-shirt mockup - isolated graphic only',
    'NO duplicate/mirrored/tiled designs - ONE single design',
    'NO side-by-side comparisons or variations',
    'NO textured or noisy backgrounds - PURE FLAT BLACK only'
  ]
};

/**
 * Process ANY user input through POD guidelines
 * Extracts design intent and converts to POD-compliant brief
 */
export async function processCustomPrompt(userInput, category = 'general') {
  console.log('Processing custom prompt through POD guidelines...');
  console.log('User input:', userInput);

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
            text: `You are a creative t-shirt design brief generator for print-on-demand.

USER REQUEST: "${userInput}"
CATEGORY: ${category}

Analyze the user's request and create a compelling design brief. You have CREATIVE FREEDOM to interpret their idea.

DESIGN OPTIONS:
1. TYPOGRAPHY-FOCUSED: Bold text as the main element (1-5 words typical)
2. ILLUSTRATED: Graphics/illustrations with supporting text
3. ICONIC: Strong icon/symbol as hero with minimal text

Choose the approach that best fits the user's intent. The goal is to create a design that ${category} enthusiasts would WANT to wear.

Return this JSON:
{
  "textContent": "The text to display (can be 1-6 words)",
  "title": "Product title for Shopify",
  "category": "${category}",
  "designType": "typography|illustrated|iconic",
  "visualDescription": "Describe any graphics/illustrations if applicable",
  "styleNotes": "Style preferences (vintage, modern, minimalist, bold, etc.)",
  "whyItWorks": "Brief explanation of why this resonates with ${category} audience"
}`
          }]
        }],
        generationConfig: { temperature: 0.3 }
      })
    }
  );

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const brief = JSON.parse(jsonMatch[0]);
      console.log('Extracted design brief:', brief);
      return brief;
    }
  } catch (e) {
    console.error('Failed to parse custom prompt response:', e.message);
  }

  // Fallback: use the input directly as text (truncated)
  const words = userInput.split(' ').slice(0, 4).join(' ').toUpperCase();
  return {
    textContent: words,
    title: `${words} T-Shirt`,
    category,
    designType: 'typography',
    styleNotes: '',
    originalRequest: userInput
  };
}

/**
 * Generate design from ANY input - always goes through POD guidelines
 * This is the main entry point for custom/user prompts
 */
export async function generateFromCustomPrompt(userInput, category = 'general') {
  // Step 1: Process the custom input through our guidelines
  const designBrief = await processCustomPrompt(userInput, category);

  // Step 2: Generate the design using our standard pipeline
  return await generateDesignImage(designBrief);
}

/**
 * Generate a design image based on design brief
 * Uses Gemini 3 Pro Image Preview for high-fidelity text rendering
 */
export async function generateDesignImage(designBrief) {
  const { category, title, textContent, designType, imagePrompt, feedback } = designBrief;

  // Validate text against research
  if (textContent) {
    const validation = validateDesignText(category, textContent);
    if (!validation.valid && validation.suggestions.length > 0) {
      console.log(`Design text might not resonate. Consider: ${validation.suggestions.join(', ')}`);
    }
  }

  // Build the prompt for Gemini
  const prompt = buildDesignPrompt(designBrief);

  console.log('Generating design with Gemini 3 Pro Image Preview...');
  console.log('Prompt:', prompt);

  try {
    // Generate image with Gemini 3 Pro Image Preview (best for text rendering)
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': GEMINI_API_KEY
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: prompt
            }]
          }],
          generationConfig: {
            responseModalities: ['IMAGE', 'TEXT'],
            temperature: 1.0
          }
        })
      }
    );

    const data = await response.json();

    if (data.error) {
      console.error('Gemini API error:', data.error);
      throw new Error(data.error.message || 'Gemini API error');
    }

    // Extract image from response parts
    let imageBase64 = null;
    const parts = data.candidates?.[0]?.content?.parts || [];

    for (const part of parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        imageBase64 = part.inlineData.data;
        break;
      }
    }

    if (!imageBase64) {
      console.log('Gemini response:', JSON.stringify(data, null, 2));
      throw new Error('No image data in response - model may not support image generation');
    }

    const imageBuffer = Buffer.from(imageBase64, 'base64');

    const timestamp = Date.now();
    const designPath = path.join(OUTPUT_DIR, `design-${timestamp}.png`);

    fs.writeFileSync(designPath, imageBuffer);
    console.log('Image saved to:', designPath);

    // Save the design spec for reference
    const designSpec = {
      prompt,
      brief: designBrief,
      imagePath: designPath,
      model: 'gemini-3-pro-image-preview',
      generated: new Date().toISOString()
    };

    const specPath = path.join(OUTPUT_DIR, `design-spec-${timestamp}.json`);
    fs.writeFileSync(specPath, JSON.stringify(designSpec, null, 2));

    // Upload design to Cloudinary for permanent storage and metafield use
    let cloudinaryUrl = null;
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      try {
        const uploaded = await cloudinary.uploader.upload(designPath, {
          folder: 'tresr/designs',
          public_id: `design_${timestamp}`
        });
        cloudinaryUrl = uploaded.secure_url;
        console.log('Design uploaded to Cloudinary:', cloudinaryUrl);
      } catch (uploadError) {
        console.error('Cloudinary upload failed:', uploadError.message);
        // Continue with local path if upload fails
      }
    }

    // Return object with both local path and Cloudinary URL
    // This allows Telegram to use local file while Shopify uses Cloudinary URL
    return {
      localPath: designPath,
      url: cloudinaryUrl || designPath,
      cloudinaryUrl
    };

  } catch (error) {
    console.error('Gemini image generation failed:', error);
    throw new Error(`Image generation failed: ${error.message}`);
  }
}

/**
 * Design style profiles based on proven BALLN patterns
 * These create professional, marketable designs - NOT generic AI output
 */
const STYLE_PROFILES = {
  // Bold stacked typography - like "LEGACY LOADING", "SILENT WORK LOUD RESULTS"
  stacked: {
    name: 'Bold Stacked Typography',
    prompt: 'bold stacked text layout, each word on separate line, modern athletic block letters, heavy font weight',
    iconStyle: 'small geometric icon underneath or beside text (loading bar, arrow, simple shape)',
  },
  // Arc/dynamic composition - like "PUTS IT IN"
  dynamic: {
    name: 'Dynamic Arc Composition',
    prompt: 'dynamic text layout with arc or curved element, script accent text, basketball/sports iconography integrated',
    iconStyle: 'integrated sports icon (hoop, ball arc, net) as part of composition',
  },
  // Geometric angular - like "LAST SHOT CONFIDENCE"
  geometric: {
    name: 'Geometric Angular',
    prompt: 'angular geometric typography, sharp edges, bold sans-serif, stacked layout with integrated icon',
    iconStyle: 'geometric icon integrated into text layout (timer, crosshairs, gauge)',
  },
  // Clean minimalist - simple text only
  minimalist: {
    name: 'Clean Minimalist',
    prompt: 'minimalist bold text, clean sans-serif font, no decorative elements, maximum readability',
    iconStyle: 'no icon, text only',
  },
  // Vintage distressed
  vintage: {
    name: 'Vintage Distressed',
    prompt: 'vintage distressed typography, worn texture, retro athletic lettering',
    iconStyle: 'small vintage emblem or badge element',
  }
};

/**
 * Get category-specific icon suggestions
 */
function getCategoryIcon(category) {
  const icons = {
    crypto: 'small bitcoin/crypto symbol, chart arrow, diamond hands icon',
    fitness: 'small dumbbell, weight plate, gym icon',
    coffee: 'small coffee cup, steam lines, bean icon',
    gaming: 'controller icon, pixel element, joystick',
    'dog lovers': 'small paw print, dog silhouette',
    'mental health': 'small brain icon, heart, peace symbol',
    entrepreneur: 'small rocket, chart, lightbulb',
    developer: 'code brackets, terminal icon, keyboard',
  };
  return icons[category] || 'small relevant geometric icon';
}

/**
 * Build the design prompt for image generation
 * Based on BALLN's proven prompt structure that produces clean, printable designs
 *
 * BALLN pattern: "Bold [style] typography '[TEXT]' in [font], [color] design on solid black background,
 *                high-contrast vector style, [details], screen print ready t-shirt graphic"
 */
function buildDesignPrompt(designBrief) {
  const { category, title, textContent, designType, feedback, styleProfile, styleResearch, visualDescription } = designBrief;

  // Get the exact text to display
  const displayText = textContent || title || '';

  // Determine design approach from research or brief
  const designApproach = determineDesignApproach(designBrief);

  // Get color scheme (default white, but can be gold, red, etc based on category)
  const color = getDesignColor(category, styleResearch);

  // Build the BALLN-style prompt
  let prompt;

  if (designApproach === 'illustrated') {
    // Illustrated design with graphics
    prompt = buildIllustratedPrompt(displayText, category, color, styleResearch, visualDescription);
  } else if (designApproach === 'iconic') {
    // Icon-heavy design with minimal text
    prompt = buildIconicPrompt(displayText, category, color, styleResearch);
  } else {
    // Typography-focused design (default)
    prompt = buildTypographyPrompt(displayText, category, color, styleResearch);
  }

  // Add user feedback if provided
  if (feedback) {
    prompt += `\n\nAdditional style direction: ${feedback}`;
  }

  // Add CRITICAL background requirements
  prompt += `

CRITICAL REQUIREMENTS (MUST FOLLOW):
1. BACKGROUND: Pure flat black (#000000, RGB 0,0,0) - absolutely NO texture, NO noise, NO pattern, NO gradient, NO grain. Just solid black pixels.
2. Design must be centered in frame
3. IMPORTANT - SINGLE DESIGN ONLY: Generate exactly ONE design, centered. DO NOT create two designs side-by-side. DO NOT duplicate the design. DO NOT show variations. ONE design in the CENTER of the image.
4. NO rectangular borders or frames around the design
5. NO background effects or decorative elements behind the design
6. Screen print ready: solid fills only, high contrast white on pure black
7. OUTPUT: Square 1:1 aspect ratio image with ONE SINGLE centered design

FINAL REMINDER - THIS IS THE MOST IMPORTANT RULE:
The background color of this image MUST be RGB(0,0,0) pure black. NOT dark gray, NOT charcoal, NOT textured black - PURE SOLID BLACK (#000000). Any pixel that is not part of the white design should be exactly RGB(0,0,0). This is non-negotiable.`;

  return prompt;
}

/**
 * Determine the design approach based on research and brief
 */
function determineDesignApproach(brief) {
  const { designType, styleResearch, visualDescription } = brief;

  // If research suggests illustrated style
  if (styleResearch?.designStyles?.some(s =>
    s.toLowerCase().includes('illustrat') ||
    s.toLowerCase().includes('graphic') ||
    s.toLowerCase().includes('cartoon')
  )) {
    return 'illustrated';
  }

  // If visual description mentions specific imagery
  if (visualDescription && (
    visualDescription.includes('character') ||
    visualDescription.includes('illustration') ||
    visualDescription.includes('graphic')
  )) {
    return 'illustrated';
  }

  // If design type suggests icons
  if (designType === 'iconic' || designType === 'graphic') {
    return 'iconic';
  }

  return 'typography';
}

/**
 * Get design color based on category and research
 */
function getDesignColor(category, styleResearch) {
  // Check if research suggests specific colors
  if (styleResearch?.colorSuggestion) {
    return styleResearch.colorSuggestion;
  }

  // Category defaults
  const categoryColors = {
    crypto: 'gold',
    fitness: 'white',
    coffee: 'cream/tan',
    gaming: 'white with RGB accent',
    'dog lovers': 'white',
    'mental health': 'soft white',
    entrepreneur: 'gold',
    developer: 'green accent'
  };

  return categoryColors[category] || 'white';
}

/**
 * Build typography-focused prompt (BALLN style)
 */
function buildTypographyPrompt(text, category, color, styleResearch) {
  const styleHint = styleResearch?.styleRecommendation || 'bold athletic block letters';

  return `Bold typography design "${text}" in modern ${styleHint} font, ${color} design on PURE FLAT BLACK background (RGB 0,0,0 exactly), high-contrast vector style, clean sharp letterforms, solid fill no gradients, screen print ready t-shirt graphic.

BACKGROUND: The entire background MUST be pure black (#000000) with NO texture, NO pattern, NO noise, NO grain - just flat solid black color.

The text "${text}" should be the focal point, rendered in a style that resonates with ${category} enthusiasts. Typography can be stacked, arced, or dynamically arranged - whatever creates the strongest visual impact.`;
}

/**
 * Build illustrated prompt with graphics
 */
function buildIllustratedPrompt(text, category, color, styleResearch, visualDesc) {
  const visualHint = visualDesc || styleResearch?.visualSuggestion || `${category}-themed graphic`;

  return `Illustrated t-shirt design featuring "${text}" with ${visualHint}, ${color} design on PURE FLAT BLACK background (RGB 0,0,0 exactly), vector illustration style, bold graphic elements integrated with typography, high-contrast screen print aesthetic.

BACKGROUND: The entire background MUST be pure black (#000000) with NO texture, NO pattern, NO noise, NO grain - just flat solid black color. The design floats on pure black.

Create a cohesive design where the illustration and text work together. The ${category} theme should be visually apparent through the graphic elements, not just the text.`;
}

/**
 * Build icon-heavy prompt
 */
function buildIconicPrompt(text, category, color, styleResearch) {
  const iconHint = getCategoryIcon(category);

  return `Bold iconic design featuring "${text}" with prominent ${iconHint}, ${color} design on PURE FLAT BLACK background (RGB 0,0,0 exactly), graphic icon as main visual element with typography supporting, high-contrast vector style, clean geometric shapes, screen print ready.

BACKGROUND: The entire background MUST be pure black (#000000) with NO texture, NO pattern, NO noise, NO grain - just flat solid black color.

The icon should be the hero element with the text "${text}" integrated into the composition.`;
}

/**
 * Generate design with style research
 * First researches popular styles, then generates design informed by that research
 */
export async function generateDesignWithResearch(designBrief) {
  // Search for popular design styles in this category
  console.log(`Researching popular ${designBrief.category} design styles...`);
  const styleResearch = await searchDesignStyles(designBrief.category, designBrief.textContent);

  console.log('Style research:', styleResearch);

  // Add style research to brief
  const enrichedBrief = {
    ...designBrief,
    styleResearch
  };

  // Generate the design
  return await generateDesignImage(enrichedBrief);
}

/**
 * Generate design concepts based on category research
 */
export async function generateDesignConcepts(category, count = 5) {
  // Get research-driven suggestions
  const researchSuggestions = getDesignTextSuggestions(category, count);

  const concepts = researchSuggestions.map((text, index) => ({
    id: `concept-${index + 1}`,
    title: text,
    textContent: text,
    designType: determineDesignType(text),
    category,
    source: 'customer_research',
    alignment: scoreConceptAlignment(category, text)
  }));

  return concepts;
}

/**
 * Determine the best design type based on text
 */
function determineDesignType(text) {
  // Longer text = typography focused
  if (text.length > 30) return 'typography';

  // Short punchy text could work with illustration
  if (text.length < 15) return 'mixed';

  return 'typography';
}

/**
 * Generate design variations for testing
 */
export async function generateVariations(baseDesign, count = 3) {
  const variations = [];

  // Variation 1: Typography style change
  variations.push({
    ...baseDesign,
    id: `${baseDesign.id}-var1`,
    designType: 'typography',
    style: 'bold-distressed'
  });

  // Variation 2: Different text treatment
  variations.push({
    ...baseDesign,
    id: `${baseDesign.id}-var2`,
    designType: 'typography',
    style: 'clean-modern'
  });

  // Variation 3: With supporting graphic
  variations.push({
    ...baseDesign,
    id: `${baseDesign.id}-var3`,
    designType: 'mixed',
    style: 'icon-accent'
  });

  return variations.slice(0, count);
}

/**
 * Score a design's potential based on research alignment
 */
export function scoreDesignPotential(design) {
  const alignment = scoreConceptAlignment(design.category, design.textContent || design.title);

  return {
    ...alignment,
    design_id: design.id,
    recommendation: alignment.alignment === 'high'
      ? 'Strong research alignment - likely to convert'
      : alignment.alignment === 'medium'
        ? 'Moderate alignment - worth testing'
        : 'Low alignment - consider revising text'
  };
}

export default {
  generateDesignImage,
  generateDesignWithResearch,
  generateDesignConcepts,
  generateVariations,
  scoreDesignPotential,
  buildDesignPrompt,
  processCustomPrompt,
  generateFromCustomPrompt,
  STYLE_PROFILES,
  POD_GUIDELINES
};
