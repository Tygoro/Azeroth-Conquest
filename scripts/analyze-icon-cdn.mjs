import { readFileSync } from 'fs';

const css = readFileSync('scripts/manifest-output/_next_static_chunks_0-j8j-f6dlgw1.css', 'utf8');

// Find all url() references
const urls = [...css.matchAll(/url\(([^)]+)\)/g)].map(m => m[1]);
const unique = [...new Set(urls)];
console.log('All URL references in CSS:');
unique.forEach(u => console.log(' ', u));

// Find the base coa-builder-icon rule
const baseRule = css.match(/\.coa-builder-icon\{[^}]+\}/);
console.log('\nBase .coa-builder-icon rule:', baseRule?.[0]);

// Find talent icon URL pattern in CSS 
const iconPathPattern = [...css.matchAll(/\/icon\/[^"')\s]+/g)];
console.log('\n/icon/ URL patterns:', [...new Set(iconPathPattern.map(m=>m[0]))].slice(0,20));
