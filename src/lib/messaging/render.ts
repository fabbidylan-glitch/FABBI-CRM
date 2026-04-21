/**
 * Minimal mustache-style template renderer used by the messaging layer.
 *
 * Only supports `{{variable}}` substitution — no logic blocks. That's intentional:
 * templates are edited by non-developers via the Admin UI, and logic-in-template
 * becomes a footgun fast. Unknown vars render as empty strings.
 */
export function renderTemplate(body: string, vars: Record<string, string | number | null | undefined>): string {
  return body.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_m, key) => {
    const v = vars[key];
    return v == null ? "" : String(v);
  });
}

/** HTML-escape basic characters so plain-text templates can render as HTML email. */
export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Convert plain-text body to a simple HTML fragment (preserves line breaks). */
export function textToHtml(text: string): string {
  return escapeHtml(text).replace(/\n/g, "<br />");
}
