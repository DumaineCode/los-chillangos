/**
 * Hero-quote accent markup parser.
 *
 * The homepage hero `quote` is owner-authored CMS text. The owner marks the
 * part(s) that should render in the brand pink accent (`--terra` / #FF2E7A)
 * by wrapping them in a matched pair of asterisks, e.g.:
 *
 *   "La vida es *corta*"          → "corta" is highlighted
 *   "Vive *hoy*, no *mañana*."    → "hoy" and "mañana" are highlighted
 *
 * This is a PURE function — no React, no I/O. It turns the raw string into an
 * ordered list of `{ text, accent }` segments. The renderer then emits a plain
 * text node for `accent: false` segments and a `<span className="hero-accent">`
 * for `accent: true` ones. Because the renderer builds REAL React nodes from
 * these segments (never `dangerouslySetInnerHTML`), every character is
 * auto-escaped by React — the markup is XSS-safe by construction.
 *
 * Documented behavior for edge cases (owner input is untrusted):
 *   - No asterisks           → one plain segment with the whole string.
 *   - Matched `*...*`         → an accent segment; the asterisks are NEVER
 *                               present in any segment's `text`.
 *   - Multiple spans          → allowed; plain runs between/around them are
 *                               preserved as separate plain segments.
 *   - Unmatched lone `*`      → treated as a LITERAL asterisk in plain text
 *                               (no accent). Malformed markup must not silently
 *                               drop authored content.
 *   - Empty highlight `**`    → dropped entirely: no accent segment and no
 *                               visible asterisks (nothing to highlight).
 *   - Empty string            → empty array.
 */

export interface QuoteSegment {
  /** The literal text to render (asterisk markers already stripped). */
  text: string;
  /** True when this run should render in the brand pink accent. */
  accent: boolean;
}

// Matches a highlight pair. The inner group may be empty (`**`), which is a
// valid — but degenerate — matched pair: both markers are consumed and, since
// there is nothing to highlight, no accent segment is produced. A lone `*`
// with no partner never matches, so it survives as literal plain text.
const ACCENT_PATTERN = /\*([^*]*)\*/g;

export function parseQuoteAccents(quote: string): QuoteSegment[] {
  if (quote.length === 0) return [];

  const segments: QuoteSegment[] = [];
  let lastIndex = 0;

  for (const match of quote.matchAll(ACCENT_PATTERN)) {
    const start = match.index;
    if (start > lastIndex) {
      pushPlain(segments, quote.slice(lastIndex, start));
    }
    const inner = match[1];
    // Empty highlight `**`: markers consumed, nothing to accent → drop it.
    if (inner.length > 0) {
      segments.push({ text: inner, accent: true });
    }
    lastIndex = start + match[0].length;
  }

  if (lastIndex < quote.length) {
    pushPlain(segments, quote.slice(lastIndex));
  }

  return segments;
}

/**
 * Append a plain (non-accent) run, coalescing it with a preceding plain
 * segment so adjacent literal text (e.g. text left over around a dropped `**`)
 * stays a single node.
 */
function pushPlain(segments: QuoteSegment[], text: string): void {
  if (text.length === 0) return;
  const prev = segments[segments.length - 1];
  if (prev && !prev.accent) {
    prev.text += text;
    return;
  }
  segments.push({ text, accent: false });
}
