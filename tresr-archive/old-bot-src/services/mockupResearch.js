/**
 * Mockup Research Service
 * Searches for winning t-shirt mockups, analyzes patterns, replicates styles
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const RESEARCH_DIR = path.join(__dirname, '..', '..', 'research');

// Ensure research directory exists
if (!fs.existsSync(RESEARCH_DIR)) {
  fs.mkdirSync(RESEARCH_DIR, { recursive: true });
}

/**
 * Search Google Images for mockup examples
 */
export async function searchMockups(category, count = 10) {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const cx = process.env.GOOGLE_SEARCH_ENGINE_ID;

  if (!apiKey || !cx) {
    throw new Error('Google Search API not configured');
  }

  const query = `${category} t-shirt mockup product photography`;
  const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}&searchType=image&num=${count}`;

  const response = await fetch(url);
  const data = await response.json();

  if (data.error) {
    throw new Error(`Google Search error: ${data.error.message}`);
  }

  return data.items?.map(item => ({
    title: item.title,
    url: item.link,
    thumbnail: item.image?.thumbnailLink,
    context: item.image?.contextLink,
    width: item.image?.width,
    height: item.image?.height
  })) || [];
}

/**
 * Download image to local file
 */
async function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);

    protocol.get(url, (response) => {
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadImage(response.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      if (response.statusCode !== 200) {
        reject(new Error(`Download failed: ${response.statusCode}`));
        return;
      }
      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(destPath);
      });
    }).on('error', reject);
  });
}

/**
 * Analyze mockup images with Gemini Vision to extract patterns
 */
export async function analyzeMockupPatterns(imageUrls) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error('Gemini API key not configured');

  // Download images first
  const downloadedPaths = [];
  const categoryDir = path.join(RESEARCH_DIR, `analysis_${Date.now()}`);
  fs.mkdirSync(categoryDir, { recursive: true });

  for (let i = 0; i < Math.min(imageUrls.length, 5); i++) {
    try {
      const destPath = path.join(categoryDir, `mockup_${i}.jpg`);
      await downloadImage(imageUrls[i], destPath);
      downloadedPaths.push(destPath);
      console.log(`Downloaded ${i + 1}/${Math.min(imageUrls.length, 5)}`);
    } catch (e) {
      console.log(`Failed to download image ${i}: ${e.message}`);
    }
  }

  if (downloadedPaths.length === 0) {
    throw new Error('No images could be downloaded');
  }

  // Convert images to base64 for Gemini
  const imageParts = downloadedPaths.map(p => ({
    inlineData: {
      mimeType: 'image/jpeg',
      data: fs.readFileSync(p).toString('base64')
    }
  }));

  // Analyze with Gemini Vision
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
            ...imageParts,
            {
              text: `Analyze these t-shirt product mockup images. Extract the COMMON PATTERNS for:

1. BACKGROUND STYLES: What backgrounds are used? (solid color, gradient, lifestyle scene, flat lay, bokeh, etc.)
2. BACKGROUND COLORS: What specific colors/tones dominate?
3. FRAMING: How is the t-shirt positioned? (centered, angled, folded, on model, flat lay)
4. PROPS: What objects appear around the shirt? (plants, accessories, textures)
5. LIGHTING: What lighting style? (soft, dramatic, natural, studio)
6. OVERALL VIBE: What mood/aesthetic? (minimalist, cozy, premium, fun)

Return as JSON:
{
  "backgroundStyles": ["style1", "style2"],
  "backgroundColors": ["#hex1", "#hex2"],
  "framing": "description of common framing",
  "props": ["prop1", "prop2"],
  "lighting": "lighting style",
  "overallVibe": "aesthetic description",
  "geminiPromptToReplicate": "A detailed prompt to generate a similar background with Gemini"
}`
            }
          ]
        }],
        generationConfig: {
          temperature: 0.2
        }
      })
    }
  );

  const data = await response.json();

  if (data.error) {
    throw new Error(`Gemini error: ${data.error.message}`);
  }

  const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
  const jsonMatch = text.match(/\{[\s\S]*\}/);

  if (jsonMatch) {
    const analysis = JSON.parse(jsonMatch[0]);

    // Save analysis
    fs.writeFileSync(
      path.join(categoryDir, 'analysis.json'),
      JSON.stringify(analysis, null, 2)
    );

    return analysis;
  }

  return { raw: text };
}

/**
 * Generate a background based on analyzed patterns
 */
export async function generateBackgroundFromPatterns(analysis, category) {
  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) throw new Error('Gemini API key not configured');

  const prompt = analysis.geminiPromptToReplicate ||
    `Product photography background for ${category} t-shirt mockup. ${analysis.backgroundStyles?.join(', ')}. Colors: ${analysis.backgroundColors?.join(', ')}. ${analysis.overallVibe} aesthetic. Leave center empty for product placement.`;

  console.log('Generating background with prompt:', prompt);

  const response = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-goog-api-key': geminiKey
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE', 'TEXT'] }
      })
    }
  );

  const data = await response.json();

  if (data.candidates?.[0]?.content?.parts) {
    for (const part of data.candidates[0].content.parts) {
      if (part.inlineData?.mimeType?.startsWith('image/')) {
        const buffer = Buffer.from(part.inlineData.data, 'base64');
        const bgPath = path.join(__dirname, '..', '..', 'backgrounds', `${category}-researched-${Date.now()}.png`);
        fs.writeFileSync(bgPath, buffer);
        return bgPath;
      }
    }
  }

  throw new Error('No image generated');
}

/**
 * Full research flow: search → analyze → generate
 */
export async function researchAndGenerateBackground(category) {
  console.log(`\n🔍 Researching ${category} t-shirt mockups...`);

  // Step 1: Search
  const results = await searchMockups(category, 10);
  console.log(`Found ${results.length} mockup examples`);

  // Step 2: Analyze
  const imageUrls = results.map(r => r.url);
  console.log('\n📊 Analyzing patterns with Gemini Vision...');
  const analysis = await analyzeMockupPatterns(imageUrls);
  console.log('Analysis:', JSON.stringify(analysis, null, 2));

  // Step 3: Generate
  console.log('\n🎨 Generating background based on patterns...');
  const bgPath = await generateBackgroundFromPatterns(analysis, category);
  console.log('Generated:', bgPath);

  return {
    searchResults: results.length,
    analysis,
    backgroundPath: bgPath
  };
}

export default {
  searchMockups,
  analyzeMockupPatterns,
  generateBackgroundFromPatterns,
  researchAndGenerateBackground
};
