#!/usr/bin/env node
/**
 * Background Research Worker
 *
 * Runs independently to populate the design_concepts database.
 * Can be run manually or via cron:
 *   npm run research
 *   Example cron: 0 0,6,12,18 * * * cd /path/to/tresr-bot && npm run research
 *
 * This allows the Telegram bot to respond instantly by pulling
 * from pre-researched concepts instead of hitting APIs in real-time.
 */

import 'dotenv/config';
import { hybridDesignResearch } from '../src/services/designResearch.js';
import { addConceptsBatch, getConceptStats, getAvailableCount } from '../src/services/conceptDatabase.js';
import { initConceptsTable } from '../src/services/conceptDatabase.js';

// Categories to research - synced with trends.js
const CATEGORIES = [
  'coffee',
  'fitness',
  'gaming',
  'dog lovers',
  'cat lovers',
  'mental health',
  'crypto',
  'entrepreneur',
  'developer',
  '80s/90s nostalgia',
  'meme/humor'
];

// How many concepts to generate per category per run
const CONCEPTS_PER_CATEGORY = 5;

// Cap: Skip category if it already has this many available concepts
const MAX_CONCEPTS_PER_CATEGORY = 20;

/**
 * Research a single category and store concepts
 */
async function researchCategory(category) {
  console.log(`\n📊 Researching: ${category.toUpperCase()}`);

  try {
    // Check current available count
    const availableCount = getAvailableCount(category);
    console.log(`   Current available concepts: ${availableCount}/${MAX_CONCEPTS_PER_CATEGORY}`);

    if (availableCount >= MAX_CONCEPTS_PER_CATEGORY) {
      console.log(`   Skipping - already at cap (${MAX_CONCEPTS_PER_CATEGORY})`);
      return { category, skipped: true, reason: 'at_cap' };
    }

    // Run hybrid research (DataForSEO + Google Images + Gemini)
    const concepts = [];

    for (let i = 0; i < CONCEPTS_PER_CATEGORY; i++) {
      console.log(`   Generating concept ${i + 1}/${CONCEPTS_PER_CATEGORY}...`);

      try {
        const research = await hybridDesignResearch(category);

        if (research.designBrief) {
          concepts.push({
            category,
            title: research.designBrief.title,
            textContent: research.designBrief.textContent,
            designType: research.designBrief.designType || 'typography',
            visualDescription: research.designBrief.visualDescription,
            styleNotes: research.designBrief.styleNotes || research.designBrief.styleRecommendation,
            sourceData: {
              salesSignals: research.salesSignals,
              dominantStyles: research.dominantStyles,
              textPatterns: research.textPatterns,
              emotionalTriggers: research.emotionalTriggers,
              researchedAt: new Date().toISOString()
            }
          });
          console.log(`   ✓ Generated: "${research.designBrief.textContent || research.designBrief.title}"`);
        }

        // Small delay between API calls to avoid rate limits
        await sleep(2000);

      } catch (error) {
        console.error(`   ✗ Error generating concept: ${error.message}`);
      }
    }

    // Store concepts in database
    if (concepts.length > 0) {
      const results = addConceptsBatch(concepts);
      console.log(`   Results: ${results.added} added, ${results.duplicates} duplicates, ${results.errors} errors`);
      return { category, ...results };
    }

    return { category, added: 0, duplicates: 0, errors: 0 };

  } catch (error) {
    console.error(`   ✗ Category research failed: ${error.message}`);
    return { category, error: error.message };
  }
}

/**
 * Run research for all categories
 */
async function runFullResearch() {
  console.log('═══════════════════════════════════════════════════════');
  console.log('  TRESR Background Research Worker');
  console.log('  ' + new Date().toISOString());
  console.log('═══════════════════════════════════════════════════════');

  // Initialize database table
  initConceptsTable();

  // Show current stats
  const statsBefore = getConceptStats();
  console.log('\n📈 Current Database Stats:');
  console.log(`   Total concepts: ${statsBefore.totals.total}`);
  console.log(`   Available: ${statsBefore.totals.available}`);
  console.log(`   Published: ${statsBefore.totals.published}`);
  console.log(`   Exhausted: ${statsBefore.totals.exhausted}`);

  // Research each category
  const results = [];
  for (const category of CATEGORIES) {
    const result = await researchCategory(category);
    results.push(result);

    // Longer delay between categories
    await sleep(5000);
  }

  // Summary
  console.log('\n═══════════════════════════════════════════════════════');
  console.log('  RESEARCH COMPLETE');
  console.log('═══════════════════════════════════════════════════════');

  const totalAdded = results.reduce((sum, r) => sum + (r.added || 0), 0);
  const totalDuplicates = results.reduce((sum, r) => sum + (r.duplicates || 0), 0);
  const totalErrors = results.reduce((sum, r) => sum + (r.errors || 0), 0);
  const skipped = results.filter(r => r.skipped).length;

  console.log(`\n📊 Summary:`);
  console.log(`   Categories processed: ${CATEGORIES.length - skipped}`);
  console.log(`   Categories skipped: ${skipped}`);
  console.log(`   New concepts added: ${totalAdded}`);
  console.log(`   Duplicates ignored: ${totalDuplicates}`);
  console.log(`   Errors: ${totalErrors}`);

  // Show updated stats
  const statsAfter = getConceptStats();
  console.log(`\n📈 Updated Database Stats:`);
  console.log(`   Total concepts: ${statsAfter.totals.total}`);
  console.log(`   Available: ${statsAfter.totals.available}`);
  console.log(`   Published: ${statsAfter.totals.published}`);
  console.log(`   Exhausted: ${statsAfter.totals.exhausted}`);

  console.log('\n✅ Research worker finished\n');
}

/**
 * Research a specific category only
 */
async function runSingleCategory(category) {
  console.log('═══════════════════════════════════════════════════════');
  console.log(`  TRESR Research Worker - ${category.toUpperCase()}`);
  console.log('═══════════════════════════════════════════════════════');

  initConceptsTable();
  await researchCategory(category);

  console.log('\n✅ Research complete\n');
}

/**
 * Show database stats only
 */
function showStats() {
  initConceptsTable();
  const stats = getConceptStats();

  console.log('═══════════════════════════════════════════════════════');
  console.log('  TRESR Design Concepts Database Stats');
  console.log('═══════════════════════════════════════════════════════');
  console.log(`\n📊 Totals:`);
  console.log(`   Total concepts: ${stats.totals.total}`);
  console.log(`   Available: ${stats.totals.available}`);
  console.log(`   Published: ${stats.totals.published}`);
  console.log(`   Exhausted: ${stats.totals.exhausted}`);

  console.log(`\n📁 By Category:`);
  const byCategory = {};
  for (const row of stats.byCategory) {
    if (!byCategory[row.category]) byCategory[row.category] = {};
    byCategory[row.category][row.status] = row.count;
  }
  for (const [cat, statuses] of Object.entries(byCategory)) {
    console.log(`   ${cat}: ${statuses.available || 0} available, ${statuses.published || 0} published, ${statuses.exhausted || 0} exhausted`);
  }

  console.log('');
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// CLI handling
const args = process.argv.slice(2);
const command = args[0];

if (command === '--stats') {
  showStats();
} else if (command === '--category' && args[1]) {
  const category = args[1].toLowerCase();
  if (CATEGORIES.includes(category)) {
    runSingleCategory(category);
  } else {
    console.error(`Unknown category: ${category}`);
    console.error(`Available: ${CATEGORIES.join(', ')}`);
    process.exit(1);
  }
} else if (command === '--help') {
  console.log(`
TRESR Background Research Worker

Usage:
  npm run research              Run full research for all categories
  npm run research -- --stats   Show database statistics
  npm run research -- --category <name>  Research single category

Categories: ${CATEGORIES.join(', ')}

The worker queries DataForSEO, Google Images, and Gemini to generate
design concepts and stores them in the database for instant retrieval
by the Telegram bot.
  `);
} else {
  runFullResearch();
}
