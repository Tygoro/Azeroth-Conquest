/**
 * fetch-page-chunks.mjs
 *
 * Fetches the Next.js page/app chunks that contain the CoA builder React components.
 * These are referenced in __next_f RSC payload as chunk IDs, not in script src tags.
 *
 * Strategy: The RSC payload contains chunk module IDs. We extract those and try
 * the common Next.js chunk URL patterns to find where the class icon mapping lives.
 */

import { readFileSync, writeFileSync } from 'fs';

const BASE = 'https://ascension.gg';
const html = readFileSync('C:/Users/tygoro/Downloads/voljin', 'utf8');
const payload = readFileSync('C:/Users/tygoro/Downloads/voljin_payload.json', 'utf8');

// Target terms to search for
const targets = [
  'fleshwarden', 'sonofarugal', 'spiritmage', 'wildwalker',
  'class-demonhunter', 'class-fleshwarden', 'class-monk',
  'class-prophet', 'class-sonofarugal', 'class-spiritmage', 'class-wildwalker',
  'class-venomancer',
];

// Extract all possible chunk references from the full HTML
// Next.js RSC uses :(C)["chunk/..."] patterns
const rscChunkRefs = [...html.matchAll(/["'](\/_next\/static\/chunks\/[^"']+)["']/g)].map(m => m[1]);
// Also look for number-based chunk IDs near "coa" or "builder"
const allChunks = [...new Set(rscChunkRefs)];
console.log(`Found ${allChunks.length} total chunk references`);

// Try to find main app bundle chunks — usually named "app-" or "page-"
const appChunks = allChunks.filter(c =>
  c.includes('/app-') || c.includes('/page-') || c.includes('/layout-') ||
  c.includes('/coa') || c.includes('/builder')
);
console.log('App-like chunks:', appChunks);

// Also try common patterns for Next.js Turbopack chunks
// The main app chunk is often the largest; let's try fetching chunks we haven't tried
// From the RSC payload, extract module/chunk IDs
const moduleIds = [...payload.matchAll(/"M(\d+)"/g)].map(m => m[1]);
console.log(`RSC module IDs: ${moduleIds.length} found`);

// Build candidate URLs for app page chunks
// In Next.js turbopack, page chunks are often at /app/en/v2/coa-builder/[slug]/page.js
const pageChunkPatterns = [
  '/_next/static/chunks/app/en/v2/coa-builder/voljin/page.js',
  '/_next/static/chunks/app/en/v2/coa-builder/page.js',
  '/_next/static/chunks/app/en/v2/coa-builder/layout.js',
  '/_next/static/chunks/app/layout.js',
  '/_next/static/chunks/app/page.js',
];

// Also try to fetch the turbopack manifest
const manifestUrls = [
  '/_next/static/chunks/turbopack-0w8pa1gfts.ku.js',  // already have this
  '/_next/_buildManifest.js',
  '/_next/static/turbopack-manifest.json',
];

console.log('\n=== Fetching candidate page chunks ===');
for (const path of [...pageChunkPatterns, ...allChunks.filter(c => !c.endsWith('.css'))]) {
  const url = BASE + path;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (!resp.ok) continue;
    const text = await resp.text();

    const foundTargets = targets.filter(t => text.includes(t));
    if (foundTargets.length > 0) {
      console.log(`\n✓ HIT: ${path} (${text.length} chars)`);
      for (const t of foundTargets) {
        const idx = text.indexOf(t);
        const ctx = text.slice(Math.max(0, idx - 200), idx + 400);
        console.log(`  "${t}": ${ctx.replace(/\n/g,' ').slice(0,300)}`);
      }
      const fname = path.replace(/\//g, '_').replace(/^_/, '');
      writeFileSync(`scripts/manifest-output/${fname}`, text);
    }
  } catch (e) {
    // silent
  }
}

// Also fetch manifest JS to get all chunk IDs
console.log('\n=== Fetching build manifest ===');
try {
  const r = await fetch(`${BASE}/_next/static/turbopack-manifest.json`, { signal: AbortSignal.timeout(8000) });
  if (r.ok) {
    const text = await r.text();
    console.log('turbopack-manifest.json:', text.slice(0, 500));
    writeFileSync('scripts/manifest-output/turbopack-manifest.json', text);
  }
} catch(e) {}

// The main chunk containing component logic is often the turbopack JS
// Let's read the already-saved turbopack JS
try {
  const fname = 'scripts/manifest-output/_next_static_chunks_turbopack-0w8pa1gfts.ku.js';
  // Not saved yet, try fetching
  const url = `${BASE}/_next/static/chunks/turbopack-0w8pa1gfts.ku.js`;
  const resp = await fetch(url, { signal: AbortSignal.timeout(15000) });
  if (resp.ok) {
    const text = await resp.text();
    console.log(`\nturbopack chunk: ${text.length} chars`);
    const foundTargets = targets.filter(t => text.includes(t));
    console.log('Found targets:', foundTargets);
    if (foundTargets.length > 0) {
      writeFileSync('scripts/manifest-output/_next_static_chunks_turbopack-0w8pa1gfts.ku.js', text);
      for (const t of foundTargets) {
        const idx = text.indexOf(t);
        console.log(`  "${t}": ${text.slice(Math.max(0,idx-200), idx+300)}`);
      }
    }
  }
} catch(e) { console.log('turbopack fetch error:', e.message); }

console.log('\nDone.');
