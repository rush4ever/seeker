/**
 * Plain-text / LaTeX delimiter utilities.
 *
 * Shared between wordParser (post-import cleanup) and Question list cards
 * (render-time cleanup for legacy / manually-entered content that may
 * contain stray $ characters from vision models or human input).
 */

/**
 * Clean stray / malformed $...$ delimiters in the plain-text view of a
 * question. The vision model (qwen2.5vl) is asked to wrap inline math
 * in $...$ but often:
 *  - wraps the WHOLE identified text (including Chinese stem) in $...$
 *  - emits a single dangling $ (opened without closing)
 *  - mismatches the number of $ in a paragraph
 *
 * The plain text field is rendered on list cards WITHOUT KaTeX, so a
 * stray $ leaks through as a visible dollar sign. Strategy:
 *  - If a $...$ pair is "too greedy" (covers ≥ 70% of the trimmed text),
 *    unwrap it (the whole line got swallowed).
 *  - Any remaining un-paired $ is removed.
 *  - The HTML view (content_html) is NOT touched — it still feeds MathContent.
 */
export function cleanLatexDelimiters(s: string): string {
  if (!s || !s.includes("$")) return s;

  // 1. Strip a leading $ that has NO matching closing $ later in the
  //    string (i.e. it's a dangling opener). Strip up to one such opener
  //    at the start and one closer at the end.
  //    This handles "计算：$(a+b) ÷ (1/a + 1/b) =$" — both are dangling.
  if (s.startsWith("$") && s.indexOf("$", 1) === -1) {
    s = s.slice(1);
  }
  if (s.endsWith("$") && s.lastIndexOf("$", s.length - 2) === -1) {
    s = s.slice(0, -1);
  }
  // Also: leading $ followed by some non-$ chars and never a closer
  // later. e.g. "$(a+b) =" (one $ at start, no closer).
  if (s.startsWith("$") && !hasMatchingDollarPair(s)) {
    s = s.slice(1);
  }
  if (s.endsWith("$") && !hasMatchingDollarPair(s)) {
    s = s.slice(0, -1);
  }
  if (!s.includes("$")) return s;

  // 2. Detect the "whole text got wrapped" case: text starts with $ and
  //    contains a closing $ near the end (within last 6 chars). Unwrap.
  const unwrapMatch = s.match(/^\s*\$([\s\S]+?)\$\s*$/);
  if (unwrapMatch) {
    const inner = unwrapMatch[1].trim();
    if (inner.length / s.trim().length >= 0.7) {
      s = inner;
    }
  }

  // 3. Drop any remaining un-paired $ (count parity check).
  const dollarPositions: number[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i] === "$") dollarPositions.push(i);
  }
  if (dollarPositions.length === 0) return s;
  if (dollarPositions.length % 2 === 1) {
    return s.replace(/\$/g, "");
  }

  // 4. Even count: keep only pairs whose inner content looks like LaTeX.
  const looksLikeMath = (inner: string) =>
    /\\frac|\\sqrt|\^|_|\\pi|\\sum|\\int|\\times|\\div|\\pm/.test(inner);
  let result = "";
  let cursor = 0;
  for (let i = 0; i < dollarPositions.length; i += 2) {
    const openAt = dollarPositions[i];
    const closeAt = dollarPositions[i + 1];
    result += s.slice(cursor, openAt);
    const inner = s.slice(openAt + 1, closeAt);
    if (looksLikeMath(inner)) {
      result += "$" + inner + "$";
    } else {
      // Drop the $, keep the inner text (probably plain text mistakenly wrapped)
      result += inner;
    }
    cursor = closeAt + 1;
  }
  result += s.slice(cursor);
  return result;
}

function hasMatchingDollarPair(s: string): boolean {
  // A pair exists if the string has at least 2 $ characters.
  // For a clean check: at least one $ followed (eventually) by another $.
  const first = s.indexOf("$");
  if (first === -1) return false;
  return s.indexOf("$", first + 1) !== -1;
}

/**
 * Apply cleanLatexDelimiters to every text node inside an HTML string.
 *
 * Word import populates `content_html` with the same vision-model
 * pollution as `content` — stray $ in Chinese-stem text nodes. We
 * can't just regex-replace $ out of the HTML (would break tag attrs /
 * legit $ in <script> etc.), so we parse it, walk text nodes, and
 * re-serialize. Safe because:
 *  - We only touch Text node .nodeValue
 *  - Element / Comment / Attribute nodes are untouched
 *  - DOMParser is sandboxed, no execution side-effects
 *
 * If parsing fails (browser-only — DOMParser doesn't exist in
 * bare Node tests) we return the input unchanged.
 */
export function cleanLatexDelimitersInHtml(html: string): string {
  if (!html || !html.includes("$")) return html;
  if (typeof DOMParser === "undefined") return html;

  const doc = new DOMParser().parseFromString(`<body>${html}</body>`, "text/html");
  const root = doc.body;
  const walker = doc.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  let n: Node | null;
  while ((n = walker.nextNode())) textNodes.push(n as Text);

  for (const node of textNodes) {
    const original = node.nodeValue;
    if (!original || !original.includes("$")) continue;
    const cleaned = cleanLatexDelimiters(original);
    if (cleaned !== original) node.nodeValue = cleaned;
  }

  // Serialize the body back. .innerHTML omits the <body> wrapper.
  return root.innerHTML;
}
