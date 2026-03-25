export function formatBudget(value: string | null): string {
  if (!value) return "—";

  const digits = value.replace(/[^\d.]/g, "");
  if (!digits) return value;

  const num = Number(digits);
  if (Number.isNaN(num)) return value;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(num);
}

