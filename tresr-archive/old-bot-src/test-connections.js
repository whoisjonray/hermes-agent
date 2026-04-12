/**
 * Test API Connections
 * Run with: npm test
 */

import 'dotenv/config';

console.log('Testing TRESR Bot API Connections...\n');

const results = [];

// Test Telegram Bot
async function testTelegram() {
  console.log('Testing Telegram Bot...');

  if (!process.env.TELEGRAM_BOT_TOKEN) {
    return { name: 'Telegram', status: 'SKIP', message: 'No token configured' };
  }

  try {
    const response = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`);
    const data = await response.json();

    if (data.ok) {
      return { name: 'Telegram', status: 'OK', message: `Bot: @${data.result.username}` };
    } else {
      return { name: 'Telegram', status: 'FAIL', message: data.description };
    }
  } catch (error) {
    return { name: 'Telegram', status: 'FAIL', message: error.message };
  }
}

// Test Anthropic (Claude)
async function testAnthropic() {
  console.log('Testing Anthropic API...');

  if (!process.env.ANTHROPIC_API_KEY) {
    return { name: 'Anthropic', status: 'SKIP', message: 'No API key configured' };
  }

  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 10,
        messages: [{ role: 'user', content: 'Hi' }]
      })
    });

    if (response.ok) {
      return { name: 'Anthropic', status: 'OK', message: 'API connected' };
    } else {
      const error = await response.json();
      return { name: 'Anthropic', status: 'FAIL', message: error.error?.message || response.status };
    }
  } catch (error) {
    return { name: 'Anthropic', status: 'FAIL', message: error.message };
  }
}

// Test Shopify
async function testShopify() {
  console.log('Testing Shopify API...');

  if (!process.env.SHOPIFY_STORE_URL || !process.env.SHOPIFY_ACCESS_TOKEN) {
    return { name: 'Shopify', status: 'SKIP', message: 'No credentials configured' };
  }

  try {
    const apiVersion = process.env.SHOPIFY_API_VERSION || '2024-01';
    const response = await fetch(
      `https://${process.env.SHOPIFY_STORE_URL}/admin/api/${apiVersion}/shop.json`,
      {
        headers: {
          'X-Shopify-Access-Token': process.env.SHOPIFY_ACCESS_TOKEN
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      return { name: 'Shopify', status: 'OK', message: `Store: ${data.shop.name}` };
    } else {
      return { name: 'Shopify', status: 'FAIL', message: `HTTP ${response.status}` };
    }
  } catch (error) {
    return { name: 'Shopify', status: 'FAIL', message: error.message };
  }
}

// Test DataForSEO
async function testDataForSEO() {
  console.log('Testing DataForSEO API...');

  if (!process.env.DATAFORSEO_LOGIN || !process.env.DATAFORSEO_PASSWORD) {
    return { name: 'DataForSEO', status: 'SKIP', message: 'No credentials configured' };
  }

  try {
    const auth = Buffer.from(
      `${process.env.DATAFORSEO_LOGIN}:${process.env.DATAFORSEO_PASSWORD}`
    ).toString('base64');

    const response = await fetch('https://api.dataforseo.com/v3/appendix/user_data', {
      headers: {
        'Authorization': `Basic ${auth}`
      }
    });

    if (response.ok) {
      const data = await response.json();
      return {
        name: 'DataForSEO',
        status: 'OK',
        message: `Balance: $${data.tasks?.[0]?.result?.[0]?.money?.balance || 'N/A'}`
      };
    } else {
      return { name: 'DataForSEO', status: 'FAIL', message: `HTTP ${response.status}` };
    }
  } catch (error) {
    return { name: 'DataForSEO', status: 'FAIL', message: error.message };
  }
}

// Test X/Twitter
async function testTwitter() {
  console.log('Testing X/Twitter API...');

  if (!process.env.X_BEARER_TOKEN) {
    return { name: 'X/Twitter', status: 'SKIP', message: 'No bearer token configured' };
  }

  try {
    const response = await fetch(
      'https://api.twitter.com/2/tweets/search/recent?query=test&max_results=10',
      {
        headers: {
          'Authorization': `Bearer ${process.env.X_BEARER_TOKEN}`
        }
      }
    );

    if (response.ok) {
      return { name: 'X/Twitter', status: 'OK', message: 'API connected' };
    } else if (response.status === 403) {
      return { name: 'X/Twitter', status: 'WARN', message: 'Connected but may need higher tier' };
    } else {
      return { name: 'X/Twitter', status: 'FAIL', message: `HTTP ${response.status}` };
    }
  } catch (error) {
    return { name: 'X/Twitter', status: 'FAIL', message: error.message };
  }
}

// Test Cloudinary
async function testCloudinary() {
  console.log('Testing Cloudinary...');

  if (!process.env.CLOUDINARY_CLOUD_NAME) {
    return { name: 'Cloudinary', status: 'SKIP', message: 'No credentials configured' };
  }

  try {
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${process.env.CLOUDINARY_CLOUD_NAME}/resources/image`,
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(
            `${process.env.CLOUDINARY_API_KEY}:${process.env.CLOUDINARY_API_SECRET}`
          ).toString('base64')}`
        }
      }
    );

    if (response.ok) {
      return { name: 'Cloudinary', status: 'OK', message: `Cloud: ${process.env.CLOUDINARY_CLOUD_NAME}` };
    } else {
      return { name: 'Cloudinary', status: 'FAIL', message: `HTTP ${response.status}` };
    }
  } catch (error) {
    return { name: 'Cloudinary', status: 'FAIL', message: error.message };
  }
}

// Run all tests
async function runTests() {
  results.push(await testTelegram());
  results.push(await testAnthropic());
  results.push(await testShopify());
  results.push(await testDataForSEO());
  results.push(await testTwitter());
  results.push(await testCloudinary());

  // Print results
  console.log('\n' + '='.repeat(60));
  console.log('RESULTS');
  console.log('='.repeat(60));

  for (const result of results) {
    const statusIcon = result.status === 'OK' ? '✅' :
                       result.status === 'WARN' ? '⚠️' :
                       result.status === 'SKIP' ? '⏭️' : '❌';
    console.log(`${statusIcon} ${result.name.padEnd(15)} ${result.status.padEnd(6)} ${result.message}`);
  }

  console.log('='.repeat(60));

  const okCount = results.filter(r => r.status === 'OK').length;
  const failCount = results.filter(r => r.status === 'FAIL').length;

  console.log(`\n${okCount} passed, ${failCount} failed, ${results.length - okCount - failCount} skipped`);

  if (failCount > 0) {
    console.log('\n⚠️  Some connections failed. Check your .env file.');
    process.exit(1);
  }
}

runTests().catch(console.error);
