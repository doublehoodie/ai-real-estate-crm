/**
 * Budget helpers: keep `budget` as free-text, optionally derive `budget_value` (USD) for analytics.
 */

const K = 1000;
const M = 1_000_000;

/** Plausible single-home budget bounds (USD). */
const MIN_USD = 10_000;
const MAX_USD = 500_000_000;

/**
 * Parse one token like "$800,000", "800k", "1.2M", "950000".
 */
function parseBudgetToken(raw: string): number | null {
  const t = raw.replace(/,/g, "").trim();
  const m = t.match(/^([\d.]+)\s*([kKmM])?$/);
  if (!m) return null;
  let n = Number.parseFloat(m[1]);
  if (Number.isNaN(n)) return null;
  const suf = (m[2] ?? "").toLowerCase();
  if (suf === "k") n *= K;
  else if (suf === "m") n *= M;
  return n;
}

/**
 * Collect distinct monetary amounts from free text (order preserved, deduped).
 */
function collectAmountsUsd(text: string): number[] {
  const found: number[] = [];
  const seen = new Set<number>();

  const add = (n: number) => {
    if (!Number.isFinite(n) || n < MIN_USD || n > MAX_USD) return;
    const key = Math.round(n);
    if (seen.has(key)) return;
    seen.add(key);
    found.push(n);
  };

  // $12,345 / $1.2M
  const withDollar = /\$\s*([\d,]+(?:\.\d+)?)\s*([kKmM])?\b/gi;
  let m: RegExpExecArray | null;
  while ((m = withDollar.exec(text)) !== null) {
    const n = parseBudgetToken(`${m[1]}${m[2] ?? ""}`);
    if (n != null) add(n);
  }

  // 800k / 1.2m (no $)
  const withSuffix = /\b([\d,]+(?:\.\d+)?)\s*([kKmM])\b/gi;
  while ((m = withSuffix.exec(text)) !== null) {
    const n = parseBudgetToken(`${m[1]}${m[2]}`);
    if (n != null) add(n);
  }

  // Plain 6–8 digit prices (e.g. 850000); avoids latching onto phone-like 10-digit strings.
  const plain = /\b(\d{6,8})\b/g;
  while ((m = plain.exec(text)) !== null) {
    const n = Number.parseFloat(m[1]);
    if (!Number.isNaN(n)) add(n);
  }

  return found.sort((a, b) => a - b);
}

/**
 * Derives a single numeric budget in USD when parsing is unambiguous.
 * - One amount → that value (rounded)
 * - Exactly two amounts → midpoint (common for ranges)
 * - Otherwise → null (avoid misleading analytics)
 */
export function extractBudgetValue(raw: string | null | undefined): number | null {
  if (raw == null) return null;
  const s = raw.trim();
  if (!s) return null;

  const amounts = collectAmountsUsd(s);
  if (amounts.length === 0) return null;
  if (amounts.length === 1) return Math.round(amounts[0]);
  if (amounts.length === 2) return Math.round((amounts[0] + amounts[1]) / 2);
  return null;
}

export type BudgetFields = {
  budget: string | null;
  budget_value: number | null;
};

/**
 * Persists trimmed text in `budget` and sets `budget_value` from a best-effort parse.
 */
export function deriveBudgetFields(raw: string | null | undefined): BudgetFields {
  const budget = raw?.trim() ? raw.trim() : null;
  const budget_value = extractBudgetValue(budget);
  return { budget, budget_value };
}
