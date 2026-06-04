/**
 * Text markers for inline / decorative content in question bodies.
 *
 * Strategy: when the Word-import pipeline replaces or drops inline
 * content (an inline formula image, a decorative image, anything that
 * would otherwise leave a silent hole in the math expression), it
 * substitutes `INLINE_IMAGE_MARKER` in the text. The user can then
 * see WHERE the content was supposed to be, even if the rich HTML
 * rendering of the original (e.g. a tiny broken image) doesn't
 * communicate the position.
 *
 * Why one marker for both inline-formula and decorative:
 *  - Inline formula `<img class="inline-formula">`: math expressions
 *    in Word that the renderer can't fully LaTeX-ify (e.g. a literal
 *    □ drawn in a torn corner). The text body needs a position
 *    marker; the original image is also saved to content_images for
 *    the "原始题目图片" modal section.
 *  - Decorative `<img>` (alt in SKIP_ALTS like "原错题"): previously
 *    these were dropped silently, leaving "(-1) × …" with no hint
 *    of what was at the -1 position.
 *
 * Why □ (U+25A1) specifically:
 *  - It's the same symbol users manually type for a torn corner
 *    (the most common "lost content" in a 错题集).
 *  - It's a single grapheme — won't be confused with a normal word.
 *  - KaTeX / MathContent / HTML rendering all leave it as a single
 *    visible char, so the user always sees it.
 *
 * If the project needs to change the marker, change it here and
 * every consumer (parser, modal, list card) picks it up.
 */
export const INLINE_IMAGE_MARKER = "□";

/**
 * Regex matching the inline-formula image tag that the Word-import
 * pipeline produces. Centralized so the parser and tests agree on
 * the exact pattern. Use with the `g` flag for `.replace()`.
 */
export const INLINE_FORMULA_IMG_RE = /<img[^>]*class="inline-formula"[^>]*>/g;

/**
 * Regex matching the vision-description marker in text: `[图: desc]`.
 * The Word-import pipeline writes this when a vision model returned
 * a description for a large image; the renderer (latex.ts
 * `parseSegments`, MathContent, etc.) unwraps it to just the
 * description so the user sees the text, not the marker.
 *
 * The marker uses the Chinese word `图` (image) plus a colon —
 * distinct from `INLINE_IMAGE_MARKER` (a single char) so the two
 * categories never collide in the text body.
 */
export const VISION_DESCRIPTION_RE = /\[图:\s*([^\]]+)\]/g;
