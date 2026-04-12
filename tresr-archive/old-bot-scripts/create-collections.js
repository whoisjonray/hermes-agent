#!/usr/bin/env node
/**
 * Create missing Shopify collections for categories
 */

import 'dotenv/config';

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

const COLLECTIONS_TO_CREATE = [
  { title: 'Homepage - Fitness', handle: 'homepage-fitness' },
  { title: 'Homepage - Dog Lovers', handle: 'homepage-dog-lovers' },
  { title: 'Homepage - Mental Health', handle: 'homepage-mental-health' },
  { title: 'Homepage - Entrepreneur', handle: 'homepage-entrepreneur' }
];

async function createCollection(title, handle) {
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/custom_collections.json`;
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_TOKEN
    },
    body: JSON.stringify({
      custom_collection: {
        title,
        handle,
        published: true,
        sort_order: 'created-desc'  // Newest first
      }
    })
  });

  const data = await response.json();
  if (response.ok) {
    return data.custom_collection;
  } else {
    throw new Error(JSON.stringify(data.errors));
  }
}

async function getAllCollections() {
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/custom_collections.json?limit=250`;
  const response = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
  });
  const data = await response.json();
  return data.custom_collections || [];
}

async function main() {
  console.log('Creating missing Shopify collections...\n');

  // Get existing collections
  const existing = await getAllCollections();
  const existingHandles = existing.map(c => c.handle);

  for (const coll of COLLECTIONS_TO_CREATE) {
    if (existingHandles.includes(coll.handle)) {
      console.log(`  ⏭️  ${coll.title} already exists`);
      continue;
    }

    try {
      const created = await createCollection(coll.title, coll.handle);
      console.log(`  ✅ Created: ${created.title} (ID: ${created.id})`);
    } catch (error) {
      console.log(`  ❌ Failed: ${coll.title} - ${error.message}`);
    }
  }

  console.log('\nDone! Fetching all collections...\n');

  // Show all collections
  const all = await getAllCollections();
  console.log('All Shopify Collections:');
  console.log('========================');
  for (const c of all) {
    console.log(`  ${c.title}`);
    console.log(`    handle: ${c.handle}`);
    console.log(`    id: ${c.id}`);
    console.log();
  }
}

main().catch(console.error);
