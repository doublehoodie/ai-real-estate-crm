/** Short preview for list cards (roughly 1–2 sentences). */
export function formatLeadSummaryShort(text: string | null | undefined, maxLen = 200): string {
  const t = text?.trim();
  if (!t) return "No AI summary yet.";
  if (t.length <= maxLen) return t;
  const cut = t.slice(0, maxLen);
  const lastPeriod = cut.lastIndexOf(".");
  if (lastPeriod > 40) return cut.slice(0, lastPeriod + 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > 40 ? cut.slice(0, lastSpace) : cut).trim()}…`;
}
