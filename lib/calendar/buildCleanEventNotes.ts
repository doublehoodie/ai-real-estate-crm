function sanitizeLine(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

/**
 * Calendar notes should be concise, human-readable meeting context only.
 * This explicitly strips common AI/template/email contamination.
 */
export function buildCleanEventNotes(input: string | null | undefined): string {
  const text = sanitizeLine(input ?? "");
  if (!text) return "";

  const lower = text.toLowerCase();
  const contaminationHints = [
    "subject:",
    "dear ",
    "best regards",
    "thanks,",
    "follow-up email",
    "template",
    "re:",
  ];
  if (contaminationHints.some((h) => lower.includes(h)) || text.length > 220) {
    return "Discuss viewing availability and financing options";
  }
  return text;
}

