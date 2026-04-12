#!/usr/bin/env node
/**
 * Backfill Design URLs Script
 *
 * Uploads local design files to Cloudinary and matches them to Shopify products
 * by timestamp, then updates the artwork_url metafield.
 *
 * Usage: node scripts/backfill-designs.js [--dry-run]
 */

import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v2 as cloudinary } from 'cloudinary';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, '..', 'output');

// Config
const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const DRY_RUN = process.argv.includes('--dry-run');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

/**
 * Get all local design files
 */
function getLocalDesigns() {
  const files = fs.readdirSync(OUTPUT_DIR);
  const designs = [];

  for (const file of files) {
    // Match design files: design-{timestamp}.png or design_{timestamp}.png
    const match = file.match(/^design[-_](\d+)\.png$/);
    if (match) {
      const timestamp = parseInt(match[1]);
      designs.push({
        filename: file,
        path: path.join(OUTPUT_DIR, file),
        timestamp,
        date: new Date(timestamp)
      });
    }
  }

  // Sort by timestamp
  designs.sort((a, b) => a.timestamp - b.timestamp);
  return designs;
}

/**
 * Get all Shopify products
 */
async function getShopifyProducts() {
  const products = [];
  let url = `https://${SHOPIFY_STORE}/admin/api/2024-01/products.json?limit=250`;

  while (url) {
    const response = await fetch(url, {
      headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
    });

    const data = await response.json();
    products.push(...data.products);

    // Check for pagination
    const linkHeader = response.headers.get('link');
    if (linkHeader && linkHeader.includes('rel="next"')) {
      const nextMatch = linkHeader.match(/<([^>]+)>;\s*rel="next"/);
      url = nextMatch ? nextMatch[1] : null;
    } else {
      url = null;
    }
  }

  return products;
}

/**
 * Check if product already has artwork_url metafield
 */
async function hasArtworkMetafield(productId) {
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/products/${productId}/metafields.json`;
  const response = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
  });

  const data = await response.json();
  return data.metafields?.some(
    m => m.namespace === 'tresr' && m.key === 'artwork_url' && m.value
  );
}

/**
 * Upload design to Cloudinary
 */
async function uploadToCloudinary(designPath, timestamp) {
  const publicId = `design_${timestamp}`;

  // Check if already exists
  try {
    const existing = await cloudinary.api.resource(`tresr/designs/${publicId}`);
    if (existing) {
      console.log(`  Already in Cloudinary: ${publicId}`);
      return existing.secure_url;
    }
  } catch (e) {
    // Doesn't exist, upload it
  }

  const result = await cloudinary.uploader.upload(designPath, {
    folder: 'tresr/designs',
    public_id: publicId
  });

  return result.secure_url;
}

/**
 * Update product metafield
 */
async function updateProductMetafield(productId, artworkUrl) {
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/products/${productId}/metafields.json`;

  await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_TOKEN
    },
    body: JSON.stringify({
      metafield: {
        namespace: 'tresr',
        key: 'artwork_url',
        value: artworkUrl,
        type: 'url'
      }
    })
  });
}

/**
 * Find best matching product for a design by timestamp
 */
function findMatchingProduct(design, products) {
  const designTime = design.timestamp;

  // Find product created within 15 minutes AFTER the design
  // (design is created first, then mockup, then product)
  let bestMatch = null;
  let bestTimeDiff = Infinity;

  for (const product of products) {
    const productTime = new Date(product.created_at).getTime();
    const timeDiff = productTime - designTime;

    // Product should be created 0-15 minutes after design
    if (timeDiff >= 0 && timeDiff < 15 * 60 * 1000) {
      if (timeDiff < bestTimeDiff) {
        bestTimeDiff = timeDiff;
        bestMatch = product;
      }
    }
  }

  return bestMatch;
}

/**
 * Main backfill function
 */
async function backfill() {
  console.log('=== DESIGN BACKFILL SCRIPT ===\n');

  if (DRY_RUN) {
    console.log('*** DRY RUN MODE - No changes will be made ***\n');
  }

  // Get local designs
  console.log('1. Scanning local design files...');
  const designs = getLocalDesigns();
  console.log(`   Found ${designs.length} design files\n`);

  if (designs.length === 0) {
    console.log('No design files found in output/ folder');
    return;
  }

  // Show design files
  console.log('   Design files:');
  for (const d of designs.slice(0, 10)) {
    console.log(`   - ${d.filename} (${d.date.toLocaleString()})`);
  }
  if (designs.length > 10) {
    console.log(`   ... and ${designs.length - 10} more\n`);
  }

  // Get Shopify products
  console.log('\n2. Fetching Shopify products...');
  const products = await getShopifyProducts();
  console.log(`   Found ${products.length} products\n`);

  // Match and process
  console.log('3. Matching designs to products...\n');

  let uploaded = 0;
  let matched = 0;
  let skipped = 0;
  let noMatch = 0;

  for (const design of designs) {
    const product = findMatchingProduct(design, products);

    if (!product) {
      noMatch++;
      continue;
    }

    // Check if product already has metafield
    const hasMetafield = await hasArtworkMetafield(product.id);
    if (hasMetafield) {
      console.log(`   SKIP: ${product.title} (already has artwork_url)`);
      skipped++;
      continue;
    }

    console.log(`   MATCH: ${design.filename} -> "${product.title}"`);
    matched++;

    if (!DRY_RUN) {
      // Upload to Cloudinary
      console.log(`   Uploading to Cloudinary...`);
      const cloudinaryUrl = await uploadToCloudinary(design.path, design.timestamp);
      uploaded++;

      // Update metafield
      console.log(`   Updating metafield...`);
      await updateProductMetafield(product.id, cloudinaryUrl);
      console.log(`   Done: ${cloudinaryUrl}\n`);
    } else {
      console.log(`   [DRY RUN] Would upload and update metafield\n`);
    }

    // Rate limit
    await new Promise(r => setTimeout(r, 500));
  }

  // Summary
  console.log('\n=== SUMMARY ===');
  console.log(`Total design files: ${designs.length}`);
  console.log(`Matched to products: ${matched}`);
  console.log(`Already had metafield: ${skipped}`);
  console.log(`No matching product: ${noMatch}`);
  if (!DRY_RUN) {
    console.log(`Uploaded to Cloudinary: ${uploaded}`);
  }
  console.log('\nDone!');
}

// Run
backfill().catch(err => {
  console.error('Error:', err);
  process.exit(1);
});
