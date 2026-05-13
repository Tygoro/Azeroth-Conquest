/**
 * probe-icon-cdn.mjs — probe Ascension CDN icon URL patterns
 */
import { readFileSync } from 'fs';

const nodes = JSON.parse(readFileSync('scripts/manifest-output/manifest-nodes-all.json', 'utf8'));
// Pick 5 sample iconPaths
const samples = nodes.slice(0, 5).map(n => n.iconPath).filter(Boolean);

const BASE = 'https://ascension.gg/icon/';

for (const iconPath of samples) {
  // iconPath = "interface/icons/custom_warriorskill_03_border"
  const slug = iconPath.toLowerCase().replace(/\\/g, '/').split('/').pop();
  const exts = ['', '.webp', '.jpg', '.png'];

  console.log(`\nTesting slug: ${slug}`);
  for (const ext of exts) {
    const url = BASE + slug + ext;
    try {
      const resp = await fetch(url, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
      console.log(`  ${url} → ${resp.status} ${resp.headers.get('content-type') ?? ''}`);
      if (resp.ok) break;
    } catch (e) {
      console.log(`  ${url} → ERROR: ${e.message}`);
    }
  }
}

// Also test the known zamimg URL pattern for comparison
console.log('\nZamimg pattern test:');
const testSlug = 'custom_warriorskill_03_border';
const zamUrl = `https://wow.zamimg.com/images/wow/icons/large/${testSlug}.jpg`;
try {
  const r = await fetch(zamUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
  console.log(`  ${zamUrl} → ${r.status}`);
} catch(e) { console.log(`  zamimg ERROR: ${e.message}`); }

// Test ascension icon with .webp on a known working icon
const knownUrl = 'https://ascension.gg/icon/coa-builder-icon.webp';
try {
  const r = await fetch(knownUrl, { method: 'HEAD', signal: AbortSignal.timeout(5000) });
  console.log(`\nKnown sprite URL: ${knownUrl} → ${r.status} (${r.headers.get('content-type')})`);
} catch(e) { console.log('Known URL error:', e.message); }
