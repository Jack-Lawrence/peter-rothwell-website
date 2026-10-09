/**
 * JSON for an inline <script> tag. Every "<" becomes the six characters \u003c, which
 * is still valid JSON for the same text, so nothing in the content can close the tag early.
 */
export function jsonForScript(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
