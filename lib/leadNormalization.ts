import { coercePhoneFromApi } from "@/lib/phone";
import type { Lead } from "@/types/lead";

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function getSignalsBucket(signals: Lead["ai_signals"]): Record<string, unknown> | null {
  const root = asRecord(signals);
  if (!root) return null;
  const structured = asRecord(root.structured_extraction);
  return structured ?? root;
}

function compactUsd(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) {
    const n = value / 1_000_000;
    return `$${Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const n = value / 1_000;
    return `$${Number.isInteger(n) ? n.toFixed(0) : n.toFixed(1)}k`;
  }
  return `$${Math.round(value)}`;
}

function deriveBudgetText(raw: unknown): string | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return compactUsd(raw);
  if (typeof raw === "string" && raw.trim()) {
    const s = raw.trim();
    const n = Number(s.replace(/[^0-9.]/g, ""));
    if (Number.isFinite(n) && n > 0 && /^\$?\d[\d,]*(\.\d+)?$/.test(s)) {
      return compactUsd(n);
    }
    return s;
  }
  return null;
}

function derivePhone(raw: unknown): string | null {
  if (typeof raw !== "string" || !raw.trim()) return null;
  return coercePhoneFromApi(raw.trim());
}

/** Ensures UI-safe `budget`/`phone` fallback from AI structured extraction when base columns are empty. */
export function normalizeLeadCoreFields(lead: Lead): Lead {
  const bucket = getSignalsBucket(lead.ai_signals);
  const normalizedBudget = lead.budget?.trim() ? lead.budget.trim() : deriveBudgetText(bucket?.budget);
  const normalizedPhone = coercePhoneFromApi(lead.phone) || derivePhone(bucket?.phone);

  return {
    ...lead,
    budget: normalizedBudget ?? null,
    phone: normalizedPhone ?? null,
  };
}

