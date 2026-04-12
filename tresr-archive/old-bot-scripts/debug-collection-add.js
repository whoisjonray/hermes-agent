#!/usr/bin/env node
import 'dotenv/config';

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const ALL_FEATURED_ID = 647180321053;

async function getOneProduct() {
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/products.json?limit=1`;
  const response = await fetch(url, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
  });
  const data = await response.json();
  return data.products?.[0];
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

  const data = await response.json();
  console.log('Response status:', response.status);
  console.log('Response body:', JSON.stringify(data, null, 2));
  return response.ok;
}

async function main() {
  const product = await getOneProduct();
  console.log('Testing with product:', product.title);
  console.log('Product ID:', product.id);
  console.log('Collection ID:', ALL_FEATURED_ID);
  console.log('\nAttempting to add to collection...\n');

  await addToCollection(product.id, ALL_FEATURED_ID);
}

main().catch(console.error);
