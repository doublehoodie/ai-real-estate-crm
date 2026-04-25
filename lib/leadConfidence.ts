/** Maps stored AI confidence (0–1 scale) to a badge for UI. */
export function aiConfidenceTier(c: number | null | undefined): { label: string; className: string } {
  if (c == null || !Number.isFinite(c)) {
    return { label: "—", className: "bg-gray-100 text-gray-700" };
  }
  if (c >= 0.8) return { label: "High", className: "bg-emerald-100 text-emerald-800" };
  if (c >= 0.5) return { label: "Medium", className: "bg-amber-100 text-amber-800" };
  return { label: "Low", className: "bg-rose-50 text-rose-900 ring-1 ring-rose-200/80" };
}
