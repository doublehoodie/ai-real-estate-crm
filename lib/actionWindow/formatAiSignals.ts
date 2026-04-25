import type { Lead, LeadAiSignals } from "@/types/lead";

const SIGNAL_KEYS: (keyof LeadAiSignals)[] = [
  "financial_readiness",
  "urgency",
  "intent",
  "fit",
  "objections",
  "missing_info",
];

const LABELS: Record<keyof LeadAiSignals, string> = {
  financial_readiness: "Financial readiness",
  urgency: "Urgency",
  intent: "Intent",
  fit: "Fit",
  objections: "Objections",
  missing_info: "Missing info",
};

export type SignalSection = { title: string; items: string[] };

export function formatAiSignalsSections(signals: Lead["ai_signals"]): SignalSection[] {
  if (!signals || typeof signals !== "object" || Array.isArray(signals)) return [];
  const s = signals as LeadAiSignals;
  const out: SignalSection[] = [];
  for (const key of SIGNAL_KEYS) {
    const arr = s[key];
    if (!Array.isArray(arr)) continue;
    const items = arr.filter((x): x is string => typeof x === "string" && x.trim().length > 0);
    if (items.length === 0) continue;
    out.push({ title: LABELS[key], items });
  }
  return out;
}
