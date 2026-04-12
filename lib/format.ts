/**
 * Display stored budget text as-is (preserves ranges and natural language).
 */
export function displayBudgetText(value: string | null | undefined): string {
  if (value == null || String(value).trim() === "") return "—";
  return String(value).trim();
}

/** @deprecated Prefer displayBudgetText — old helper mangled ranges by concatenating digits. */
export function formatBudget(value: string | null): string {
  return displayBudgetText(value);
}

/** Format a numeric budget_value for secondary UI (e.g. tooltips), not replacing raw `budget`. */
export function formatBudgetValueUsd(value: number | null | undefined): string {
  if (value == null || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

