/**
 * WoW tooltip markup parser.
 *
 * Parses the native WoW formatting markup present in raw tooltip strings
 * exported from the Lua addon, producing a structured `ParsedTooltip` that
 * the renderer can display with correct semantic coloring and section grouping.
 *
 * Handles:
 *   |cAARRGGBB...text...|r  — color regions (AA byte ignored, RRGGBB used)
 *   |TPath\to\icon:w:h:x:y|t — texture embeds (dividers detected, icons stripped)
 *   \n literal newlines
 *   ID / CharacterAdvancement ID junk lines
 *   "Click to learn", "Spend more points…", "Hold SHIFT…" boilerplate
 *   Level N Passive unlock headers
 *   Resource / cast time / cooldown / recharge metadata lines
 */

// ── Token types ───────────────────────────────────────────────────────────────

/** A run of text with an optional explicit color override. */
export interface TextSpan {
  text: string;
  /** CSS hex color e.g. '#ff7070', or undefined for default. */
  color?: string;
}

export type SectionKind =
  | 'unlock-header'   // "Level 10 Passive" / "Level 30 Passive" etc.
  | 'resource'        // mana / energy / rage / focus / runic power cost
  | 'cast-time'       // Instant cast / N sec cast / Channeled / Passive
  | 'cooldown'        // N sec/min cooldown / recharge / charges
  | 'divider'         // |T...ui-tooltipdivider...|t — rendered as HR
  | 'spell-header'    // inline icon + spell name (|T icon|t |c...Name|r)
  | 'description'     // general body text (may contain colored spans)
  | 'shift-hint'      // "Hold SHIFT for more information"
  | 'junk';           // stripped: ID lines, CharacterAdvancement, boilerplate

export interface TooltipSection {
  kind: SectionKind;
  spans: TextSpan[];
  /** Raw text content (spans joined, no color tags) — for pattern matching. */
  raw: string;
}

export interface ParsedTooltip {
  sections: TooltipSection[];
}

// ── Color utilities ───────────────────────────────────────────────────────────

/** Convert a WoW |cAARRGGBB color token to a CSS hex color string. */
function wowColorToCss(token: string): string {
  // token is 8 hex chars: AARRGGBB — drop AA
  const rgb = token.slice(2);
  return `#${rgb.toLowerCase()}`;
}

// ── Tokeniser ─────────────────────────────────────────────────────────────────

type Token =
  | { type: 'text'; value: string }
  | { type: 'color-open'; css: string }
  | { type: 'color-close' }
  | { type: 'texture'; path: string; isDivider: boolean }
  | { type: 'newline' };

/** Lex the raw WoW tooltip string into a flat token stream. */
function tokenise(raw: string): Token[] {
  const tokens: Token[] = [];
  // Regex matches: |cXXXXXXXX  |r  |T...|t  literal \n
  const RE = /\|c([0-9A-Fa-f]{8})|\|r|\|T([^|]+)\|t|\n/g;
  let lastIndex = 0;

  for (const match of raw.matchAll(RE)) {
    const idx = match.index!;
    if (idx > lastIndex) {
      tokens.push({ type: 'text', value: raw.slice(lastIndex, idx) });
    }
    lastIndex = idx + match[0].length;

    if (match[1] !== undefined) {
      tokens.push({ type: 'color-open', css: wowColorToCss(match[1]) });
    } else if (match[0] === '|r') {
      tokens.push({ type: 'color-close' });
    } else if (match[2] !== undefined) {
      const path = match[2];
      const isDivider = /tooltipdivider/i.test(path);
      tokens.push({ type: 'texture', path, isDivider });
    } else {
      tokens.push({ type: 'newline' });
    }
  }

  if (lastIndex < raw.length) {
    tokens.push({ type: 'text', value: raw.slice(lastIndex) });
  }

  return tokens;
}

// ── Span builder ──────────────────────────────────────────────────────────────

interface RawLine {
  spans: TextSpan[];
  isDivider: boolean;
  hasInlineIcon: boolean;
}

/**
 * Walk the token stream, resolve the color stack, and produce a list of
 * raw lines (split on newline tokens) each with their resolved spans.
 */
function buildLines(tokens: Token[]): RawLine[] {
  const lines: RawLine[] = [];
  let currentLine: { spans: TextSpan[]; isDivider: boolean; hasInlineIcon: boolean } = {
    spans: [],
    isDivider: false,
    hasInlineIcon: false,
  };
  const colorStack: string[] = [];

  const flushLine = () => {
    // Merge adjacent same-color spans, drop empty ones.
    const merged: TextSpan[] = [];
    for (const span of currentLine.spans) {
      if (!span.text) continue;
      const prev = merged[merged.length - 1];
      if (prev && prev.color === span.color) {
        prev.text += span.text;
      } else {
        merged.push({ ...span });
      }
    }
    lines.push({ spans: merged, isDivider: currentLine.isDivider, hasInlineIcon: currentLine.hasInlineIcon });
    currentLine = { spans: [], isDivider: false, hasInlineIcon: false };
  };

  for (const tok of tokens) {
    switch (tok.type) {
      case 'color-open':
        colorStack.push(tok.css);
        break;

      case 'color-close':
        colorStack.pop();
        break;

      case 'newline':
        flushLine();
        break;

      case 'texture':
        if (tok.isDivider) {
          currentLine.isDivider = true;
        } else {
          // Inline icon in a spell-header line — suppress the icon itself but
          // mark the line so we can style it as a spell header.
          currentLine.hasInlineIcon = true;
        }
        break;

      case 'text': {
        const color = colorStack.length > 0 ? colorStack[colorStack.length - 1] : undefined;
        currentLine.spans.push({ text: tok.value, color });
        break;
      }
    }
  }

  // Flush final line (no trailing \n in source)
  flushLine();

  return lines;
}

// ── Junk / boilerplate detection ──────────────────────────────────────────────

/** Lines that carry no player-readable information and must be stripped. */
const JUNK_PATTERNS: RegExp[] = [
  // "ID 92140" or "CharacterAdvancement ID 4050" — label + numeric value on same line
  /^\s*(?:CharacterAdvancement\s+)?ID\s+\d+\s*$/i,
  // "ID" alone on a line
  /^\s*(?:CharacterAdvancement\s+)?ID\s*$/i,
  // Bare hex / numeric ID values
  /^\s*[0-9a-f]{4,}\s*$/i,
  // WoW internal UUID fragments embedded in text
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i,
  // "Click to learn" boilerplate
  /^\s*Click to learn\s*$/i,
  // "Spend more points to unlock this talent"
  /^\s*Spend more points to unlock/i,
  // "Hold SHIFT for more information" — kept as shift-hint, not junk
];

const SHIFT_HINT_PATTERN = /Hold SHIFT for more information/i;

function isJunkLine(raw: string): boolean {
  return JUNK_PATTERNS.some(re => re.test(raw));
}

// ── Section classification ────────────────────────────────────────────────────

/**
 * Patterns for metadata section lines that appear before the description body.
 * These are detected on the raw (stripped) text of the line.
 */

const UNLOCK_HEADER_RE = /^Level\s+\d+\s+(?:Passive|Active|Talent)\b/i;
const RESOURCE_RE = /^\d+\s+(?:Mana|Energy|Rage|Focus|Runic\s+Power)\b/i;
const CAST_TIME_RE = /^(?:Instant(?:\s+cast)?|Channeled|Passive|Melee\s+Range|Ranged\s+Range|\d+(?:\.\d+)?\s+sec\s+cast)\b/i;
const COOLDOWN_RE = /^(?:\d+\s+Charges?,?\s*\d*\s*sec\s+recharge|\d+\s+Charges?(?:\s+.*recharge)?|\d+(?:\.\d+)?\s+(?:sec|min)\s+(?:cooldown|recharge)|(?:cooldown|recharge):\s*\d)/i;

function classifyLine(raw: string, hasInlineIcon: boolean): SectionKind {
  const trimmed = raw.trim();
  if (!trimmed) return 'junk';
  if (isJunkLine(trimmed)) return 'junk';
  if (SHIFT_HINT_PATTERN.test(trimmed)) return 'shift-hint';
  if (UNLOCK_HEADER_RE.test(trimmed)) return 'unlock-header';
  if (hasInlineIcon) return 'spell-header';
  if (RESOURCE_RE.test(trimmed)) return 'resource';
  if (CAST_TIME_RE.test(trimmed)) return 'cast-time';
  if (COOLDOWN_RE.test(trimmed)) return 'cooldown';
  return 'description';
}

// ── HTML pre-pass ─────────────────────────────────────────────────────────────
// Manifest-sourced descriptions use HTML (from the builder page's pre-rendered
// markup) rather than WoW |c markup. Strip them to plain text before tokenising.

/** True if the string contains at least one HTML tag. */
function looksLikeHtml(s: string): boolean {
  return /<[a-z/][^>]*>/i.test(s);
}

/**
 * Convert an HTML tooltip description to a WoW-markup-compatible string.
 *
 * Rules applied in order:
 *   1. <span style="color: #RRGGBB">…</span>  →  |cFFRRGGBB…|r  (color preserved)
 *   2. <br>, <br/>, <br />                     →  \n
 *   3. <p>, </p>                               →  \n / stripped
 *   4. <div class="pop-inline-spell">…</div>   →  collapsed to \n
 *   5. All other tags                          →  stripped (content kept)
 *   6. HTML entities                           →  decoded
 *   7. Runs of 3+ newlines                     →  collapsed to 2
 *   8. Per-line whitespace trim
 *
 * Color-annotated spans are converted to WoW |c tokens so the existing
 * tokeniser pipeline renders them with the correct color — no separate
 * renderer path needed.
 */
function htmlToPlainText(html: string): string {
  // 1. Normalise line endings
  let s = html.replace(/\r\n?/g, '\n');

  // 2. Convert color spans to WoW |c tokens before any stripping.
  //    Handles both `style="color: #RRGGBB"` and `style="color: #RRGGBB; ..."`.
  //    AA byte is always FF (fully opaque).
  s = s.replace(
    /<span\s[^>]*style="[^"]*color:\s*(#[0-9A-Fa-f]{3,6})[^"]*"[^>]*>([\s\S]*?)<\/span>/gi,
    (_, hex, inner) => {
      // Normalise short hex (#RGB → #RRGGBB)
      let rgb = hex.replace('#', '');
      if (rgb.length === 3) rgb = rgb.split('').map((c: string) => c + c).join('');
      rgb = rgb.padEnd(6, '0').slice(0, 6).toUpperCase();
      return `|cFF${rgb}${inner}|r`;
    },
  );

  // 3. Block elements → newlines
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/p\s*>/gi, '\n');
  s = s.replace(/<p\s*[^>]*>/gi, '');

  // 4. Strip pop-inline-spell containers — collapse to single \n
  s = s.replace(/<div[^>]*class="pop-inline-spell"[^>]*>[\s\S]*?<\/div>/gi, '\n');

  // 5. Strip all remaining tags — keep inner text
  s = s.replace(/<[^>]+>/g, '');

  // 6. Decode HTML entities
  s = s
    .replace(/&amp;/gi,  '&')
    .replace(/&lt;/gi,   '<')
    .replace(/&gt;/gi,   '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g,   (_, n) => String.fromCharCode(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)));

  // 7. Collapse runs of 3+ newlines → 2
  s = s.replace(/\n{3,}/g, '\n\n');

  // 8. Trim whitespace per line, then overall
  s = s.split('\n').map(l => l.trim()).join('\n').trim();

  return s;
}

// ── Main parser ───────────────────────────────────────────────────────────────

/**
 * Parse a raw WoW tooltip description string into structured sections.
 *
 * Accepts both WoW |c markup (addon-exported spec/sidebar nodes) and HTML
 * (manifest-sourced class tree nodes). HTML is stripped to plain text first;
 * the resulting string is then processed by the same |c tokeniser pipeline.
 *
 * This is the sole entry point for tooltip text processing.
 */
export function parseWowTooltip(raw: string): ParsedTooltip {
  if (!raw || !raw.trim()) {
    return { sections: [] };
  }

  // If the input looks like HTML, strip it to plain text first, then
  // also run stripWowMarkup to remove any raw |c codes that survive HTML stripping
  // (e.g. descriptions that contain both HTML and WoW markup).
  const normalised = looksLikeHtml(raw) ? stripWowMarkup(htmlToPlainText(raw)) : raw;

  const tokens = tokenise(normalised);
  const rawLines = buildLines(tokens);

  const sections: TooltipSection[] = [];

  for (const line of rawLines) {
    const lineRaw = line.spans.map(s => s.text).join('').trim();

    // Divider line — rendered as <hr>
    if (line.isDivider) {
      // If the line also has text (e.g. icon + spell name after a divider),
      // still emit the divider, then fall through to spell-header below.
      sections.push({ kind: 'divider', spans: [], raw: '' });
      // Any text on the same "line" as a divider texture is a spell-header.
      if (lineRaw) {
        sections.push({ kind: 'spell-header', spans: line.spans, raw: lineRaw });
      }
      continue;
    }

    // Completely empty after stripping
    if (!lineRaw) continue;

    const kind = classifyLine(lineRaw, line.hasInlineIcon);
    if (kind === 'junk') {
      if (process.env.NODE_ENV !== 'production') {
        console.debug('[tooltip] stripped junk line:', JSON.stringify(lineRaw));
      }
      continue;
    }

    sections.push({ kind, spans: line.spans, raw: lineRaw });
  }

  // Post-processing: merge consecutive description sections that were split
  // purely by sentence-terminal punctuation within a single paragraph.
  // (WoW sometimes has no \n between sentences in the same ability paragraph.)
  // We do NOT merge across non-description sections.
  const merged: TooltipSection[] = [];
  for (const sec of sections) {
    const prev = merged[merged.length - 1];
    if (
      sec.kind === 'description' &&
      prev?.kind === 'description'
    ) {
      // Append with a space separator, merging spans.
      prev.spans.push({ text: ' ' }, ...sec.spans);
      prev.raw += ' ' + sec.raw;
    } else {
      merged.push(sec);
    }
  }

  if (process.env.NODE_ENV !== 'production' && merged.some(s => s.kind === 'junk')) {
    console.warn('[tooltip] unexpected junk sections survived post-processing:', merged);
  }

  return { sections: merged };
}

// ── Convenience: check if a section is "metadata" (before the description) ───

export function isMetadataSection(kind: SectionKind): boolean {
  return kind === 'unlock-header' || kind === 'resource' || kind === 'cast-time' || kind === 'cooldown';
}

/**
 * Strip all WoW markup codes from a raw string and return plain text.
 * Removes: |cXXXXXXXX color opens, |r color closes, |T...|t texture embeds.
 * Use this centrally before rendering any text that bypasses parseWowTooltip.
 */
export function stripWowMarkup(raw: string): string {
  return raw
    .replace(/\|c[0-9A-Fa-f]{8}/g, '')  // |cAARRGGBB
    .replace(/\|r/g, '')                   // |r
    .replace(/\|T[^|]*\|t/g, '')           // |T...|t texture embeds
    .replace(/\|n/g, '\n')                 // |n literal newline escape
    .trim();
}
