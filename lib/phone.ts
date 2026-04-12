/**
 * Phone numbers are stored as string | null (never numeric types in app logic).
 */

/**
 * Coerce API/DB JSON values to string | null (trims ends; no parseInt/Number).
 * Use when hydrating leads so UI always sees string | null.
 */
export function coercePhoneFromApi(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

/**
 * Normalize user input before insert/update: trim, strip all whitespace, empty → null.
 */
export function normalizePhoneForStorage(value: unknown): string | null {
  if (value == null) return null;
  const s = String(value).trim().replace(/\s+/g, "");
  return s === "" ? null : s;
}
