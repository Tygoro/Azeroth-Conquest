/**
 * fetch-js-for-class-map.mjs
 *
 * Fetches JS chunks from the live builder and searches for the class→sprite-name mapping.
 * We're specifically looking for how classId or className maps to sprite names like
 * "demonhunter", "fleshwarden", "monk", "prophet", "sonofarugal", "spiritmage", "wildwalker"
 * since those don't directly match CoA class names.
 */

import { readFileSync, writeFileSync, mkdirSync } from 'fs';

const BASE = 'https://ascension.gg';
const html = readFileSync('C:/Users/tygoro/Downloads/voljin', 'utf8');

// Get all JS chunk URLs from HTML
const jsChunkMatches = [...html.matchAll(/src="(\/_next\/static\/[^"]+\.js)"/g)];
const jsChunks = [...new Set(jsChunkMatches.map(m => m[1]))];
console.log(`Total JS chunks: ${jsChunks.length}`);

// Sprite names that need a class mapping
const unknownSpriteNames = ['demonhunter', 'fleshwarden', 'monk', 'prophet', 'sonofarugal', 'spiritmage', 'wildwalker', 'venomancer'];
// CoA class names / ids
const coaClassNames = ['Felsworn', 'Bloodmage', 'Templar', 'Runemaster', 'Knight of Xoroth', 'Primalist', 'Venomancer'];
const coaClassIds = [14, 17, 18, 19, 20, 29, 30, 31, 32];

const allHits = {};

for (const jsPath of jsChunks) {
  const url = BASE + jsPath;
  try {
    const resp = await fetch(url, { signal: AbortSignal.timeout(12000) });
    if (!resp.ok) { process.stdout.write('F'); continue; }
    const text = await resp.text();

    let hitCount = 0;
    const hits = [];

    // Check for sprite name mappings
    for (const sn of unknownSpriteNames) {
      const idx = text.indexOf(`"${sn}"`);
      if (idx !== -1) {
        const ctx = text.slice(Math.max(0, idx - 150), idx + 200);
        hits.push({ type: 'sprite-name', name: sn, context: ctx });
        hitCount++;
      }
      // Also check unquoted
      const idx2 = text.indexOf(`'${sn}'`);
      if (idx2 !== -1) {
        const ctx = text.slice(Math.max(0, idx2 - 150), idx2 + 200);
        hits.push({ type: 'sprite-name-sq', name: sn, context: ctx });
        hitCount++;
      }
    }

    // Check for CoA class names
    for (const cn of coaClassNames) {
      const idx = text.indexOf(`"${cn}"`);
      if (idx !== -1) {
        const ctx = text.slice(Math.max(0, idx - 100), idx + 300);
        // Only include if nearby sprite names
        if (unknownSpriteNames.some(sn => ctx.includes(sn))) {
          hits.push({ type: 'class-name', name: cn, context: ctx });
          hitCount++;
        }
      }
    }

    // Check for classId numbers near sprite names
    for (const cid of coaClassIds) {
      const patterns = [`"classId":${cid}`, `classId:${cid}`, `"id":${cid}`];
      for (const pat of patterns) {
        const idx = text.indexOf(pat);
        if (idx !== -1) {
          const ctx = text.slice(Math.max(0, idx - 50), idx + 400);
          if (unknownSpriteNames.some(sn => ctx.includes(sn))) {
            hits.push({ type: 'classId', id: cid, context: ctx });
            hitCount++;
          }
        }
      }
    }

    // Check for the "class-" prefix pattern as used in CSS
    const classHyphens = [...text.matchAll(/class-(demonhunter|fleshwarden|monk|prophet|sonofarugal|spiritmage|wildwalker|venomancer)/g)];
    if (classHyphens.length > 0) {
      classHyphens.forEach(m => {
        const idx = m.index;
        const ctx = text.slice(Math.max(0, idx - 100), idx + 200);
        hits.push({ type: 'class-hyphen', name: m[1], context: ctx });
        hitCount++;
      });
    }

    if (hitCount > 0) {
      console.log(`\n✓ HIT: ${jsPath} (${text.length} chars, ${hitCount} hits)`);
      hits.forEach(h => {
        console.log(`  [${h.type}] ${h.name || h.id}:`);
        console.log(`    ${h.context.replace(/\n/g, ' ').slice(0, 250)}`);
      });
      allHits[jsPath] = hits;

      // Save this chunk
      const fname = jsPath.replace(/\//g, '_').replace(/^_/, '');
      writeFileSync(`scripts/manifest-output/${fname}`, text);
    } else {
      process.stdout.write('.');
    }
  } catch (e) {
    process.stdout.write('e');
  }
}

console.log(`\n\nTotal chunks with hits: ${Object.keys(allHits).length}`);
writeFileSync('scripts/manifest-output/class-sprite-hits.json', JSON.stringify(allHits, null, 2));
console.log('Saved class-sprite-hits.json');
