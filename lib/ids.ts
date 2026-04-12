/** Standard 8-4-4-4-12 hex UUID (rejects legacy numeric ids like "14" or "15"). */
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string | null | undefined): boolean {
  return Boolean(value && UUID_REGEX.test(value));
}

/**
 * New primary key for `leads` inserts — always v4-shaped UUID from the Web Crypto API.
 */
export function newLeadId(): string {
  return crypto.randomUUID();
}

/**
 * Validates a value that may be used as `lead_id` on emails / notes. Null/undefined is allowed.
 * @throws Error if a non-empty value is not a UUID
 */
export function requireOptionalLeadId(value: string | null | undefined, field = "lead_id"): string | null {
  if (value == null || value === "") return null;
  if (!UUID_REGEX.test(value)) {
    throw new Error(`Invalid ${field}: expected UUID, got ${JSON.stringify(value)}`);
  }
  return value;
}

/**
 * Validates a required lead id (e.g. from request body).
 * @throws Error if missing or not a UUID
 */
export function requireLeadId(value: string | null | undefined, field = "lead_id"): string {
  const v = requireOptionalLeadId(value, field);
  if (v == null) {
    throw new Error(`Invalid ${field}: UUID required`);
  }
  return v;
}
