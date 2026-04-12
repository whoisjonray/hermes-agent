#!/usr/bin/env node
/**
 * Set collection sort order to newest first
 *
 * Usage: node scripts/set-collection-sort.js
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

async function updateCollectionSortOrder(collectionId, sortOrder) {
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/custom_collections/${collectionId}.json`;
  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_TOKEN
    },
    body: JSON.stringify({
      custom_collection: {
        id: collectionId,
        sort_order: sortOrder
      }
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(JSON.stringify(error));
  }

  return response.json();
}

async function main() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  Set Collection Sort Order');
  console.log('═══════════════════════════════════════════════════════');

  // Get collection
  console.log(`\nLooking for collection: ${COLLECTION_HANDLE}...`);
  const collection = await getCollectionByHandle(COLLECTION_HANDLE);

  if (!collection) {
    console.error(`Collection "${COLLECTION_HANDLE}" not found!`);
    process.exit(1);
  }

  console.log(`Found collection: ${collection.title} (ID: ${collection.id})`);
  console.log(`Current sort order: ${collection.sort_order}`);

  // Update to newest first
  console.log('\nUpdating sort order to "created-desc" (newest first)...');
  await updateCollectionSortOrder(collection.id, 'created-desc');

  console.log('\n✅ Collection sort order updated to newest first!');
  console.log(`\nView at: https://tresr.com/collections/${COLLECTION_HANDLE}`);
}

main().catch(console.error);
