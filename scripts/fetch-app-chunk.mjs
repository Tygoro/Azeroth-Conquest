/**
 * fetch-app-chunk.mjs
 *
 * Fetches all JS chunks from the builder that we haven't saved yet,
 * looking for the class → sprite name mapping.
 * Focuses on chunks NOT yet downloaded.
 */

import { readFileSync, writeFileSync, readdirSync, existsSync } from 'fs';

const BASE = 'https://ascension.gg';
const html = readFileSync('C:/Users/tygoro/Downloads/voljin', 'utf8');

// Get all JS chunk URLs from HTML
const jsChunkMatches = [...html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)];
const jsChunks = [...new Set(jsChunkMatches.map(m => m[1]))];

// Get page-level chunks (app/page.js files from __next_f RSC stream)
const pageChunks = [...html.matchAll(/"(\/_next\/static\/chunks\/[^"]+\.js)"/g)].map(m => m[1]);
const allChunks = [...new Set([...jsChunks, ...pageChunks])];

// Check which ones we haven't saved
const savedFiles = new Set(readdirSync('scripts/manifest-output').filter(f => f.endsWith('.js')));
const unsaved = allChunks.filter(c => {
  const fname = c.replace(/\//g, '_').replace(/^_/, '');
  return !savedFiles.has(fname);
});

console.log(`Total chunks: ${allChunks.length}, unsaved: ${unsaved.length}`);

// Target words to search
const targets = [
  'fleshwarden', 'sonofarugal', 'spiritmage', 'wildwalker',
  'demonhunter', 'class-demonhunter', 'class-fleshwarden',
  'class-monk', 'class-prophet', 'class-sonofarugal',
  'class-spiritmage', 'class-wildwalker',
  '"Venomancer"', 'venomancer',
  'classId":14', 'classId":17', 'classId":19', 'classId":20',
  'classId":29', 'classId":31', 'classId":32',
];

const hits = {};

for (const jsPath of unsaved) {
  const url = BASE + jsPath;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!resp.ok) { process.stdout.write('F'); continue; }
    const text = await resp.text();

    const foundTargets = targets.filter(t => text.includes(t));

    if (foundTargets.length > 0) {
      const fname = jsPath.replace(/\//g, '_').replace(/^_/, '');
      console.log(`\n✓ HIT: ${jsPath} (${text.length} chars)`);
      console.log('  Found targets:', foundTargets);

      for (const t of foundTargets) {
        const idx = text.indexOf(t);
        const ctx = text.slice(Math.max(0, idx - 150), idx + 300);
        console.log(`\n  "${t}" context:`);
        console.log(' ', ctx.replace(/\n/g, ' '));
      }

      hits[jsPath] = { size: text.length, foundTargets };
      writeFileSync(`scripts/manifest-output/${fname}`, text);
    } else {
      process.stdout.write('.');
    }
  } catch (e) {
    process.stdout.write('e');
  }
}

console.log(`\n\nTotal hits: ${Object.keys(hits).length}`);

// Also search for the chunk that might contain the class selector component
// by looking for "class-barbarian" or "class-chronomancer" in chunks
console.log('\n--- Also checking saved chunk for class-hyphen patterns ---');
const savedChunks = readdirSync('scripts/manifest-output').filter(f => f.endsWith('.js'));
for (const fname of savedChunks) {
  const text = readFileSync(`scripts/manifest-output/${fname}`, 'utf8');
  if (text.includes('class-barbarian') || text.includes('class-chronomancer')) {
    console.log(`  ${fname}: contains class-barbarian`);
    const idx = text.indexOf('class-barbarian');
    console.log('  Context:', text.slice(Math.max(0, idx-200), idx+400));
  }
}
