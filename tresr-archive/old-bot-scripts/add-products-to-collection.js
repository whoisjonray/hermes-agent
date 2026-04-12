#!/usr/bin/env node
/**
 * Add existing products to a collection
 *
 * Usage: node scripts/add-products-to-collection.js
 *
 * This adds all products to the "all-featured" collection so they appear on the shop page.
 */

import 'dotenv/config';

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const COLLECTION_HANDLE = 'all-featured';

async function getCollectionByHandle(handle) {
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/custom_collections.json?handle=${handle}`;
  const response = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
  });
  const data = await response.json();
  return data.custom_collections?.[0] || null;
}

async function getAllProducts() {
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/products.json?limit=250`;
  const response = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
  });
  const data = await response.json();
  return data.products || [];
}

async function getCollectionProducts(collectionId) {
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/collects.json?collection_id=${collectionId}`;
  const response = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
  });
  const data = await response.json();
  return data.collects?.map(c => c.product_id) || [];
}

async function addToCollection(productId, collectionId) {
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/collects.json`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_TOKEN
    },
    body: JSON.stringify({
      collect: {
        product_id: productId,
        collection_id: collectionId
      }
    })
  });
  return response.ok;
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Add Products to Collection');
  console.log('═══════════════════════════════════════════════════════');

  // Get collection
  console.log(`\nLooking for collection: ${COLLECTION_HANDLE}...`);
  const collection = await getCollectionByHandle(COLLECTION_HANDLE);

  if (!collection) {
    console.error(`Collection "${COLLECTION_HANDLE}" not found!`);
    process.exit(1);
  }

  console.log(`Found collection: ${collection.title} (ID: ${collection.id})`);

  // Get all products
  console.log('\nFetching all products...');
  const products = await getAllProducts();
  console.log(`Found ${products.length} products`);

  // Get products already in collection
  console.log('\nChecking which products are already in collection...');
  const existingProductIds = await getCollectionProducts(collection.id);
  console.log(`${existingProductIds.length} products already in collection`);

  // Find products not in collection
  const productsToAdd = products.filter(p => !existingProductIds.includes(p.id));
  console.log(`${productsToAdd.length} products need to be added`);

  if (productsToAdd.length === 0) {
    console.log('\n✅ All products are already in the collection!');
    return;
  }

  // Add products
  console.log('\nAdding products to collection...');
  let added = 0;
  let failed = 0;

  for (const product of productsToAdd) {
    const success = await addToCollection(product.id, collection.id);
    if (success) {
      console.log(`  ✓ Added: ${product.title}`);
      added++;
    } else {
      console.log(`  ✗ Failed: ${product.title}`);
      failed++;
    }
    // Small delay to avoid rate limits
    await new Promise(r => setTimeout(r, 200));
  }

  console.log('\n═══════════════════════════════════════════════════════');
  console.log(`  Results: ${added} added, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════\n');
}

main().catch(console.error);
