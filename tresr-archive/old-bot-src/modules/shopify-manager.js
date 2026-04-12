/**
 * Shopify Manager Module
 * Handles product creation, order management, and artwork attachment
 */

import { db, incrementMetric } from '../services/database.js';

export class ShopifyManager {
  constructor() {
    this.shopUrl = process.env.SHOPIFY_STORE_URL;
    this.accessToken = process.env.SHOPIFY_ACCESS_TOKEN;
    this.apiVersion = process.env.SHOPIFY_API_VERSION || '2024-01';

    if (!this.shopUrl || !this.accessToken) {
      console.warn('Shopify credentials not configured');
    }
  }

  /**
   * Make authenticated request to Shopify Admin API
   */
  async apiRequest(endpoint, method = 'GET', body = null) {
    const url = `https://${this.shopUrl}/admin/api/${this.apiVersion}/${endpoint}`;

    const options = {
      method,
      headers: {
        'X-Shopify-Access-Token': this.accessToken,
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    const response = await fetch(url, options);

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Shopify API error: ${response.status} - ${error}`);
    }

    return response.json();
  }

  /**
   * Create a new product in Shopify
   */
  async createProduct(design) {
    console.log(`Creating Shopify product: ${design.brief?.title || design.title}`);

    const productData = {
      product: {
        title: design.brief?.title || design.title,
        body_html: this.generateProductDescription(design),
        vendor: 'TRESR',
        product_type: 'T-Shirt',
        tags: this.generateTags(design),
        status: 'draft', // Start as draft for review

        // Variants for different sizes
        variants: this.generateVariants(design),

        // Images
        images: design.mockups?.mockups
          ?.filter(m => m.url)
          ?.map(m => ({ src: m.url })) || [],

        // Metafields for artwork storage
        metafields: [
          {
            namespace: 'tresr',
            key: 'artwork_url',
            value: design.artwork?.url || '',
            type: 'url'
          },
          {
            namespace: 'tresr',
            key: 'high_res_artwork',
            value: design.highResUrl || design.artwork?.url || '',
            type: 'url'
          },
          {
            namespace: 'tresr',
            key: 'design_id',
            value: design.id || '',
            type: 'single_line_text_field'
          },
          {
            namespace: 'tresr',
            key: 'niche',
            value: design.trend?.niche || design.niche || '',
            type: 'single_line_text_field'
          }
        ]
      }
    };

    try {
      const result = await this.apiRequest('products.json', 'POST', productData);

      // Update local database
      if (design.id) {
        db.prepare(`
          UPDATE products SET shopify_id = ?, status = 'created' WHERE id = ?
        `).run(result.product.id, design.id);
      }

      incrementMetric('products_created');

      return {
        id: result.product.id,
        title: result.product.title,
        handle: result.product.handle,
        url: `https://${this.shopUrl}/products/${result.product.handle}`,
        adminUrl: `https://${this.shopUrl}/admin/products/${result.product.id}`,
        status: result.product.status,
        artworkUrl: design.artwork?.url
      };
    } catch (error) {
      console.error('Product creation error:', error);
      throw error;
    }
  }

  /**
   * Generate product description HTML
   */
  generateProductDescription(design) {
    const brief = design.brief || {};

    return `
<div class="product-description">
  <p>${brief.visualDescription || 'Premium quality printed tee.'}</p>

  <h4>Features:</h4>
  <ul>
    <li>100% ring-spun cotton</li>
    <li>Pre-shrunk fabric</li>
    <li>Shoulder-to-shoulder taping</li>
    <li>Side-seamed for a retail fit</li>
  </ul>

  <h4>Print Details:</h4>
  <ul>
    <li>High-quality DTG print</li>
    <li>Vibrant, long-lasting colors</li>
    <li>Eco-friendly water-based inks</li>
  </ul>

  <p><strong>Made with care in the USA</strong></p>
</div>
    `.trim();
  }

  /**
   * Generate product tags
   */
  generateTags(design) {
    const tags = ['tresr', 'tshirt'];

    if (design.trend?.niche) {
      tags.push(design.trend.niche);
    }

    if (design.brief?.designType) {
      tags.push(design.brief.designType);
    }

    // Add color tags
    if (design.brief?.colorPalette?.worksOn) {
      tags.push(...design.brief.colorPalette.worksOn);
    }

    return tags.join(', ');
  }

  /**
   * Generate size variants
   */
  generateVariants(design) {
    const sizes = ['S', 'M', 'L', 'XL', '2XL', '3XL'];
    const basePrice = 29;

    // Price adjustments for larger sizes
    const priceAdjustments = {
      'S': 0,
      'M': 0,
      'L': 0,
      'XL': 0,
      '2XL': 3,
      '3XL': 5
    };

    return sizes.map(size => ({
      option1: size,
      price: (basePrice + priceAdjustments[size]).toFixed(2),
      sku: `TRESR-${design.id?.substring(0, 8) || 'DESIGN'}-${size}`,
      inventory_management: 'shopify',
      inventory_policy: 'continue', // Allow overselling (POD)
      requires_shipping: true,
      taxable: true,
      weight: size === '3XL' ? 0.5 : 0.4,
      weight_unit: 'lb'
    }));
  }

  /**
   * Get orders with optional filter
   */
  async getOrders(filter = 'recent') {
    let endpoint = 'orders.json?status=any&limit=50';

    switch (filter) {
      case 'pending':
        endpoint = 'orders.json?fulfillment_status=unfulfilled&limit=50';
        break;
      case 'today':
        const today = new Date().toISOString().split('T')[0];
        endpoint = `orders.json?created_at_min=${today}T00:00:00Z&limit=50`;
        break;
      case 'recent':
      default:
        endpoint = 'orders.json?status=any&limit=25';
    }

    const result = await this.apiRequest(endpoint);

    // Enrich with local artwork status
    return result.orders.map(order => this.enrichOrder(order));
  }

  /**
   * Get new orders since last check
   */
  async getNewOrders() {
    const lastCheck = db.prepare(`SELECT value FROM system_state WHERE key = 'last_order_check'`).get();
    const since = lastCheck?.value || new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();

    const result = await this.apiRequest(
      `orders.json?created_at_min=${since}&status=any&limit=50`
    );

    // Update last check time
    db.prepare(`
      INSERT OR REPLACE INTO system_state (key, value, updated_at)
      VALUES ('last_order_check', datetime('now'), datetime('now'))
    `).run();

    return result.orders.map(order => this.enrichOrder(order));
  }

  /**
   * Enrich order with local data
   */
  enrichOrder(order) {
    const localOrder = db.prepare(`SELECT * FROM orders WHERE shopify_id = ?`).get(order.id);

    return {
      id: order.id,
      orderNumber: order.order_number,
      customerName: order.customer?.first_name + ' ' + order.customer?.last_name,
      customerEmail: order.email,
      total: order.total_price,
      currency: order.currency,
      fulfillmentStatus: order.fulfillment_status,
      lineItems: order.line_items.map(item => ({
        id: item.id,
        productId: item.product_id,
        variantId: item.variant_id,
        title: item.title,
        quantity: item.quantity,
        sku: item.sku,
        price: item.price
      })),
      shippingAddress: order.shipping_address,
      createdAt: new Date(order.created_at).toLocaleDateString(),
      artworkSent: localOrder?.artwork_sent || false,
      artworkSentAt: localOrder?.artwork_sent_at
    };
  }

  /**
   * Get order count for a period
   */
  async getOrdersCount(period = 'today') {
    try {
      let endpoint;

      switch (period) {
        case 'today':
          const today = new Date().toISOString().split('T')[0];
          endpoint = `orders/count.json?created_at_min=${today}T00:00:00Z`;
          break;
        case 'week':
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
          endpoint = `orders/count.json?created_at_min=${weekAgo}`;
          break;
        default:
          endpoint = 'orders/count.json';
      }

      const result = await this.apiRequest(endpoint);
      return result.count;
    } catch (error) {
      console.error('Error getting order count:', error);
      return 0;
    }
  }

  /**
   * Get daily order statistics
   */
  async getDailyOrderStats() {
    const today = new Date().toISOString().split('T')[0];

    try {
      const result = await this.apiRequest(
        `orders.json?created_at_min=${today}T00:00:00Z&status=any`
      );

      const orders = result.orders;
      const revenue = orders.reduce((sum, o) => sum + parseFloat(o.total_price), 0);

      // Count products sold
      const productCount = {};
      for (const order of orders) {
        for (const item of order.line_items) {
          productCount[item.title] = (productCount[item.title] || 0) + item.quantity;
        }
      }

      const topProducts = Object.entries(productCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([title, quantity]) => ({ title, quantity }));

      return {
        count: orders.length,
        revenue,
        avgOrderValue: orders.length > 0 ? revenue / orders.length : 0,
        topProducts
      };
    } catch (error) {
      console.error('Error getting daily stats:', error);
      return { count: 0, revenue: 0, avgOrderValue: 0, topProducts: [] };
    }
  }

  /**
   * Get artwork URL for a product
   */
  async getProductArtwork(productId) {
    try {
      const result = await this.apiRequest(`products/${productId}/metafields.json`);

      const artworkMetafield = result.metafields.find(
        m => m.namespace === 'tresr' && m.key === 'high_res_artwork'
      );

      return artworkMetafield?.value || null;
    } catch (error) {
      console.error('Error getting product artwork:', error);
      return null;
    }
  }

  /**
   * Attach artwork URL to product metafield
   */
  async attachArtwork(productId, artworkUrl, highResUrl = null) {
    const metafields = [
      {
        namespace: 'tresr',
        key: 'artwork_url',
        value: artworkUrl,
        type: 'url'
      }
    ];

    if (highResUrl) {
      metafields.push({
        namespace: 'tresr',
        key: 'high_res_artwork',
        value: highResUrl,
        type: 'url'
      });
    }

    for (const metafield of metafields) {
      await this.apiRequest(`products/${productId}/metafields.json`, 'POST', { metafield });
    }

    return true;
  }

  /**
   * Publish a draft product
   */
  async publishProduct(productId) {
    await this.apiRequest(`products/${productId}.json`, 'PUT', {
      product: {
        id: productId,
        status: 'active'
      }
    });

    return true;
  }

  /**
   * Get a product by ID
   */
  async getProduct(productId) {
    try {
      const result = await this.apiRequest(`products/${productId}.json`);
      return result.product;
    } catch (error) {
      console.error('Error getting product:', error);
      return null;
    }
  }

  /**
   * Update product images
   * @param {string} productId - Shopify product ID
   * @param {string[]} imageUrls - Array of image URLs to set
   */
  async updateProductImages(productId, imageUrls) {
    try {
      // First, delete existing images
      const product = await this.getProduct(productId);
      if (product?.images?.length > 0) {
        for (const image of product.images) {
          try {
            await this.apiRequest(`products/${productId}/images/${image.id}.json`, 'DELETE');
          } catch (e) {
            console.warn(`Failed to delete image ${image.id}:`, e.message);
          }
        }
      }

      // Add new images
      const images = imageUrls.map(url => ({ src: url }));
      await this.apiRequest(`products/${productId}.json`, 'PUT', {
        product: {
          id: productId,
          images
        }
      });

      return true;
    } catch (error) {
      console.error('Error updating product images:', error);
      throw error;
    }
  }

  /**
   * Update product metafield
   */
  async updateMetafield(productId, namespace, key, value, type = 'single_line_text_field') {
    try {
      // Check if metafield exists
      const metafields = await this.apiRequest(`products/${productId}/metafields.json`);
      const existing = metafields.metafields.find(m => m.namespace === namespace && m.key === key);

      if (existing) {
        // Update existing
        await this.apiRequest(`metafields/${existing.id}.json`, 'PUT', {
          metafield: { id: existing.id, value, type }
        });
      } else {
        // Create new
        await this.apiRequest(`products/${productId}/metafields.json`, 'POST', {
          metafield: { namespace, key, value, type }
        });
      }
      return true;
    } catch (error) {
      console.error('Error updating metafield:', error);
      throw error;
    }
  }

  /**
   * Extract product ID from various URL formats
   * Supports:
   * - https://store.myshopify.com/admin/products/123456
   * - https://tresr.com/products/product-handle
   * - https://store.myshopify.com/products/product-handle
   * - Just the product ID: 123456
   */
  async getProductFromUrl(urlOrId) {
    // If it's just a number, use it directly
    if (/^\d+$/.test(urlOrId)) {
      return this.getProduct(urlOrId);
    }

    // Extract from admin URL
    const adminMatch = urlOrId.match(/\/products\/(\d+)/);
    if (adminMatch) {
      return this.getProduct(adminMatch[1]);
    }

    // Extract handle from storefront URL and look up by handle
    const handleMatch = urlOrId.match(/\/products\/([^\/\?]+)/);
    if (handleMatch) {
      const handle = handleMatch[1];
      try {
        const result = await this.apiRequest(`products.json?handle=${handle}`);
        if (result.products && result.products.length > 0) {
          return result.products[0];
        }
      } catch (error) {
        console.error('Error finding product by handle:', error);
      }
    }

    return null;
  }
}

export default ShopifyManager;
