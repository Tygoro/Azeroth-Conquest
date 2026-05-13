/**
 * find-sprite-in-js.mjs
 *
 * Fetches the main Next.js JS chunks from the live Ascension builder and searches
 * them for the class portrait sprite background-position mapping.
 *
 * Usage: node scripts/find-sprite-in-js.mjs
 */

import { readFileSync, writeFileSync } from 'fs';

// JS chunks from the saved voljin HTML
const html = readFileSync('C:/Users/tygoro/Downloads/voljin', 'utf8');

// Extract all unique JS chunk filenames
const jsChunkMatches = [...html.matchAll(/"(_next\/static\/chunks\/[^"]+\.js)"/g)];
const jsChunks = [...new Set(jsChunkMatches.map(m => m[1]))];
console.log(`Found ${jsChunks.length} JS chunks in saved HTML`);

// We want to search large app chunks for sprite data
// Filter to larger/main chunks (not tiny vendor splits)
// The main app bundle is usually the largest chunk
// Also look for chunks with "coa" or "builder" in name
const interestingChunks = jsChunks.filter(c =>
  c.includes('app') || c.includes('main') || c.includes('builder') ||
  c.includes('coa') || c.includes('class') || c.includes('page')
);

console.log('Interesting chunks:', interestingChunks.slice(0, 10));

// Fetch and search each chunk for sprite position data
const BASE = 'https://ascension.gg';
const SPRITE_PATTERNS = [
  /background-?[Pp]osition[^:]*:[^;",]{5,80}/g,
  /backgroundPosition[^:]*:[^,;"]{5,80}/g,
  /coa-builder-icon[^;,"]{0,200}/g,
  /5500%[^;,"]{0,100}/g,
  /81\.4815%|64\.8148%|68\.5185%|55\.5556%/g,  // known sprite positions from old CSS
  /barbarian[^:]{0,30}background[^:]{0,100}/gi,
  /class.*?icon.*?position/gi,
];

const results = {};

// Fetch a subset of chunks — prioritize the largest ones
const chunksToFetch = [...jsChunks].slice(0, 30); // check first 30

for (const chunk of chunksToFetch) {
  const url = `${BASE}/${chunk}`;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!resp.ok) continue;
    const text = await resp.text();

    let found = false;
    for (const pat of SPRITE_PATTERNS) {
      pat.lastIndex = 0;
      const matches = [...text.matchAll(pat)].map(m => m[0].slice(0, 150));
      if (matches.length > 0) {
        if (!results[chunk]) results[chunk] = [];
        results[chunk].push({ pattern: pat.source, matches: matches.slice(0, 5) });
        found = true;
      }
    }

    if (found) {
      console.log(`\n✓ HIT in ${chunk} (${text.length} chars)`);
      for (const entry of results[chunk]) {
        console.log(`  Pattern: ${entry.pattern}`);
        entry.matches.forEach(m => console.log(`    ${m}`));
      }
    } else {
      process.stdout.write('.');
    }
  } catch (e) {
    process.stdout.write('x');
  }
}

console.log('\n\nFull results:');
console.log(JSON.stringify(results, null, 2));

// Save results
writeFileSync('scripts/manifest-output/sprite-search-results.json', JSON.stringify(results, null, 2));
console.log('Saved to scripts/manifest-output/sprite-search-results.json');
