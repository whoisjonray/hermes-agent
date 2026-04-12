/**
 * Shopify Service
 * Handles product creation via Shopify Admin API
 */

import fs from 'fs';

const SHOPIFY_STORE = process.env.SHOPIFY_STORE_URL;
const SHOPIFY_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

// Category to Shopify collection mapping
// Maps bot categories to Shopify homepage collection IDs
const CATEGORY_COLLECTIONS = {
  'coffee': 647205978397,              // Homepage - Coffee
  'crypto': 647179436317,              // Homepage - Crypto/Web3
  'gaming': 647207682333,              // Homepage - Gamer
  'developer': 647230783773,           // Homepage - Dev/A.I/Hacker
  'fitness': 650879271197,             // Homepage - Fitness
  'dog lovers': 650879303965,          // Homepage - Dog Lovers
  'mental health': 650879336733,       // Homepage - Mental Health
  'entrepreneur': 650879369501,        // Homepage - Entrepreneur
  'cat lovers': 647209910557,          // Homepage - Cat Lovers
  '80s/90s nostalgia': 647206043933,   // Homepage - 80s/90s Nostalgia
  'meme/humor': 647211614493,          // Homepage - Meme/Humor
};

// All products go to this collection to appear on shop page
const ALL_FEATURED_COLLECTION_ID = 647180321053;

/**
 * Get collection ID for a category
 */
export function getCategoryCollectionId(category) {
  return CATEGORY_COLLECTIONS[category?.toLowerCase()] || null;
}

/**
 * Get the all-featured collection ID
 */
export function getAllFeaturedCollectionId() {
  return ALL_FEATURED_COLLECTION_ID;
}

/**
 * Create a product on Shopify
 */
export async function createShopifyProduct(productData) {
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/products.json`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_TOKEN
    },
    body: JSON.stringify({ product: productData })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`Shopify API error: ${JSON.stringify(error)}`);
  }

  const data = await response.json();
  return data.product;
}

/**
 * Upload image to Shopify and get URL
 */
export async function uploadImageToShopify(imagePath) {
  // If it's already a URL (Cloudinary, etc.), Shopify can use it directly
  if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
    return imagePath;
  }

  // Read image and convert to base64
  const imageBuffer = fs.readFileSync(imagePath);
  const base64Image = imageBuffer.toString('base64');
  const mimeType = imagePath.endsWith('.png') ? 'image/png' : 'image/jpeg';

  // Create a staged upload
  const stagedUploadUrl = `https://${SHOPIFY_STORE}/admin/api/2024-01/graphql.json`;

  const stagedUploadQuery = `
    mutation {
      stagedUploadsCreate(input: {
        resource: PRODUCT_IMAGE,
        filename: "mockup.png",
        mimeType: "image/png",
        httpMethod: POST
      }) {
        stagedTargets {
          url
          resourceUrl
          parameters {
            name
            value
          }
        }
        userErrors {
          field
          message
        }
      }
    }
  `;

  const stagedResponse = await fetch(stagedUploadUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_TOKEN
    },
    body: JSON.stringify({ query: stagedUploadQuery })
  });

  const stagedData = await stagedResponse.json();

  if (stagedData.data?.stagedUploadsCreate?.stagedTargets?.[0]) {
    const target = stagedData.data.stagedUploadsCreate.stagedTargets[0];

    // Upload to staged URL
    const formData = new FormData();
    for (const param of target.parameters) {
      formData.append(param.name, param.value);
    }
    formData.append('file', new Blob([imageBuffer], { type: mimeType }));

    await fetch(target.url, {
      method: 'POST',
      body: formData
    });

    return target.resourceUrl;
  }

  // Fallback: Use base64 directly (works for smaller images)
  return `data:${mimeType};base64,${base64Image}`;
}

/**
 * Add product to collection
 */
export async function addToCollection(productId, collectionId) {
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

  if (!response.ok) {
    console.error('Failed to add to collection');
  }

  return response.json();
}

/**
 * Get collection by handle (e.g., "all-featured")
 */
export async function getCollectionByHandle(handle) {
  // Try custom collections first
  const customUrl = `https://${SHOPIFY_STORE}/admin/api/2024-01/custom_collections.json?handle=${handle}`;
  let response = await fetch(customUrl, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
  });
  let data = await response.json();

  if (data.custom_collections?.length > 0) {
    return data.custom_collections[0];
  }

  // Try smart collections
  const smartUrl = `https://${SHOPIFY_STORE}/admin/api/2024-01/smart_collections.json?handle=${handle}`;
  response = await fetch(smartUrl, {
    headers: { 'X-Shopify-Access-Token': SHOPIFY_TOKEN }
  });
  data = await response.json();

  if (data.smart_collections?.length > 0) {
    return data.smart_collections[0];
  }

  return null;
}

/**
 * Get product by ID
 */
export async function getProduct(productId) {
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/products/${productId}.json`;

  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_TOKEN
    }
  });

  const data = await response.json();
  return data.product;
}

/**
 * Update product
 */
export async function updateProduct(productId, updates) {
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/products/${productId}.json`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'X-Shopify-Access-Token': SHOPIFY_TOKEN
    },
    body: JSON.stringify({ product: updates })
  });

  const data = await response.json();
  return data.product;
}

/**
 * Get all collections
 */
export async function getCollections() {
  const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/custom_collections.json`;

  const response = await fetch(url, {
    headers: {
      'X-Shopify-Access-Token': SHOPIFY_TOKEN
    }
  });

  const data = await response.json();
  return data.custom_collections;
}

export default {
  createShopifyProduct,
  uploadImageToShopify,
  addToCollection,
  getCollectionByHandle,
  getProduct,
  updateProduct,
  getCollections,
  getCategoryCollectionId,
  getAllFeaturedCollectionId
};
