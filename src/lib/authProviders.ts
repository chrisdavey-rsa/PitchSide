/**
 * Auth provider helpers for Account Portal (email vs OAuth-only accounts).
 */

/** Normalize Supabase `app_metadata.providers` / identity providers. */
export function normalizeAuthProviders(
  raw: unknown,
  identities?: Array<{ provider?: string | null }> | null,
): string[] {
  const fromMeta = Array.isArray(raw)
    ? raw.map((p) => String(p).toLowerCase().trim()).filter(Boolean)
    : [];
  if (fromMeta.length > 0) return [...new Set(fromMeta)];

  const fromIdentities = (identities || [])
    .map((i) => String(i?.provider || "").toLowerCase().trim())
    .filter(Boolean);
  return [...new Set(fromIdentities)];
}

/**
 * OAuth-only: has an OAuth provider (e.g. google) and does NOT have email/password.
 * Users with both email + google keep the standard password forms.
 */
export function isOAuthOnlyAccount(providers: string[]): boolean {
  const set = new Set(providers.map((p) => p.toLowerCase()));
  const hasEmail = set.has("email");
  const hasOAuth = [...set].some((p) => p !== "email");
  return hasOAuth && !hasEmail;
}
