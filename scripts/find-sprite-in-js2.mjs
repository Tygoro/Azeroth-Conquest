/**
 * find-sprite-in-js2.mjs — revised chunk extractor
 */

import { readFileSync, writeFileSync } from 'fs';

const html = readFileSync('C:/Users/tygoro/Downloads/voljin', 'utf8');

// Try multiple quote styles for chunk URLs
const patterns = [
  /_next\/static\/chunks\/[^\s"'<>\\]+\.js/g,
  /src=["']([^"']+_next\/static\/chunks\/[^"']+\.js)["']/g,
  /href=["']([^"']+_next\/static\/[^"']+\.js)["']/g,
];

let chunks = new Set();
for (const pat of patterns) {
  for (const m of html.matchAll(pat)) {
    chunks.add(m[1] || m[0]);
  }
}

console.log(`Found ${chunks.size} chunks`);
console.log([...chunks].slice(0, 20));

// Also search for any mention of class names near sprite data in payload JSON
const payload = readFileSync('C:/Users/tygoro/Downloads/voljin_payload.json', 'utf8');

// Search for backgroundPosition pattern (camelCase, used in React inline styles)
const bgPosMatches = [...payload.matchAll(/backgroundPosition[^:,\]}"]{0,5}:\s*["'][^"']{5,80}["']/g)];
console.log('\nbackgroundPosition in payload (first 10):');
bgPosMatches.slice(0, 10).forEach(m => console.log(' ', m[0].slice(0, 120)));

// Search for "5500" (the known background-size value for the class sprite)
const spriteSizeMatches = [...payload.matchAll(/5500[^,\]}"]{0,100}/g)];
console.log('\n5500% refs in payload (first 5):');
spriteSizeMatches.slice(0, 5).forEach(m => console.log(' ', m[0].slice(0, 120)));

// Search for coa-builder-icon in payload
const coaIconMatches = [...payload.matchAll(/coa-builder-icon[^,\]}"]{0,150}/g)];
console.log('\ncoa-builder-icon refs in payload (first 5):');
coaIconMatches.slice(0, 5).forEach(m => console.log(' ', m[0].slice(0, 150)));

// Search for class-icon or class_icon patterns
const classIconMatches = [...payload.matchAll(/class.{0,5}icon[^,\]}"]{0,100}/gi)];
console.log('\nclass icon pattern in payload (first 10):');
classIconMatches.slice(0, 10).forEach(m => console.log(' ', m[0].slice(0, 120)));

// Search directly for percentage-based background positions
const pctMatches = [...payload.matchAll(/\d{2,3}\.\d{3,4}%/g)];
console.log('\n% background-position-like values in payload (unique, first 20):');
const pctUnique = [...new Set(pctMatches.map(m => m[0]))];
console.log(pctUnique.slice(0, 20));

// Search for known sprite position values
const knownPositions = ['81.4815', '64.8148', '68.5185', '55.5556', '77.7778', '83.3333'];
for (const pos of knownPositions) {
  const found = payload.includes(pos);
  console.log(`Known position ${pos}% in payload: ${found}`);
}

// Now search in the HTML for the same
console.log('\n--- Same checks in voljin HTML ---');
const bgPosMatchesHtml = [...html.matchAll(/backgroundPosition[^:,\]}"]{0,5}:\s*["'][^"']{5,80}["']/g)];
console.log('backgroundPosition in HTML:', bgPosMatchesHtml.slice(0, 5).map(m => m[0].slice(0, 100)));

const spriteSizeHtml = [...html.matchAll(/5500[^,\]}"]{0,100}/g)];
console.log('5500% refs in HTML:', spriteSizeHtml.slice(0, 5).map(m => m[0].slice(0, 100)));

// What chunks ARE referenced in the HTML?
const srcMatches = [...html.matchAll(/src=["']([^"']+)["']/g)].map(m => m[1]);
const staticSrc = srcMatches.filter(s => s.includes('_next'));
console.log('\n_next src references in HTML:', staticSrc.slice(0, 10));

// script src with no quotes (bare attributes)
const bareScript = [...html.matchAll(/<script[^>]+src=([^\s>]+)/g)].map(m => m[1]);
console.log('Bare script srcs:', bareScript.slice(0, 10));

// Check <link> tags for CSS
const linkTags = [...html.matchAll(/<link[^>]+>/g)].map(m => m[0]).filter(t => t.includes('stylesheet') || t.includes('css'));
console.log('CSS link tags:', linkTags.slice(0, 10));

console.log('\nDone.');
