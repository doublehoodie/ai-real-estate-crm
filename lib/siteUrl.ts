/**
 * Canonical public site origin from NEXT_PUBLIC_SITE_URL (no trailing slash).
 * Use for absolute redirects; falls back to request/browser origin where callers handle it.
 */
export function getPublicSiteOrigin(): string | undefined {
  const raw = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (!raw) return undefined;
  return raw.replace(/\/$/, "");
}

/** Expected Gmail OAuth callback path on this deployment (when SITE_URL is set). */
export function getGoogleOAuthCallbackUrl(): string | undefined {
  const o = getPublicSiteOrigin();
  return o ? `${o}/api/auth/callback/google` : undefined;
}
