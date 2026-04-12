#!/usr/bin/env node
/**
 * Vectorize a design PNG using Vectorizer.ai API, then render to high-res PNG
 * 
 * Usage: node vectorize-design.js <input.png> <output.png> [--size 4096]
 * 
 * Pipeline step: runs AFTER Gemini generation, BEFORE bg removal and mockup compositing
 * Cleans up blocky edges from AI-generated designs by converting to vector and re-rendering
 */

require('dotenv').config({ override: true, path: require('path').join(__dirname, '..', '..', '.env') });
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const https = require('https');

const API_ID = process.env.VECTORIZER_AI_API_ID;
const API_SECRET = process.env.VECTORIZER_AI_API_SECRET;

if (!API_ID || !API_SECRET) {
  console.error('❌ VECTORIZER_AI_API_ID and VECTORIZER_AI_API_SECRET must be set in .env');
  process.exit(1);
}

const args = process.argv.slice(2);
let inputPath = '', outputPath = '', size = 4096;

for (let i = 0; i < args.length; i++) {
  if (args[i] === '--size') { size = parseInt(args[++i]); }
  else if (!inputPath) { inputPath = args[i]; }
  else if (!outputPath) { outputPath = args[i]; }
}

if (!inputPath || !outputPath) {
  console.error('Usage: node vectorize-design.js <input.png> <output.png> [--size 4096]');
  process.exit(1);
}

if (!fs.existsSync(inputPath)) {
  console.error(`❌ Input file not found: ${inputPath}`);
  process.exit(1);
}

const tempSvg = outputPath.replace(/\.png$/i, '.svg');

console.log(`🎨 Vectorizing: ${inputPath}`);
console.log(`   Output: ${outputPath} (${size}x${size})`);

// Step 1: Upload to Vectorizer.ai
const FormData = require('form-data') || null;

// Use curl for multipart upload (simpler than Node FormData)
try {
  console.log('   ⬆️  Sending to Vectorizer.ai API...');
  execSync(`curl -s -u "${API_ID}:${API_SECRET}" -F image=@"${inputPath}" -o "${tempSvg}" https://vectorizer.ai/api/v1/vectorize`, { timeout: 120000 });
  
  // Check if we got an error response
  const svgContent = fs.readFileSync(tempSvg, 'utf8');
  if (svgContent.startsWith('{') && svgContent.includes('"error"')) {
    const err = JSON.parse(svgContent);
    console.error(`❌ Vectorizer.ai error: ${err.error.message}`);
    process.exit(1);
  }
  
  const svgSize = (fs.statSync(tempSvg).size / 1024).toFixed(1);
  console.log(`   ✅ SVG generated: ${svgSize} KB`);
  
  // Step 2: Render SVG to high-res PNG using rsvg-convert
  console.log(`   🖼️  Rendering to ${size}x${size} PNG...`);
  execSync(`rsvg-convert -w ${size} -h ${size} "${tempSvg}" -o "${outputPath}"`, { timeout: 30000 });
  
  const pngSize = (fs.statSync(outputPath).size / 1024 / 1024).toFixed(2);
  console.log(`   ✅ High-res PNG: ${pngSize} MB`);
  
  // Clean up temp SVG
  fs.unlinkSync(tempSvg);
  
  console.log(`✅ Done: ${outputPath}`);
} catch (err) {
  console.error(`❌ Failed: ${err.message}`);
  process.exit(1);
}
