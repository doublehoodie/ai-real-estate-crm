const HARD_SPAM_SIGNALS = [
  "unsubscribe",
  "view in browser",
  "no-reply",
  "order confirmation",
  "tracking number",
  "receipt",
] as const;

/** Safe spam-only filter: if any hard signal appears, skip AI. */
export function hasHardSpamSignals(emailBody: string): boolean {
  const t = emailBody.toLowerCase();

  for (const s of HARD_SPAM_SIGNALS) {
    if (t.includes(s)) {
      return true;
    }
  }
  return false;
}
