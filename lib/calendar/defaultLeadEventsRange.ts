/** Wide window for lead-scoped lists (detail + inbox) so scheduled items stay visible. */
export function defaultLeadEventsRange(now: Date = new Date()): { from: Date; to: Date } {
  const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const to = new Date(now.getFullYear() + 1, 11, 31, 23, 59, 59, 999);
  return { from, to };
}
