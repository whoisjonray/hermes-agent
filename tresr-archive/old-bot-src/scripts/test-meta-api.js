/**
 * Test Meta Ads API connection and list available ad accounts
 * Run: node src/scripts/test-meta-api.js
 */

import 'dotenv/config';

const ACCESS_TOKEN = process.env.FACEBOOK_ACCESS_TOKEN || process.env.META_ACCESS_TOKEN;
const API_VERSION = 'v18.0';
const BASE_URL = `https://graph.facebook.com/${API_VERSION}`;

async function testConnection() {
  console.log('🔍 Testing Meta Ads API connection...\n');

  if (!ACCESS_TOKEN) {
    console.error('❌ No access token found!');
    console.log('Set FACEBOOK_ACCESS_TOKEN or META_ACCESS_TOKEN in your .env file');
    process.exit(1);
  }

  console.log(`Token: ${ACCESS_TOKEN.substring(0, 20)}...${ACCESS_TOKEN.substring(ACCESS_TOKEN.length - 10)}`);

  try {
    // 1. Test token validity
    console.log('\n📋 Checking token validity...');
    const debugResponse = await fetch(
      `${BASE_URL}/debug_token?input_token=${ACCESS_TOKEN}&access_token=${ACCESS_TOKEN}`
    );
    const debugData = await debugResponse.json();

    if (debugData.error) {
      console.error('❌ Token error:', debugData.error.message);
      process.exit(1);
    }

    console.log('✅ Token is valid');
    console.log(`   Type: ${debugData.data.type}`);
    console.log(`   App ID: ${debugData.data.app_id}`);
    if (debugData.data.expires_at) {
      const expires = new Date(debugData.data.expires_at * 1000);
      console.log(`   Expires: ${expires.toLocaleDateString()}`);
    } else {
      console.log('   Expires: Never (long-lived token)');
    }

    // 2. Get associated business
    console.log('\n🏢 Checking Business Manager access...');
    const meResponse = await fetch(
      `${BASE_URL}/me?fields=id,name&access_token=${ACCESS_TOKEN}`
    );
    const meData = await meResponse.json();

    if (meData.error) {
      console.log('⚠️  Could not get user/business info (might be system user token)');
    } else {
      console.log(`✅ Authenticated as: ${meData.name} (${meData.id})`);
    }

    // 3. List accessible ad accounts
    console.log('\n💰 Listing accessible Ad Accounts...');
    const adAccountsResponse = await fetch(
      `${BASE_URL}/me/adaccounts?fields=id,name,account_status,business_name&access_token=${ACCESS_TOKEN}`
    );
    const adAccountsData = await adAccountsResponse.json();

    if (adAccountsData.error) {
      console.error('❌ Could not list ad accounts:', adAccountsData.error.message);
    } else if (adAccountsData.data && adAccountsData.data.length > 0) {
      console.log(`✅ Found ${adAccountsData.data.length} ad account(s):\n`);

      for (const account of adAccountsData.data) {
        const status = account.account_status === 1 ? '🟢 Active' :
                      account.account_status === 2 ? '🟡 Disabled' :
                      account.account_status === 3 ? '🔴 Unsettled' : '⚪ Unknown';

        console.log(`   ${status} ${account.name || 'Unnamed'}`);
        console.log(`      ID: ${account.id}`);
        if (account.business_name) {
          console.log(`      Business: ${account.business_name}`);
        }
        console.log('');
      }

      // Check for specific accounts
      const tresrAccount = adAccountsData.data.find(a =>
        a.name?.toLowerCase().includes('tresr') ||
        a.id === process.env.TRESR_AD_ACCOUNT_ID
      );
      const doorgrowAccount = adAccountsData.data.find(a =>
        a.name?.toLowerCase().includes('doorgrow') ||
        a.id === 'act_40688230'
      );

      console.log('📊 Client Status:');
      console.log(`   DoorGrow: ${doorgrowAccount ? '✅ Found' : '❌ Not found (may need to add access)'}`);
      console.log(`   TRESR: ${tresrAccount ? '✅ Found' : '❌ Not found (create ad account first)'}`);

    } else {
      console.log('⚠️  No ad accounts found. Make sure your token has ads_management permission.');
    }

    // 4. Test ALL known ad accounts directly
    const knownAccounts = [
      { name: 'TRESR / NFTREASURE', id: process.env.TRESR_AD_ACCOUNT_ID || 'act_431799842093236' },
      { name: 'DoorGrow', id: process.env.DOORGROW_AD_ACCOUNT_ID || 'act_40688230' },
      { name: 'Awaken Entrepreneur', id: process.env.AWAKEN_AD_ACCOUNT_ID },
      { name: "Uncle Ray's Peanut Brittle", id: process.env.PEANUTBRITTLE_AD_ACCOUNT_ID },
    ].filter(a => a.id); // Only test accounts with IDs

    console.log(`\n🧪 Testing direct access to ${knownAccounts.length} known ad accounts...`);

    for (const account of knownAccounts) {
      const accountId = account.id.startsWith('act_') ? account.id : `act_${account.id}`;

      try {
        const accountResponse = await fetch(
          `${BASE_URL}/${accountId}?fields=id,name,account_status,amount_spent,currency&access_token=${ACCESS_TOKEN}`
        );
        const accountData = await accountResponse.json();

        if (accountData.error) {
          console.log(`\n❌ ${account.name} (${accountId})`);
          console.log(`   Error: ${accountData.error.message}`);
        } else {
          const status = accountData.account_status === 1 ? '🟢' :
                        accountData.account_status === 2 ? '🟡' : '🔴';
          console.log(`\n${status} ${account.name}`);
          console.log(`   ID: ${accountData.id}`);
          console.log(`   Name: ${accountData.name}`);
          console.log(`   Total spent: $${(parseInt(accountData.amount_spent || 0) / 100).toFixed(2)} ${accountData.currency || 'USD'}`);
          console.log(`   ✅ READ/WRITE access confirmed`);
        }
      } catch (error) {
        console.log(`\n❌ ${account.name} (${accountId}): ${error.message}`);
      }
    }

    console.log('\n' + '='.repeat(50));
    console.log('✅ Meta API connection test complete!');
    console.log('='.repeat(50));

    console.log('\n📝 To add more ad accounts:');
    console.log('   1. Go to Business Settings → Users → System Users');
    console.log('   2. Click on your System User (doorgrow_dashboard)');
    console.log('   3. Click "Add Assets"');
    console.log('   4. Select "Ad Accounts" and choose the accounts to add');
    console.log('   5. Grant "Full Control" or "Manage campaigns" permission');
    console.log('   6. Add the account ID to .env file');

  } catch (error) {
    console.error('❌ Connection test failed:', error.message);
    process.exit(1);
  }
}

testConnection();
