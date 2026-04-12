#!/usr/bin/env node
import 'dotenv/config';

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

async function getProductByHandle(handle) {
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/products.json?handle=${handle}`;
  const response = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
  });
  const data = await response.json();
  return data.products?.[0] || null;
}

async function getCollectsForProduct(productId) {
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/collects.json?product_id=${productId}`;
  const response = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
  });
  const data = await response.json();
  return data.collects || [];
}

async function getCollection(collectionId) {
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/custom_collections/${collectionId}.json`;
  const response = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
  });
  const data = await response.json();
  return data.custom_collection;
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
  const handle = process.argv[2] || 'coffee-ukiyo-e-t-shirt-daily-ritual-tee-for-coffee-lovers';

  console.log('Checking product:', handle);
  const product = await getProductByHandle(handle);

  if (!product) {
    console.log('Product not found!');
    return;
  }

  console.log('\nProduct found:');
  console.log('  ID:', product.id);
  console.log('  Title:', product.title);
  console.log('  Status:', product.status);
  console.log('  Published at:', product.published_at);

  console.log('\nChecking collection membership...');
  const collects = await getCollectsForProduct(product.id);

  if (collects.length === 0) {
    console.log('  Product is NOT in any collections!');

    // Add to all-featured
    console.log('\n  Adding to all-featured collection...');
    const allFeaturedId = 647180321053; // from earlier script
    const success = await addToCollection(product.id, allFeaturedId);
    if (success) {
      console.log('  ✅ Added to all-featured!');
    } else {
      console.log('  ❌ Failed to add');
    }
  } else {
    console.log('  Product is in', collects.length, 'collection(s):');
    for (const collect of collects) {
      const collection = await getCollection(collect.collection_id);
      console.log('    -', collection?.title || collect.collection_id);
    }
  }
}

main().catch(console.error);
