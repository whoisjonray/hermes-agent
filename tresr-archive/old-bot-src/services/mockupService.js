/**
 * Mockup Service
 * BALLN-style PIL compositing for t-shirt mockups
 *
 * Workflow:
 * 1. Generate design image (DALL-E/Gemini)
 * 2. Call Python script to composite onto t-shirt template
 * 3. Upload final mockup to Cloudinary
 */

import { spawn } from 'child_process';
import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import https from 'https';
import http from 'http';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRIPTS_DIR = path.join(__dirname, '..', '..', 'scripts');
const OUTPUT_DIR = path.join(__dirname, '..', '..', 'output');
const TEMP_DIR = path.join(__dirname, '..', '..', 'temp');

// Ensure directories exist
[OUTPUT_DIR, TEMP_DIR].forEach(dir => {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
});

// Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

/**
 * Download image from URL to local file
 */
async function downloadImage(url, destPath) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http;
    const file = fs.createWriteStream(destPath);

    protocol.get(url, (response) => {
      // Handle redirects
      if (response.statusCode === 301 || response.statusCode === 302) {
        downloadImage(response.headers.location, destPath)
          .then(resolve)
          .catch(reject);
        return;
      }

      if (response.statusCode !== 200) {
        reject(new Error(`Failed to download: ${response.statusCode}`));
        return;
      }

      response.pipe(file);
      file.on('finish', () => {
        file.close();
        resolve(destPath);
      });
    }).on('error', (err) => {
      fs.unlink(destPath, () => {}); // Delete partial file
      reject(err);
    });
  });
}

/**
 * Generate mockup using Python PIL script
 * @param {Object} options
 * @param {string} options.designUrl - URL or path to design image
 * @param {string} options.outputName - Name for output file (optional)
 * @param {Object} options.settings - Mockup settings (optional)
 * @param {boolean} options.settings.lifestyle - Use lifestyle mode (shirt on background)
 */
export async function generateMockup(options = {}) {
  const {
    designUrl,
    outputName = `mockup_${Date.now()}`,
    backgroundPath = null,  // Optional: use specific template
    settings = {}
  } = options;

  if (!designUrl) {
    throw new Error('Design URL is required');
  }

  const timestamp = Date.now();
  let designPath = designUrl;

  // If URL, download to temp file
  if (designUrl.startsWith('http')) {
    designPath = path.join(TEMP_DIR, `design_${timestamp}.png`);
    console.log(`Downloading design from: ${designUrl}`);
    await downloadImage(designUrl, designPath);
    console.log(`Downloaded to: ${designPath}`);
  }

  // Output path
  const outputPath = path.join(OUTPUT_DIR, `${outputName}.png`);

  // Build Python command arguments
  const args = [
    path.join(SCRIPTS_DIR, 'mockup_generator.py'),
    designPath,
    '-o', outputPath
  ];

  // Add optional settings
  if (settings.backgroundPath) args.push('-b', settings.backgroundPath);
  if (settings.width) args.push('-w', settings.width.toString());
  if (settings.yOffset) args.push('-y', settings.yOffset.toString());
  if (settings.bgMode) args.push('--bg-mode', settings.bgMode);
  if (settings.threshold) args.push('--threshold', settings.threshold.toString());
  if (settings.noRemoveBg) args.push('--no-remove-bg');

  // Lifestyle mode: shirt + design on lifestyle background
  if (settings.lifestyle) {
    args.push('--lifestyle');
    if (settings.shirtWidth) args.push('--shirt-width', settings.shirtWidth.toString());
    if (settings.shirtY) args.push('--shirt-y', settings.shirtY.toString());
  }

  args.push('--json');

  console.log(`Running mockup generator: python3 ${args.join(' ')}`);

  // Execute Python script
  return new Promise((resolve, reject) => {
    const childProcess = spawn('python3', args);
    let stdout = '';
    let stderr = '';

    childProcess.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('Mockup:', data.toString().trim());
    });

    childProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    childProcess.on('close', async (code) => {
      // Clean up temp file if we downloaded it
      if (designUrl.startsWith('http') && fs.existsSync(designPath)) {
        fs.unlinkSync(designPath);
      }

      if (code !== 0) {
        console.error('Mockup generator stderr:', stderr);
        reject(new Error(`Mockup generator failed with code ${code}: ${stderr}`));
        return;
      }

      // Check if output file was created
      if (!fs.existsSync(outputPath)) {
        reject(new Error('Mockup file was not created'));
        return;
      }

      // Upload to Cloudinary for remote access (Shopify, etc.)
      // But keep local file for Telegram preview (more reliable)
      if (process.env.CLOUDINARY_CLOUD_NAME) {
        try {
          const uploaded = await cloudinary.uploader.upload(outputPath, {
            folder: 'tresr/mockups',
            public_id: outputName
          });

          // Keep local file - return both local path and remote URL
          resolve({
            url: uploaded.secure_url,        // For Shopify/external use
            localPath: outputPath,           // For Telegram preview
            publicId: uploaded.public_id,
            status: 'generated',
            generator: 'pil-composite'
          });
        } catch (uploadError) {
          console.error('Cloudinary upload error:', uploadError.message);
          // Return local path if upload fails
          resolve({
            url: outputPath,
            localPath: outputPath,
            status: 'generated_local',
            generator: 'pil-composite'
          });
        }
      } else {
        resolve({
          url: outputPath,
          localPath: outputPath,
          status: 'generated_local',
          generator: 'pil-composite'
        });
      }
    });
  });
}

/**
 * Generate mockups for multiple shirt colors
 */
export async function generateColorVariants(designUrl, colors = ['white', 'black']) {
  const mockups = [];

  for (const color of colors) {
    try {
      // For now, we use the same template for all colors
      // In future, can add color-specific templates
      const mockup = await generateMockup({
        designUrl,
        outputName: `mockup_${color}_${Date.now()}`,
        settings: {
          // Adjust background removal based on shirt color
          bgMode: color === 'white' ? 'black' : 'white'
        }
      });

      mockups.push({
        color,
        ...mockup
      });
    } catch (error) {
      console.error(`Failed to generate ${color} mockup:`, error.message);
      mockups.push({
        color,
        status: 'failed',
        error: error.message
      });
    }
  }

  return mockups;
}

/**
 * Quick test of mockup generation
 */
export async function testMockupGeneration() {
  console.log('Testing mockup generation...');

  // Create a simple test image
  const testImagePath = path.join(TEMP_DIR, 'test_design.png');

  // Use a placeholder if no test image exists
  if (!fs.existsSync(testImagePath)) {
    console.log('No test image found. Create one at:', testImagePath);
    return { status: 'no_test_image', path: testImagePath };
  }

  return await generateMockup({
    designUrl: testImagePath,
    outputName: 'test_mockup'
  });
}

/**
 * Load mockup templates config
 */
function loadTemplatesConfig() {
  const configPath = path.join(__dirname, '..', '..', 'config', 'mockup-templates.json');
  if (fs.existsSync(configPath)) {
    return JSON.parse(fs.readFileSync(configPath, 'utf8'));
  }
  return null;
}

/**
 * Generate mockups for ALL templates (for A/B testing ads)
 * Returns both clean product shot AND lifestyle creative
 */
export async function generateAllVariants(designUrl) {
  const config = loadTemplatesConfig();
  if (!config) {
    // Fallback to single mockup
    return [await generateMockup({ designUrl })];
  }

  const results = [];
  const BACKGROUNDS_DIR = path.join(__dirname, '..', '..', 'backgrounds');

  for (const [key, template] of Object.entries(config.templates)) {
    try {
      const backgroundPath = path.join(BACKGROUNDS_DIR, template.file);
      if (!fs.existsSync(backgroundPath)) {
        console.log(`Template not found: ${template.file}`);
        continue;
      }

      const mockup = await generateMockup({
        designUrl,
        outputName: `mockup_${key}_${Date.now()}`,
        backgroundPath,
        settings: template.settings
      });

      results.push({
        templateKey: key,
        templateName: template.name,
        useCase: template.use_case,
        platforms: template.platforms,
        ...mockup
      });
    } catch (error) {
      console.error(`Failed to generate ${key} mockup:`, error.message);
    }
  }

  return results;
}

export default {
  generateMockup,
  generateColorVariants,
  generateAllVariants,
  testMockupGeneration
};
