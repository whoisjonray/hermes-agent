/**
 * SQLite Database Service
 */

import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { initConceptsTable } from './conceptDatabase.js';

const DB_PATH = process.env.DATABASE_PATH || './data/tresr.db';

// Ensure data directory exists
const dataDir = dirname(DB_PATH);
if (!existsSync(dataDir)) {
  mkdirSync(dataDir, { recursive: true });
}

export const db = new Database(DB_PATH);

export function initDatabase() {
  console.log('Initializing database...');

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // System state table
  db.exec(`
    CREATE TABLE IF NOT EXISTS system_state (
      key TEXT PRIMARY KEY,
      value TEXT,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Initialize default states
  const initState = db.prepare(`
    INSERT OR IGNORE INTO system_state (key, value) VALUES (?, ?)
  `);
  initState.run('automation_status', 'running');
  initState.run('last_trend_scan', null);
  initState.run('trend_score_threshold', '70');

  // Trends table
  db.exec(`
    CREATE TABLE IF NOT EXISTS trends (
      id TEXT PRIMARY KEY,
      niche TEXT NOT NULL,
      concept TEXT NOT NULL,
      score INTEGER,
      data JSON,
      status TEXT DEFAULT 'pending',
      product_id TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Products table
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id TEXT PRIMARY KEY,
      shopify_id TEXT,
      title TEXT NOT NULL,
      niche TEXT,
      design_url TEXT,
      artwork_url TEXT,
      status TEXT DEFAULT 'active',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Orders tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS orders (
      id TEXT PRIMARY KEY,
      shopify_id TEXT UNIQUE,
      order_number TEXT,
      customer_email TEXT,
      total REAL,
      line_items JSON,
      artwork_sent BOOLEAN DEFAULT FALSE,
      artwork_sent_at TIMESTAMP,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Fulfillment log
  db.exec(`
    CREATE TABLE IF NOT EXISTS fulfillment_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id TEXT,
      action TEXT,
      files_sent JSON,
      destination TEXT,
      status TEXT,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Pending approvals
  db.exec(`
    CREATE TABLE IF NOT EXISTS pending_approvals (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT,
      description TEXT,
      data JSON,
      status TEXT DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      resolved_at TIMESTAMP
    )
  `);

  // Daily metrics
  db.exec(`
    CREATE TABLE IF NOT EXISTS daily_metrics (
      date TEXT PRIMARY KEY,
      trends_scanned INTEGER DEFAULT 0,
      trends_converted INTEGER DEFAULT 0,
      products_created INTEGER DEFAULT 0,
      orders_received INTEGER DEFAULT 0,
      revenue REAL DEFAULT 0,
      artwork_sent INTEGER DEFAULT 0
    )
  `);

  // Design research data (from X API)
  db.exec(`
    CREATE TABLE IF NOT EXISTS design_research (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      niche TEXT NOT NULL,
      data JSON,
      image_count INTEGER,
      top_engagement INTEGER,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Design patterns learned from research
  db.exec(`
    CREATE TABLE IF NOT EXISTS design_patterns (
      niche TEXT PRIMARY KEY,
      patterns JSON,
      guidance JSON,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Designs with full metrics tracking
  db.exec(`
    CREATE TABLE IF NOT EXISTS designs (
      id TEXT PRIMARY KEY,
      niche TEXT,
      concept_name TEXT,
      tagline TEXT,
      style TEXT,
      dalle_prompt TEXT,
      image_url TEXT,
      mockup_url TEXT,
      cloudinary_id TEXT,
      status TEXT DEFAULT 'pending',
      previews INTEGER DEFAULT 0,
      approvals INTEGER DEFAULT 0,
      rejections INTEGER DEFAULT 0,
      regenerations INTEGER DEFAULT 0,
      sales INTEGER DEFAULT 0,
      revenue REAL DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Add mockup_url column if it doesn't exist (migration for existing DBs)
  try {
    db.exec(`ALTER TABLE designs ADD COLUMN mockup_url TEXT`);
  } catch (e) {
    // Column already exists, ignore
  }

  // Design feedback for learning
  db.exec(`
    CREATE TABLE IF NOT EXISTS design_feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      design_id TEXT,
      niche TEXT,
      feedback TEXT,
      design_data JSON,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `);

  // Create indexes for performance
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_designs_niche ON designs(niche);
    CREATE INDEX IF NOT EXISTS idx_designs_status ON designs(status);
    CREATE INDEX IF NOT EXISTS idx_feedback_niche ON design_feedback(niche);
  `);

  // Initialize design concepts table (for pre-researched concepts)
  initConceptsTable();

  console.log('Database initialized');
}

// Helper function to get or create today's metrics
export function getTodayMetrics() {
  const today = new Date().toISOString().split('T')[0];

  let metrics = db.prepare('SELECT * FROM daily_metrics WHERE date = ?').get(today);

  if (!metrics) {
    db.prepare('INSERT INTO daily_metrics (date) VALUES (?)').run(today);
    metrics = db.prepare('SELECT * FROM daily_metrics WHERE date = ?').get(today);
  }

  return metrics;
}

// Helper to increment a metric
export function incrementMetric(field) {
  const today = new Date().toISOString().split('T')[0];

  // Ensure today's record exists
  getTodayMetrics();

  db.prepare(`UPDATE daily_metrics SET ${field} = ${field} + 1 WHERE date = ?`).run(today);
}

export default db;
