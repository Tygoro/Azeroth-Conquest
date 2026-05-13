/**
 * find-class-map-in-payload.mjs
 *
 * Searches the voljin RSC payload JSON for the class → icon/sprite mapping.
 * The payload contains full class data including any iconClass or similar field.
 *
 * Also searches all downloaded JS chunks for the mapping.
 */

import { readFileSync, readdirSync } from 'fs';

// ── Search payload JSON ───────────────────────────────────────────────────────
const raw = readFileSync('C:/Users/tygoro/Downloads/voljin_payload.json', 'utf8');

// Try parsing as JSON
let payload;
try {
  payload = JSON.parse(raw);
  console.log('Payload type:', typeof payload, Array.isArray(payload) ? 'array' : '');
  if (Array.isArray(payload)) {
    console.log('Array length:', payload.length);
    console.log('First item keys:', payload[0] ? Object.keys(payload[0]) : 'empty');
  } else {
    console.log('Top-level keys:', Object.keys(payload));
  }
} catch (e) {
  console.log('Not valid JSON, treating as text. Error:', e.message);
}

// Search raw text for sprite/icon field in class context
const spriteUnknown = ['demonhunter','fleshwarden','monk','prophet','sonofarugal','spiritmage','wildwalker'];
const coaClasses = ['Felsworn','Bloodmage','Templar','Runemaster','Knight of Xoroth','Primalist','Venomancer'];

console.log('\n=== Raw payload text searches ===');

// Look for "icon" or "sprite" field near classId or className
for (const cls of coaClasses) {
  const idx = raw.indexOf(cls);
  if (idx !== -1) {
    const ctx = raw.slice(Math.max(0, idx - 50), idx + 500);
    console.log(`\n"${cls}" context (500 chars):`);
    console.log(ctx);
  }
}

// Search for fleshwarden in payload
for (const sn of spriteUnknown) {
  const idx = raw.indexOf(sn);
  if (idx !== -1) {
    console.log(`\n"${sn}" found at ${idx}:`);
    console.log(raw.slice(Math.max(0, idx - 150), idx + 200));
  } else {
    console.log(`"${sn}" NOT found in payload`);
  }
}

// ── Search HTML ──────────────────────────────────────────────────────────────
console.log('\n=== HTML searches ===');
const html = readFileSync('C:/Users/tygoro/Downloads/voljin', 'utf8');

for (const sn of spriteUnknown) {
  const idx = html.indexOf(sn);
  if (idx !== -1) {
    console.log(`"${sn}" found in HTML at ${idx}:`);
    console.log(html.slice(Math.max(0, idx - 200), idx + 300));
  } else {
    console.log(`"${sn}" NOT found in HTML`);
  }
}

// ── Check saved JS chunks ─────────────────────────────────────────────────────
console.log('\n=== Saved JS chunk searches ===');
const savedFiles = readdirSync('scripts/manifest-output').filter(f => f.endsWith('.js'));
console.log(`Checking ${savedFiles.length} saved JS files`);

for (const fname of savedFiles) {
  const content = readFileSync(`scripts/manifest-output/${fname}`, 'utf8');
  for (const sn of spriteUnknown) {
    const idx = content.indexOf(sn);
    if (idx !== -1) {
      console.log(`\n"${sn}" found in ${fname} at ${idx}:`);
      console.log(content.slice(Math.max(0, idx - 200), idx + 300));
    }
  }
}

console.log('\nDone.');
