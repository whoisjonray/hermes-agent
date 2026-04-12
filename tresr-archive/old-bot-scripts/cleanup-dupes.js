import Database from 'better-sqlite3';
const db = new Database('data/tresr.db');

// Get all published concepts
const published = db.prepare("SELECT text_content FROM design_concepts WHERE status = 'published'").all();
const publishedTexts = published.map(p => p.text_content.toLowerCase().replace(/^(coffee|crypto|cat|dog):\s*/i, '').trim());

console.log('Published (normalized):', publishedTexts);

// Find available concepts that are near-duplicates of published
const available = db.prepare("SELECT id, text_content FROM design_concepts WHERE status = 'available'").all();

const toExhaust = [];
for (const concept of available) {
  const normalized = concept.text_content.toLowerCase().replace(/^(coffee|crypto|cat|dog):\s*/i, '').trim();
  for (const pubText of publishedTexts) {
    if (normalized === pubText || normalized.includes(pubText) || pubText.includes(normalized)) {
      toExhaust.push({ id: concept.id, text: concept.text_content, matchedPub: pubText });
      break;
    }
  }
}

console.log('\nNear-duplicates to mark as exhausted:');
console.table(toExhaust);

// Mark them as exhausted
if (toExhaust.length > 0) {
  const stmt = db.prepare("UPDATE design_concepts SET status = 'exhausted' WHERE id = ?");
  for (const item of toExhaust) {
    stmt.run(item.id);
    console.log('Exhausted:', item.text);
  }
}

// Show updated stats
const stats = db.prepare("SELECT status, COUNT(*) as count FROM design_concepts GROUP BY status").all();
console.log('\nUpdated stats:');
console.table(stats);
