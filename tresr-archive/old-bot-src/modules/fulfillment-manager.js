/**
 * Fulfillment Manager Module
 * Handles in-house fulfillment workflow:
 * - Retrieves high-res artwork for orders
 * - Sends artwork to print shop via email or webhook
 * - Tracks fulfillment status
 */

import { db, incrementMetric } from '../services/database.js';
import { v2 as cloudinary } from 'cloudinary';

export class FulfillmentManager {
  constructor() {
    this.printShopEmail = process.env.PRINT_SHOP_EMAIL;
    this.printShopWebhook = process.env.PRINT_SHOP_WEBHOOK_URL;

    // Configure Cloudinary if available
    if (process.env.CLOUDINARY_CLOUD_NAME) {
      cloudinary.config({
        cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
        api_key: process.env.CLOUDINARY_API_KEY,
        api_secret: process.env.CLOUDINARY_API_SECRET
      });
    }
  }

  /**
   * Send artwork for a specific order
   * @param {string} orderIdOrNumber - Shopify order ID or order number
   * @returns {Object} Result with details of what was sent
   */
  async sendArtwork(orderIdOrNumber) {
    console.log(`Sending artwork for order: ${orderIdOrNumber}`);

    // Get order details from Shopify
    const order = await this.getOrderDetails(orderIdOrNumber);

    if (!order) {
      throw new Error(`Order not found: ${orderIdOrNumber}`);
    }

    // Get artwork for each line item
    const artworkFiles = [];

    for (const item of order.lineItems) {
      const artwork = await this.getArtworkForProduct(item.productId);

      if (artwork) {
        artworkFiles.push({
          productId: item.productId,
          title: item.title,
          sku: item.sku,
          quantity: item.quantity,
          size: item.variantTitle || this.extractSize(item.sku),
          artworkUrl: artwork.url,
          highResUrl: artwork.highResUrl || this.generateHighResUrl(artwork.url)
        });
      } else {
        console.warn(`No artwork found for product: ${item.productId}`);
        artworkFiles.push({
          productId: item.productId,
          title: item.title,
          artworkUrl: null,
          error: 'Artwork not found'
        });
      }
    }

    // Send to print shop
    let sendResult;

    if (this.printShopWebhook) {
      sendResult = await this.sendViaWebhook(order, artworkFiles);
    } else if (this.printShopEmail) {
      sendResult = await this.sendViaEmail(order, artworkFiles);
    } else {
      // Just prepare the package for manual download
      sendResult = await this.prepareForManualDownload(order, artworkFiles);
    }

    // Log fulfillment
    this.logFulfillment(order, artworkFiles, sendResult);

    // Mark order as artwork sent
    db.prepare(`
      INSERT OR REPLACE INTO orders (id, shopify_id, order_number, artwork_sent, artwork_sent_at, line_items)
      VALUES (?, ?, ?, TRUE, datetime('now'), ?)
    `).run(
      `order_${order.id}`,
      order.id,
      order.orderNumber,
      JSON.stringify(order.lineItems)
    );

    incrementMetric('artwork_sent');

    return {
      orderId: order.id,
      orderNumber: order.orderNumber,
      filesSent: artworkFiles.filter(f => f.artworkUrl).length,
      destination: this.printShopWebhook ? 'webhook' : this.printShopEmail ? 'email' : 'manual',
      artworkPackage: sendResult
    };
  }

  /**
   * Send artwork for all pending orders
   */
  async sendAllPendingArtwork() {
    console.log('Sending artwork for all pending orders...');

    // Get orders that haven't had artwork sent
    const pendingOrders = await this.getPendingOrders();

    const results = [];

    for (const order of pendingOrders) {
      try {
        const result = await this.sendArtwork(order.id);
        results.push({ success: true, ...result });
      } catch (error) {
        results.push({
          success: false,
          orderId: order.id,
          orderNumber: order.orderNumber,
          error: error.message
        });
      }
    }

    return {
      count: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  /**
   * Get orders that need artwork sent
   */
  async getPendingOrders() {
    const ShopifyManager = (await import('./shopify-manager.js')).default;
    const shopify = new ShopifyManager();

    const allOrders = await shopify.getOrders('pending');

    // Filter to only orders that haven't had artwork sent
    return allOrders.filter(order => {
      const localOrder = db.prepare(`SELECT artwork_sent FROM orders WHERE shopify_id = ?`).get(order.id);
      return !localOrder?.artwork_sent;
    });
  }

  /**
   * Get order details from Shopify
   */
  async getOrderDetails(orderIdOrNumber) {
    const ShopifyManager = (await import('./shopify-manager.js')).default;
    const shopify = new ShopifyManager();

    // Try to find by order number or ID
    const orders = await shopify.getOrders('recent');
    return orders.find(o =>
      o.id === orderIdOrNumber ||
      o.orderNumber === orderIdOrNumber ||
      String(o.orderNumber) === String(orderIdOrNumber)
    );
  }

  /**
   * Get artwork URL for a product
   */
  async getArtworkForProduct(productId) {
    // First check local database
    const localProduct = db.prepare(`
      SELECT artwork_url FROM products WHERE shopify_id = ?
    `).get(productId);

    if (localProduct?.artwork_url) {
      return {
        url: localProduct.artwork_url,
        highResUrl: this.generateHighResUrl(localProduct.artwork_url)
      };
    }

    // Fallback: fetch from Shopify metafields
    const ShopifyManager = (await import('./shopify-manager.js')).default;
    const shopify = new ShopifyManager();

    const artworkUrl = await shopify.getProductArtwork(productId);

    if (artworkUrl) {
      return {
        url: artworkUrl,
        highResUrl: this.generateHighResUrl(artworkUrl)
      };
    }

    return null;
  }

  /**
   * Generate high-resolution URL for printing
   * Cloudinary transformation for print-ready files
   */
  generateHighResUrl(originalUrl) {
    if (!originalUrl) return null;

    // If it's a Cloudinary URL, transform it
    if (originalUrl.includes('cloudinary')) {
      return originalUrl.replace(
        '/upload/',
        '/upload/w_4500,h_5400,c_fit,q_100,f_png/'
      );
    }

    // For other URLs, return as-is
    return originalUrl;
  }

  /**
   * Extract size from SKU
   */
  extractSize(sku) {
    if (!sku) return 'Unknown';

    const sizePatterns = ['3XL', '2XL', 'XL', 'L', 'M', 'S', 'XS'];
    for (const size of sizePatterns) {
      if (sku.toUpperCase().includes(size)) {
        return size;
      }
    }

    return 'Standard';
  }

  /**
   * Send artwork to print shop via webhook
   */
  async sendViaWebhook(order, artworkFiles) {
    const payload = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      customer: {
        name: order.customerName,
        email: order.customerEmail
      },
      shippingAddress: order.shippingAddress,
      items: artworkFiles.map(file => ({
        productId: file.productId,
        title: file.title,
        sku: file.sku,
        quantity: file.quantity,
        size: file.size,
        artworkUrl: file.highResUrl || file.artworkUrl
      })),
      timestamp: new Date().toISOString()
    };

    try {
      const response = await fetch(this.printShopWebhook, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          // Add authentication header if needed
          // 'Authorization': `Bearer ${process.env.PRINT_SHOP_API_KEY}`
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`Webhook failed: ${response.status}`);
      }

      return {
        method: 'webhook',
        success: true,
        payload
      };
    } catch (error) {
      console.error('Webhook send failed:', error);
      throw error;
    }
  }

  /**
   * Send artwork via email
   * Uses a simple email service (configure as needed)
   */
  async sendViaEmail(order, artworkFiles) {
    // Build email content
    const subject = `TRESR Order #${order.orderNumber} - Artwork Files`;

    const body = `
ORDER DETAILS
=============
Order Number: ${order.orderNumber}
Customer: ${order.customerName}
Email: ${order.customerEmail}

SHIPPING ADDRESS:
${order.shippingAddress?.address1 || ''}
${order.shippingAddress?.city || ''}, ${order.shippingAddress?.province || ''} ${order.shippingAddress?.zip || ''}
${order.shippingAddress?.country || ''}

ITEMS TO PRINT:
${artworkFiles.map(file => `
- ${file.title}
  SKU: ${file.sku}
  Size: ${file.size}
  Quantity: ${file.quantity}
  Artwork: ${file.highResUrl || file.artworkUrl || 'NOT FOUND - PLEASE CHECK'}
`).join('\n')}

-----
Sent automatically by TRESR Bot
    `.trim();

    // For production, integrate with your email service
    // Options: SendGrid, Mailgun, AWS SES, Nodemailer

    console.log('Email would be sent to:', this.printShopEmail);
    console.log('Subject:', subject);
    console.log('Body preview:', body.substring(0, 500));

    // Placeholder - implement actual email sending
    // Example with fetch to email API:
    /*
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.SENDGRID_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: this.printShopEmail }] }],
        from: { email: 'orders@tresr.com' },
        subject,
        content: [{ type: 'text/plain', value: body }]
      })
    });
    */

    return {
      method: 'email',
      to: this.printShopEmail,
      subject,
      itemCount: artworkFiles.length,
      // In production, return actual send confirmation
      note: 'Email sending not configured - see console for preview'
    };
  }

  /**
   * Prepare artwork package for manual download
   * Creates a summary with download links
   */
  async prepareForManualDownload(order, artworkFiles) {
    const downloadPackage = {
      orderId: order.id,
      orderNumber: order.orderNumber,
      createdAt: new Date().toISOString(),
      items: artworkFiles.map(file => ({
        title: file.title,
        sku: file.sku,
        size: file.size,
        quantity: file.quantity,
        downloadUrl: file.highResUrl || file.artworkUrl,
        status: file.artworkUrl ? 'ready' : 'missing'
      }))
    };

    // Store in database for retrieval
    db.prepare(`
      INSERT INTO fulfillment_log (order_id, action, files_sent, destination, status, created_at)
      VALUES (?, 'prepared', ?, 'manual', 'ready', datetime('now'))
    `).run(
      order.id,
      JSON.stringify(downloadPackage.items)
    );

    return {
      method: 'manual',
      downloadPackage
    };
  }

  /**
   * Log fulfillment action
   */
  logFulfillment(order, artworkFiles, sendResult) {
    db.prepare(`
      INSERT INTO fulfillment_log (order_id, action, files_sent, destination, status, created_at)
      VALUES (?, 'sent', ?, ?, 'completed', datetime('now'))
    `).run(
      order.id,
      JSON.stringify(artworkFiles.map(f => ({
        title: f.title,
        url: f.highResUrl || f.artworkUrl
      }))),
      sendResult.method
    );
  }

  /**
   * Get fulfillment status for an order
   */
  getOrderFulfillmentStatus(orderId) {
    const order = db.prepare(`SELECT * FROM orders WHERE shopify_id = ? OR id = ?`).get(orderId, orderId);

    if (!order) {
      return { found: false };
    }

    const logs = db.prepare(`
      SELECT * FROM fulfillment_log WHERE order_id = ? ORDER BY created_at DESC
    `).all(orderId);

    return {
      found: true,
      orderNumber: order.order_number,
      artworkSent: order.artwork_sent,
      artworkSentAt: order.artwork_sent_at,
      history: logs
    };
  }

  /**
   * Generate printable order sheet
   * Returns a formatted text block for print shop
   */
  async generateOrderSheet(orderId) {
    const order = await this.getOrderDetails(orderId);
    const artworkFiles = [];

    for (const item of order.lineItems) {
      const artwork = await this.getArtworkForProduct(item.productId);
      artworkFiles.push({
        ...item,
        artworkUrl: artwork?.highResUrl || artwork?.url || 'MISSING'
      });
    }

    return `
╔══════════════════════════════════════════════════════════════╗
║                    TRESR PRINT ORDER                         ║
╠══════════════════════════════════════════════════════════════╣
║ Order #: ${order.orderNumber.toString().padEnd(50)}║
║ Date: ${new Date().toLocaleDateString().padEnd(53)}║
╠══════════════════════════════════════════════════════════════╣
║ SHIP TO:                                                     ║
║ ${(order.customerName || '').padEnd(60)}║
║ ${(order.shippingAddress?.address1 || '').padEnd(60)}║
║ ${((order.shippingAddress?.city || '') + ', ' + (order.shippingAddress?.province || '') + ' ' + (order.shippingAddress?.zip || '')).padEnd(60)}║
╠══════════════════════════════════════════════════════════════╣
║ ITEMS TO PRINT:                                              ║
${artworkFiles.map(item => `║ ${item.quantity}x ${item.title} (${item.size || 'Standard'})
║    → ${item.artworkUrl.substring(0, 55)}...`).join('\n')}
╚══════════════════════════════════════════════════════════════╝
    `.trim();
  }

  /**
   * Create Cloudinary download link with specific transformations
   * Useful for different print requirements
   */
  createDownloadLink(artworkUrl, options = {}) {
    const {
      format = 'png',
      width = 4500,
      height = 5400,
      quality = 100,
      background = 'transparent'
    } = options;

    if (!artworkUrl || !artworkUrl.includes('cloudinary')) {
      return artworkUrl;
    }

    // Build transformation string
    const transformations = [
      `w_${width}`,
      `h_${height}`,
      'c_fit',
      `q_${quality}`,
      `f_${format}`,
      `b_${background}`
    ].join(',');

    return artworkUrl.replace(
      '/upload/',
      `/upload/${transformations}/`
    );
  }
}

export default FulfillmentManager;
