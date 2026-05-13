/**
 * fetch-css-sprites.mjs
 *
 * Fetches all CSS chunks from the live Ascension builder and searches for
 * class portrait sprite background-position mappings.
 * Also fetches the JS chunks to find the React inline style objects.
 *
 * Usage: node scripts/fetch-css-sprites.mjs
 */

import { readFileSync, writeFileSync } from 'fs';

const BASE = 'https://ascension.gg';

// CSS files from the saved HTML
const cssFiles = [
  '/_next/static/chunks/10-ima20y-hfn.css',
  '/_next/static/chunks/0p97~sclf1tgr.css',
  '/_next/static/chunks/09tvu3g2u93bl.css',
  '/_next/static/chunks/14~buxndcr6~f.css',
  '/_next/static/chunks/0myc_ujbdw68l.css',
  '/_next/static/chunks/0tlgu6.g55gse.css',
  '/_next/static/chunks/0-j8j-f6dlgw1.css',
];

// Also check all JS chunks from HTML
const html = readFileSync('C:/Users/tygoro/Downloads/voljin', 'utf8');
const jsChunkMatches = [...html.matchAll(/src="(\/_next\/static\/chunks\/[^"]+\.js)"/g)];
const jsChunks = [...new Set(jsChunkMatches.map(m => m[1]))];

console.log(`CSS files: ${cssFiles.length}`);
console.log(`JS chunks: ${jsChunks.length}`);

const SPRITE_PATTERNS = [
  /background-position\s*:[^;{}]{5,100}/g,
  /backgroundPosition\s*:[^,;"'{}]{5,80}/g,
  /coa-builder-icon[^;,}"']{0,200}/g,
  /5500%[^;,}"']{0,100}/g,
  // Known positions from old CSS
  /81\.48|64\.81|68\.51|55\.55|77\.77|83\.33|61\.11|72\.22|53\.70|79\.62|51\.85|87\.03|88\.88|70\.37|66\.66|85\.18|74\.07|75\.92|57\.40|62\.96/g,
  // Class name + background patterns
  /(?:barbarian|witchdoctor|witchhunter|guardian|templar|bloodmage|ranger|chronomancer|necromancer|pyromancer|cultist|starcaller|suncleric|tinker|reaper|venomancer|primalist|runemaster|stormbringer|felsworn|knight)[^;{}"']{0,150}/gi,
];

const allResults = {};

async function searchContent(url, content, type) {
  let hitCount = 0;
  for (const pat of SPRITE_PATTERNS) {
    pat.lastIndex = 0;
    const matches = [...content.matchAll(pat)].map(m => m[0].slice(0, 200));
    if (matches.length > 0) {
      if (!allResults[url]) allResults[url] = { type, hits: [] };
      allResults[url].hits.push({ pattern: pat.source.slice(0, 60), count: matches.length, samples: matches.slice(0, 5) });
      hitCount += matches.length;
    }
  }
  return hitCount;
}

// Fetch all CSS files
console.log('\n=== Fetching CSS files ===');
for (const cssPath of cssFiles) {
  const url = BASE + cssPath;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) { console.log(`  FAIL ${cssPath} (${resp.status})`); continue; }
    const text = await resp.text();
    const hits = await searchContent(url, text, 'css');
    console.log(`  ${cssPath} (${text.length} chars, ${hits} hits)`);

    if (hits > 0) {
      // Save the full CSS for manual inspection
      const fname = cssPath.replace(/\//g, '_').replace(/^_/, '');
      writeFileSync(`scripts/manifest-output/${fname}`, text);
      console.log(`    → Saved to scripts/manifest-output/${fname}`);
    }
  } catch (e) {
    console.log(`  ERROR ${cssPath}: ${e.message}`);
  }
}

// Fetch JS chunks and search for sprite data
console.log('\n=== Fetching JS chunks ===');
let jsHits = 0;
for (const jsPath of jsChunks) {
  const url = BASE + jsPath;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
    if (!resp.ok) { process.stdout.write('F'); continue; }
    const text = await resp.text();
    const hits = await searchContent(url, text, 'js');
    if (hits > 0) {
      jsHits++;
      console.log(`\n✓ HIT: ${jsPath} (${text.length} chars, ${hits} hits)`);
      for (const entry of allResults[url]?.hits ?? []) {
        console.log(`  Pattern: ${entry.pattern} (${entry.count} matches)`);
        entry.samples.forEach(s => console.log(`    ${s}`));
      }
      // Save the JS chunk
      const fname = jsPath.replace(/\//g, '_').replace(/^_/, '');
      writeFileSync(`scripts/manifest-output/${fname}`, text);
    } else {
      process.stdout.write('.');
    }
  } catch (e) {
    process.stdout.write('e');
  }
}

console.log(`\n\n${jsHits} JS chunks had hits`);

writeFileSync('scripts/manifest-output/sprite-search-full.json', JSON.stringify(allResults, null, 2));
console.log('Saved full results to scripts/manifest-output/sprite-search-full.json');
