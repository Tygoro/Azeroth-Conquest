import { readFileSync } from 'fs';

const html = readFileSync('C:/Users/tygoro/Downloads/voljin', 'utf8');

// Find CSS bundle URLs
const cssMatches = [...html.matchAll(/_next\/static\/css\/[^"']+/g)];
console.log('=== CSS bundles ===');
[...new Set(cssMatches.map(m => m[0]))].forEach(u => console.log(u));

// Find any background-position with coa-builder-icon
const bgMatches = [...html.matchAll(/coa-builder-icon[^;"}]{0,300}/g)];
console.log('\n=== coa-builder-icon references ===');
bgMatches.slice(0, 20).forEach(m => console.log(m[0].slice(0, 200)));

// Find class icon CSS classes (they follow a pattern like .class-icon-barbarian or similar)
const classIconMatches = [...html.matchAll(/background-position:[^;}"]{5,80}/g)];
console.log('\n=== background-position values (first 40) ===');
classIconMatches.slice(0, 40).forEach(m => console.log(m[0]));
