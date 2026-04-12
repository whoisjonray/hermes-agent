/**
 * Design Concepts Database Service
 * Manages pre-researched design concepts for instant retrieval
 *
 * Concepts are populated by the background research worker and
 * consumed by the Telegram bot's /trends command.
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = process.env.DATABASE_PATH || path.join(__dirname, '..', '..', 'data', 'tresr.db');

let db;

function getDb() {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/**
 * Initialize the design_concepts table
 * Called on bot startup
 */
export function initConceptsTable() {
  const db = getDb();

  db.exec(`
    CREATE TABLE IF NOT EXISTS design_concepts (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      title TEXT NOT NULL,
      text_content TEXT,
      design_type TEXT DEFAULT 'typography',
      visual_description TEXT,
      style_notes TEXT,
      source_data TEXT,
      status TEXT DEFAULT 'available',
      rejection_count INTEGER DEFAULT 0,
      times_shown INTEGER DEFAULT 0,
      shopify_product_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      published_at TIMESTAMP,
      UNIQUE(category, text_content)
    )
  `);

  // Create indexes for fast lookups
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_concepts_category_status
    ON design_concepts(category, status)
  `);

  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_concepts_rejection
    ON design_concepts(rejection_count)
  `);

  console.log('Design concepts table initialized');
}

/**
 * Add a new concept to the database
 * Ignores duplicates based on category + text_content
 *
 * @param {Object} concept - The concept to add
 * @returns {Object} - Result with success status and id
 */
export function addConcept(concept) {
  const db = getDb();
  const id = randomUUID();

  try {
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO design_concepts
      (id, category, title, text_content, design_type, visual_description, style_notes, source_data)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      id,
      concept.category,
      concept.title,
      concept.textContent || concept.text_content,
      concept.designType || concept.design_type || 'typography',
      concept.visualDescription || concept.visual_description || null,
      concept.styleNotes || concept.style_notes || null,
      JSON.stringify(concept.sourceData || concept.source_data || {})
    );

    if (result.changes > 0) {
      console.log(`Added concept: "${concept.title}" [${concept.category}]`);
      return { success: true, id, isNew: true };
    } else {
      // Duplicate - already exists
      return { success: true, id: null, isNew: false, reason: 'duplicate' };
    }
  } catch (error) {
    console.error('Error adding concept:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Add multiple concepts in a batch
 *
 * @param {Array} concepts - Array of concepts to add
 * @returns {Object} - Summary of additions
 */
export function addConceptsBatch(concepts) {
  const results = { added: 0, duplicates: 0, errors: 0 };

  for (const concept of concepts) {
    const result = addConcept(concept);
    if (result.isNew) {
      results.added++;
    } else if (result.reason === 'duplicate') {
      results.duplicates++;
    } else {
      results.errors++;
    }
  }

  return results;
}

/**
 * Get a random available concept for a category
 * Prioritizes concepts with lower rejection counts
 *
 * @param {string} category - The category to get a concept for
 * @param {Array} excludeIds - IDs to exclude (e.g., already shown this session)
 * @returns {Object|null} - Random concept or null if none available
 */
export function getRandomConcept(category, excludeIds = []) {
  const db = getDb();

  // Build exclusion clause
  let excludeClause = '';
  if (excludeIds.length > 0) {
    const placeholders = excludeIds.map(() => '?').join(',');
    excludeClause = `AND id NOT IN (${placeholders})`;
  }

  // Get available concepts, weighted towards lower rejection counts
  const stmt = db.prepare(`
    SELECT * FROM design_concepts
    WHERE category = ?
    AND status = 'available'
    ${excludeClause}
    ORDER BY rejection_count ASC, RANDOM()
    LIMIT 1
  `);

  const params = [category, ...excludeIds];
  const concept = stmt.get(...params);

  if (concept) {
    // Increment times_shown
    db.prepare(`
      UPDATE design_concepts SET times_shown = times_shown + 1 WHERE id = ?
    `).run(concept.id);

    // Parse source_data JSON
    if (concept.source_data) {
      try {
        concept.sourceData = JSON.parse(concept.source_data);
      } catch (e) {
        concept.sourceData = {};
      }
    }
  }

  return concept || null;
}

/**
 * Increment rejection count for a concept
 * Marks as 'exhausted' if rejection_count >= 3
 *
 * @param {string} id - Concept ID
 * @returns {Object} - Updated concept info
 */
export function incrementRejection(id) {
  const db = getDb();

  // Increment and get new count
  db.prepare(`
    UPDATE design_concepts
    SET rejection_count = rejection_count + 1
    WHERE id = ?
  `).run(id);

  // Check if should be exhausted
  const concept = db.prepare(`
    SELECT id, rejection_count, status FROM design_concepts WHERE id = ?
  `).get(id);

  if (concept && concept.rejection_count >= 3 && concept.status === 'available') {
    db.prepare(`
      UPDATE design_concepts SET status = 'exhausted' WHERE id = ?
    `).run(id);
    console.log(`Concept ${id} marked as exhausted (${concept.rejection_count} rejections)`);
    return { ...concept, status: 'exhausted' };
  }

  return concept;
}

/**
 * Mark a concept as published
 *
 * @param {string} id - Concept ID
 * @param {string} shopifyProductId - Shopify product ID
 * @returns {boolean} - Success status
 */
export function markPublished(id, shopifyProductId) {
  const db = getDb();

  try {
    db.prepare(`
      UPDATE design_concepts
      SET status = 'published',
          shopify_product_id = ?,
          published_at = datetime('now')
      WHERE id = ?
    `).run(shopifyProductId, id);

    console.log(`Concept ${id} marked as published (Shopify: ${shopifyProductId})`);
    return true;
  } catch (error) {
    console.error('Error marking concept as published:', error.message);
    return false;
  }
}

/**
 * Get concept by ID
 *
 * @param {string} id - Concept ID
 * @returns {Object|null} - Concept or null
 */
export function getConceptById(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM design_concepts WHERE id = ?').get(id) || null;
}

/**
 * Normalize text for comparison - strips category prefixes, punctuation, and common variations
 */
function normalizeForComparison(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .trim()
    // Replace newlines with spaces
    .replace(/\n/g, ' ')
    // Remove common category prefixes like "Coffee: " or "Crypto: "
    .replace(/^(coffee|crypto|fitness|gaming|developer|cat|dog|mental health|entrepreneur|nostalgia|meme):\s*/i, '')
    // Remove common suffixes like "T-Shirt" or "Tee"
    .replace(/\s*(t-shirt|tee|shirt)$/i, '')
    // Normalize punctuation - remove trailing periods, normalize commas
    .replace(/[.,!?]+$/, '')
    .replace(/,\s*/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if a concept with similar text already exists (including published)
 * Used to deduplicate - catches near-duplicates like "My Daily Grind" vs "Coffee: My Daily Grind"
 *
 * @param {string} textContent - The text content to check
 * @param {string} category - Optional category to narrow search
 * @returns {boolean} - True if similar concept exists (available OR published)
 */
export function conceptTextExists(textContent, category = null) {
  if (!textContent) return false;

  const db = getDb();
  const normalizedText = normalizeForComparison(textContent);

  // First check exact match (available only - can re-use published text with new design)
  let query, params;
  if (category) {
    query = `
      SELECT COUNT(*) as count FROM design_concepts
      WHERE LOWER(TRIM(text_content)) = ? AND category = ? AND status = 'available'
    `;
    params = [textContent.toLowerCase().trim(), category];
  } else {
    query = `
      SELECT COUNT(*) as count FROM design_concepts
      WHERE LOWER(TRIM(text_content)) = ? AND status = 'available'
    `;
    params = [textContent.toLowerCase().trim()];
  }

  let result = db.prepare(query).get(...params);
  if ((result?.count || 0) > 0) return true;

  // Now check for near-duplicates against ALL concepts (including published)
  // This prevents "Coffee: My Daily Grind" when "My Daily Grind" was published
  const allConcepts = category
    ? db.prepare('SELECT text_content FROM design_concepts WHERE category = ?').all(category)
    : db.prepare('SELECT text_content FROM design_concepts').all();

  for (const concept of allConcepts) {
    const existingNormalized = normalizeForComparison(concept.text_content);
    // Check if one contains the other (catches "My Daily Grind" vs "Coffee: My Daily Grind")
    if (existingNormalized === normalizedText ||
        existingNormalized.includes(normalizedText) ||
        normalizedText.includes(existingNormalized)) {
      console.log(`Near-duplicate detected: "${textContent}" matches existing "${concept.text_content}"`);
      return true;
    }
  }

  return false;
}

/**
 * Check if a concept title already exists among AVAILABLE concepts
 *
 * Note: Only checks 'available' concepts - published/exhausted concepts are
 * allowed to regenerate since the design will be different.
 *
 * @param {string} title - The title to check
 * @param {string} category - Optional category to narrow search
 * @returns {boolean} - True if similar title exists and is available
 */
export function conceptTitleExists(title, category = null) {
  if (!title) return false;

  const db = getDb();
  const normalizedTitle = title.toLowerCase().trim();

  let query, params;
  if (category) {
    query = `
      SELECT COUNT(*) as count FROM design_concepts
      WHERE LOWER(TRIM(title)) = ? AND category = ? AND status = 'available'
    `;
    params = [normalizedTitle, category];
  } else {
    query = `
      SELECT COUNT(*) as count FROM design_concepts
      WHERE LOWER(TRIM(title)) = ? AND status = 'available'
    `;
    params = [normalizedTitle];
  }

  const result = db.prepare(query).get(...params);
  return (result?.count || 0) > 0;
}

/**
 * Get statistics about concepts
 *
 * @returns {Object} - Stats by category and status
 */
export function getConceptStats() {
  const db = getDb();

  const byCategory = db.prepare(`
    SELECT category, status, COUNT(*) as count
    FROM design_concepts
    GROUP BY category, status
  `).all();

  const totals = db.prepare(`
    SELECT
      COUNT(*) as total,
      SUM(CASE WHEN status = 'available' THEN 1 ELSE 0 END) as available,
      SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) as published,
      SUM(CASE WHEN status = 'exhausted' THEN 1 ELSE 0 END) as exhausted
    FROM design_concepts
  `).get();

  const avgRejections = db.prepare(`
    SELECT AVG(rejection_count) as avg_rejections
    FROM design_concepts
    WHERE status = 'exhausted'
  `).get();

  return {
    totals,
    byCategory,
    avgRejectionsBeforeExhaustion: avgRejections?.avg_rejections || 0
  };
}

/**
 * Get available concept count for a category
 *
 * @param {string} category - Category to check
 * @returns {number} - Count of available concepts
 */
export function getAvailableCount(category) {
  const db = getDb();
  const result = db.prepare(`
    SELECT COUNT(*) as count FROM design_concepts
    WHERE category = ? AND status = 'available'
  `).get(category);
  return result?.count || 0;
}

/**
 * Reset exhausted concepts (for testing/admin)
 *
 * @param {string} category - Optional category to reset
 * @returns {number} - Number of concepts reset
 */
export function resetExhausted(category = null) {
  const db = getDb();

  let stmt;
  if (category) {
    stmt = db.prepare(`
      UPDATE design_concepts
      SET status = 'available', rejection_count = 0
      WHERE status = 'exhausted' AND category = ?
    `);
    return stmt.run(category).changes;
  } else {
    stmt = db.prepare(`
      UPDATE design_concepts
      SET status = 'available', rejection_count = 0
      WHERE status = 'exhausted'
    `);
    return stmt.run().changes;
  }
}

export default {
  initConceptsTable,
  addConcept,
  addConceptsBatch,
  getRandomConcept,
  incrementRejection,
  markPublished,
  getConceptById,
  conceptTextExists,
  conceptTitleExists,
  getConceptStats,
  getAvailableCount,
  resetExhausted
};
