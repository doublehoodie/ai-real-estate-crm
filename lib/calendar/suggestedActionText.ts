import type { Lead } from "@/types/lead";

function sanitizeOneLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function summarizeAction(action: string): string {
  const v = sanitizeOneLine(action);
  if (!v) return "";
  // Keep notes concise and human-readable; avoid carrying full generated copy into event notes.
  if (v.length <= 90) return v;
  const cut = v.slice(0, 90);
  const stop = cut.lastIndexOf(" ");
  return `${(stop > 30 ? cut.slice(0, stop) : cut).trim()}…`;
}

/** Human-readable schedule note (no full AI template text). */
export function getSuggestedScheduleNotes(lead: Pick<Lead, "ai_next_action" | "ai_followup">): string {
  const parts: string[] = [];
  const na = lead.ai_next_action;
  if (na && typeof na === "object" && !Array.isArray(na)) {
    const action =
      "action" in na && typeof (na as { action?: unknown }).action === "string"
        ? summarizeAction((na as { action: string }).action)
        : "";
    const reason =
      "reason" in na && typeof (na as { reason?: unknown }).reason === "string"
        ? sanitizeOneLine((na as { reason: string }).reason)
        : "";
    if (action) {
      parts.push(action);
    } else if (reason) {
      parts.push(reason.length > 90 ? `${reason.slice(0, 90).trim()}…` : reason);
    }
  }

  if (parts.length === 0) {
    return "Schedule viewing discussion";
  }
  return parts.join("\n\n");
}
