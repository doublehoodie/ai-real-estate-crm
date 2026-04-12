import DOMPurify from "isomorphic-dompurify";

/**
 * Sanitize untrusted HTML (e.g. Gmail bodies) before dangerouslySetInnerHTML.
 * Uses DOMPurify’s HTML profile (tags/attrs whitelist, XSS-safe).
 */
export function sanitizeHtml(html: string): string {
  if (!html) return "";
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
  });
}
