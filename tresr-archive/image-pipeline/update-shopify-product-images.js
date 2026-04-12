/**
 * Update Shopify Product Images
 * Takes generated product images and updates them on Shopify
 * Maintains correct order: Lifestyle, Punchin, Black, Navy, White
 */

const cloudinary = require('cloudinary').v2;
const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

// Configure Cloudinary
cloudinary.config({
    cloud_name: 'dqslerzk9',
    api_key: '364274988183368',
    api_secret: 'gJEAx4VjStv1uTKyi3DiLAwL8pQ'
});

// Shopify API configuration
const SHOPIFY_STORE = 'becc05-b4.myshopify.com';
const SHOPIFY_ACCESS_TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;

if (!SHOPIFY_ACCESS_TOKEN) {
    console.error('❌ SHOPIFY_ACCESS_TOKEN not found in .env file');
    console.error('   Add SHOPIFY_ACCESS_TOKEN=your_token to .env');
    process.exit(1);
}

/**
 * Upload image to Cloudinary
 */
async function uploadToCloudinary(localPath, cloudinaryPath) {
    console.log(`  ⬆️  Uploading ${path.basename(localPath)} to Cloudinary...`);

    const result = await cloudinary.uploader.upload(localPath, {
        public_id: cloudinaryPath,
        resource_type: 'image',
        overwrite: true,
        invalidate: true
    });

    console.log(`  ✅ Uploaded: ${result.secure_url}`);
    return result.secure_url;
}

/**
 * Get product by handle from Shopify
 */
async function getProductByHandle(handle) {
    const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/products.json?handle=${handle}`;

    const response = await axios.get(url, {
        headers: {
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
            'Content-Type': 'application/json'
        }
    });

    if (response.data.products && response.data.products.length > 0) {
        return response.data.products[0];
    }

    throw new Error(`Product not found: ${handle}`);
}

/**
 * Update product images on Shopify
 */
async function updateProductImages(productId, imageUrls) {
    const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/products/${productId}.json`;

    // Build images array with correct position order
    const images = imageUrls.map((url, index) => ({
        src: url,
        position: index + 1
    }));

    const payload = {
        product: {
            id: productId,
            images: images
        }
    };

    console.log(`\n  📤 Updating product images on Shopify...`);

    const response = await axios.put(url, payload, {
        headers: {
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
            'Content-Type': 'application/json'
        }
    });

    console.log(`  ✅ Product updated with ${images.length} images`);
    return response.data.product;
}

/**
 * Link color variants to their matching flat mockup images
 * Black variants -> black flat image, Navy -> navy, White -> white
 */
async function linkVariantsToImages(productId) {
    // Re-fetch product to get fresh image IDs and variants
    const url = `https://${SHOPIFY_STORE}/admin/api/2024-01/products/${productId}.json?fields=images,variants,options`;
    const response = await axios.get(url, {
        headers: {
            'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
            'Content-Type': 'application/json'
        }
    });

    const product = response.data.product;
    const images = product.images;
    const variants = product.variants;

    // Find the Color option index (option1, option2, or option3)
    const colorOptionIndex = product.options.findIndex(o => o.name.toLowerCase() === 'color');
    if (colorOptionIndex === -1) {
        console.log('  ⚠️  No "Color" option found on product - skipping variant linking');
        return;
    }
    const colorKey = `option${colorOptionIndex + 1}`;

    // Map color names to flat mockup images (positions 3, 4, 5)
    // Images are ordered: lifestyle(1), punchin(2), black(3), navy(4), white(5)
    const colorToImage = {};
    for (const img of images) {
        const filename = img.src.split('/').pop().split('?')[0].toLowerCase();
        if (filename.includes('-black')) colorToImage['black'] = img.id;
        else if (filename.includes('-navy')) colorToImage['navy'] = img.id;
        else if (filename.includes('-white')) colorToImage['white'] = img.id;
    }

    console.log('  Color -> Image mapping:');
    Object.entries(colorToImage).forEach(([color, imgId]) => {
        console.log(`    ${color} -> image ${imgId}`);
    });

    // Update each variant with its matching image
    let linked = 0;
    for (const variant of variants) {
        const color = variant[colorKey]?.toLowerCase();
        const imageId = colorToImage[color];

        if (!imageId) continue;

        await axios.put(
            `https://${SHOPIFY_STORE}/admin/api/2024-01/variants/${variant.id}.json`,
            { variant: { id: variant.id, image_id: imageId } },
            {
                headers: {
                    'X-Shopify-Access-Token': SHOPIFY_ACCESS_TOKEN,
                    'Content-Type': 'application/json'
                }
            }
        );
        linked++;
    }

    console.log(`  ✅ Linked ${linked} variants to their color images`);
}

/**
 * Main workflow
 */
async function updateShopifyProductImages(localImagePaths, productHandle, slug) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🛍️  UPDATING SHOPIFY PRODUCT: ${productHandle}`);
    console.log(`${'='.repeat(60)}\n`);

    try {
        // Step 1: Upload images to Cloudinary
        console.log('📤 STEP 1: Uploading to Cloudinary\n');

        const cloudinaryUrls = [];

        // Position 1: Lifestyle (first image seen from ads)
        if (localImagePaths.lifestyle) {
            const url = await uploadToCloudinary(
                localImagePaths.lifestyle,
                `tresr/product-images/lifestyle/${slug}`
            );
            cloudinaryUrls.push(url);
        }

        // Position 2: Punchin
        if (localImagePaths.punchin) {
            const url = await uploadToCloudinary(
                localImagePaths.punchin,
                `tresr/product-images/punchin/${slug}`
            );
            cloudinaryUrls.push(url);
        }

        // Position 3: Black flat
        if (localImagePaths.black) {
            const url = await uploadToCloudinary(
                localImagePaths.black,
                `tresr/product-images/flat/${slug}-black`
            );
            cloudinaryUrls.push(url);
        }

        // Position 4: Navy flat
        if (localImagePaths.navy) {
            const url = await uploadToCloudinary(
                localImagePaths.navy,
                `tresr/product-images/flat/${slug}-navy`
            );
            cloudinaryUrls.push(url);
        }

        // Position 5: White flat
        if (localImagePaths.white) {
            const url = await uploadToCloudinary(
                localImagePaths.white,
                `tresr/product-images/flat/${slug}-white`
            );
            cloudinaryUrls.push(url);
        }

        console.log(`\n✅ Uploaded ${cloudinaryUrls.length} images to Cloudinary\n`);

        // Step 2: Get Shopify product
        console.log('🔍 STEP 2: Fetching Shopify product\n');
        const product = await getProductByHandle(productHandle);
        console.log(`  ✅ Found product: ${product.title} (ID: ${product.id})\n`);

        // Step 3: Update product images
        console.log('🖼️  STEP 3: Updating product images\n');
        const updatedProduct = await updateProductImages(product.id, cloudinaryUrls);

        // Step 4: Link color variants to matching flat mockup images
        console.log('\n🔗 STEP 4: Linking color variants to images\n');
        await linkVariantsToImages(product.id);

        // Success summary
        console.log(`\n${'='.repeat(60)}`);
        console.log('✅ SHOPIFY PRODUCT UPDATED SUCCESSFULLY');
        console.log(`${'='.repeat(60)}\n`);
        console.log(`Product URL: https://tresr.com/products/${productHandle}\n`);
        console.log('Image Order:');
        cloudinaryUrls.forEach((url, index) => {
            const position = index + 1;
            let label = '';
            if (position === 1) label = 'Lifestyle Composite';
            else if (position === 2) label = 'Punchin Closeup';
            else if (position === 3) label = 'Black Flat';
            else if (position === 4) label = 'Navy Flat';
            else if (position === 5) label = 'White Flat';
            console.log(`  ${position}. ${label}`);
            console.log(`     ${url}`);
        });
        console.log('');

    } catch (error) {
        console.error('\n❌ ERROR:', error.message);
        if (error.response) {
            console.error('Response data:', JSON.stringify(error.response.data, null, 2));
        }
        throw error;
    }
}

// CLI usage
if (require.main === module) {
    const args = process.argv.slice(2);

    if (args.length < 2) {
        console.log('Usage: node update-shopify-product-images.js <productHandle> <slug>');
        console.log('');
        console.log('Parameters:');
        console.log('  productHandle - Shopify product handle (e.g., "my-therapist-is-a-chatbot-tee")');
        console.log('  slug          - Design slug matching generated images in temp/');
        console.log('');
        console.log('Example:');
        console.log('  node update-shopify-product-images.js \\');
        console.log('    my-therapist-is-a-chatbot-tee \\');
        console.log('    my-therapist-is-a-chatbot');
        console.log('');
        console.log('Expected files in temp/:');
        console.log('  - {slug}-lifestyle.png');
        console.log('  - {slug}-punchin.png');
        console.log('  - {slug}-black-flat.png');
        console.log('  - {slug}-navy-flat.png');
        console.log('  - {slug}-white-flat.png');
        console.log('');
        console.log('Environment:');
        console.log('  SHOPIFY_ACCESS_TOKEN must be set');
        process.exit(1);
    }

    const productHandle = args[0];
    const slug = args[1];
    const tempDir = path.join(__dirname, '../../temp');

    // Build local image paths
    const localImagePaths = {
        lifestyle: path.join(tempDir, `${slug}-lifestyle.png`),
        punchin: path.join(tempDir, `${slug}-punchin.png`),
        black: path.join(tempDir, `${slug}-black-flat.png`),
        navy: path.join(tempDir, `${slug}-navy-flat.png`),
        white: path.join(tempDir, `${slug}-white-flat.png`)
    };

    // Verify files exist
    const missingFiles = [];
    Object.entries(localImagePaths).forEach(([key, filepath]) => {
        if (!fs.existsSync(filepath)) {
            missingFiles.push(filepath);
        }
    });

    if (missingFiles.length > 0) {
        console.error('❌ Missing image files:');
        missingFiles.forEach(file => console.error(`  - ${file}`));
        console.error('\nRun generate-all-product-images.js first with --test flag');
        process.exit(1);
    }

    updateShopifyProductImages(localImagePaths, productHandle, slug)
        .then(() => {
            console.log('✅ Done!');
            process.exit(0);
        })
        .catch((err) => {
            console.error('❌ Failed:', err.message);
            process.exit(1);
        });
}

module.exports = { updateShopifyProductImages };
