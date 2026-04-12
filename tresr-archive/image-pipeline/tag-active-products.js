/**
 * Tag already-active products with their category tags
 * One-time script to backfill tags for products already live on Shopify
 */

const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });

const STORE = 'becc05-b4.myshopify.com';
const TOKEN = process.env.SHOPIFY_ACCESS_TOKEN;
const headers = { 'X-Shopify-Access-Token': TOKEN, 'Content-Type': 'application/json' };

const PRODUCT_TAGS = {
    // Lazy Cat - already active products
    'most-important-meal':     ['cat-lovers', 'coffee-lovers'],
    'my-favorite-co-worker':   ['cat-lovers', 'coffee-lovers'],
    'my-longest-relationship': ['cat-lovers', 'coffee-lovers'],
    'my-love-language':        ['cat-lovers'],
    'overstimulation':         ['cat-lovers', 'meme-humor'],
    'stop-asking':             ['cat-lovers', 'meme-humor'],
    'the-magic-ingredient':    ['cat-lovers', 'coffee-lovers'],
    'this-coffee-is-broken':   ['cat-lovers', 'coffee-lovers'],
    'warm-cup-a':              ['cat-lovers', 'coffee-lovers'],
    'we-re-broke-rn-but':      ['cat-lovers', 'meme-humor'],
    'when-monday-shows-up':    ['cat-lovers', 'meme-humor'],
    'where-are-your-friends':  ['cat-lovers', 'meme-humor'],
    'will-you-die-without-it': ['cat-lovers', 'coffee-lovers'],
    // Nostalgia - already active products
    'mixed-tape':              ['80s-90s-nostalgia', 'meme-humor'],
    'movie-day-at-school':     ['80s-90s-nostalgia', 'meme-humor'],
    'not-accepting-feedback':  ['80s-90s-nostalgia', 'meme-humor'],
    'not-an-iphone-in-sight':  ['80s-90s-nostalgia', 'meme-humor'],
    'phone-off-the-hook':      ['80s-90s-nostalgia', 'meme-humor'],
    'playing-snake':           ['80s-90s-nostalgia', 'meme-humor'],
    'quarter-gumball-machines':['80s-90s-nostalgia', 'meme-humor'],
    'school-smoking-section':  ['80s-90s-nostalgia', 'meme-humor'],
    'see-saw-nightmares':      ['80s-90s-nostalgia', 'meme-humor'],
    'see-through-phone':       ['80s-90s-nostalgia', 'meme-humor'],
    'slam-the-phone-down':     ['80s-90s-nostalgia', 'meme-humor'],
    'the-struggle-was-real':   ['80s-90s-nostalgia', 'meme-humor'],
    'we-all-had-this-clock':   ['80s-90s-nostalgia', 'meme-humor'],
    'welcome-to-movie-phone':  ['80s-90s-nostalgia', 'meme-humor'],
};

async function tagProduct(handle, newTags) {
    const url = `https://${STORE}/admin/api/2024-01/products.json?handle=${handle}&fields=id,tags,title`;
    const res = await axios.get(url, { headers });
    const products = res.data.products;
    if (!products || products.length === 0) {
        console.log(`  NOT FOUND: ${handle}`);
        return;
    }
    const product = products[0];
    const existing = product.tags ? product.tags.split(', ').map(t => t.trim()) : [];
    const merged = [...new Set([...existing, ...newTags])];
    await axios.put(`https://${STORE}/admin/api/2024-01/products/${product.id}.json`, {
        product: { id: product.id, tags: merged.join(', ') }
    }, { headers });
    console.log(`  Tagged: ${handle} → [${newTags.join(', ')}]`);
}

async function main() {
    console.log('Tagging active products with category tags...\n');
    let count = 0;
    for (const [handle, tags] of Object.entries(PRODUCT_TAGS)) {
        await tagProduct(handle, tags);
        count++;
        if (count % 5 === 0) await new Promise(r => setTimeout(r, 500));
    }
    console.log(`\nDone! Tagged ${count} products`);
}

main().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
