/**
 * Dynamic Mockups Service
 * Uses TRESR's existing Dynamic Mockups API subscription ($19/mo)
 * Based on tresr-creator-app/server/services/dynamicMockups.js
 */

import { v2 as cloudinary } from 'cloudinary';

// Configure Cloudinary
if (process.env.CLOUDINARY_CLOUD_NAME) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
  });
}

export class DynamicMockupsService {
  constructor() {
    this.apiKey = process.env.DYNAMIC_MOCKUPS_API_KEY;
    this.baseUrl = 'https://api.dynamicmockups.com/v1';
    this.enabled = process.env.DYNAMIC_MOCKUPS_ENABLED === 'true';

    console.log('Dynamic Mockups:', this.enabled ? 'Enabled' : 'Disabled');
  }

  /**
   * Get available mockup templates
   */
  async getTemplates() {
    if (!this.apiKey) {
      throw new Error('Dynamic Mockups API key not configured');
    }

    const response = await fetch(`${this.baseUrl}/templates`, {
      headers: {
        'Authorization': `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`Dynamic Mockups API error: ${response.status}`);
    }

    return await response.json();
  }

  /**
   * Generate a mockup with a design
   * @param {Object} options
   * @param {string} options.designUrl - URL of the design image
   * @param {string} options.templateId - Mockup template ID
   * @param {string} options.color - Product color (optional)
   */
  async generateMockup(options) {
    if (!this.apiKey || !this.enabled) {
      console.log('Dynamic Mockups disabled, using placeholder');
      return this.generatePlaceholder(options);
    }

    try {
      const response = await fetch(`${this.baseUrl}/mockups/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          template_id: options.templateId || 'tshirt_front_flat',
          layers: [{
            id: 'design',
            type: 'image',
            url: options.designUrl,
            position: options.position || { x: 0.5, y: 0.4 },
            scale: options.scale || 0.6,
            rotation: options.rotation || 0
          }],
          format: 'png',
          size: 'large',
          background_color: options.color || '#ffffff'
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Dynamic Mockups error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();

      // Upload to Cloudinary for permanent storage
      if (process.env.CLOUDINARY_CLOUD_NAME && data.url) {
        const uploaded = await cloudinary.uploader.upload(data.url, {
          folder: 'tresr/mockups',
          public_id: `mockup_${Date.now()}`
        });

        return {
          url: uploaded.secure_url,
          publicId: uploaded.public_id,
          templateId: options.templateId,
          color: options.color,
          status: 'generated'
        };
      }

      return {
        url: data.url,
        templateId: options.templateId,
        color: options.color,
        status: 'generated'
      };

    } catch (error) {
      console.error('Dynamic Mockups error:', error.message);
      // Fall back to placeholder
      return this.generatePlaceholder(options);
    }
  }

  /**
   * Generate a placeholder mockup (when API unavailable)
   */
  generatePlaceholder(options) {
    const colorMap = {
      'White': '#f5f5f5',
      'Black': '#1a1a1a',
      'Navy': '#1a365d',
      'Red': '#c53030',
      'Blue': '#2b6cb0',
      'Green': '#276749',
      'Gray': '#4a5568'
    };

    const bgColor = colorMap[options.color] || options.color || '#f5f5f5';
    const textColor = ['#f5f5f5', '#ffffff', 'White'].includes(bgColor) ? '#333' : '#fff';

    // Create SVG placeholder
    const svg = `
      <svg width="800" height="800" xmlns="http://www.w3.org/2000/svg">
        <rect width="800" height="800" fill="${bgColor}"/>
        <text x="50%" y="45%" text-anchor="middle" fill="${textColor}"
              font-family="Arial, sans-serif" font-size="32" font-weight="bold">
          T-SHIRT MOCKUP
        </text>
        <text x="50%" y="55%" text-anchor="middle" fill="${textColor}"
              font-family="Arial, sans-serif" font-size="20">
          Design Preview
        </text>
        <rect x="250" y="280" width="300" height="200" fill="none"
              stroke="${textColor}" stroke-width="2" stroke-dasharray="10,5"/>
        <text x="50%" y="50%" text-anchor="middle" fill="${textColor}"
              font-family="Arial, sans-serif" font-size="14" opacity="0.7">
          [Design Area]
        </text>
      </svg>
    `;

    const base64 = Buffer.from(svg).toString('base64');

    return {
      url: `data:image/svg+xml;base64,${base64}`,
      templateId: options.templateId,
      color: options.color,
      status: 'placeholder'
    };
  }

  /**
   * Generate mockups for multiple colors
   */
  async generateColorVariants(designUrl, colors = ['White', 'Black', 'Navy']) {
    const mockups = [];

    for (const color of colors) {
      const mockup = await this.generateMockup({
        designUrl,
        color,
        templateId: 'tshirt_front_flat'
      });
      mockups.push(mockup);
    }

    return mockups;
  }
}

export default DynamicMockupsService;
