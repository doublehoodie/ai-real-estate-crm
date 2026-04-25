const CHANNEL = "crm:calendar-events-refresh";

/**
 * Notify every mounted `useEvents` (and similar) to refetch from `calendar_events`.
 * Prefer this after create/update/delete instead of router.refresh or inbox email reload.
 */
export function refetchEvents(source?: string): void {
  if (typeof window === "undefined") return;
  console.log("[EVENT REFRESH]", source ?? "");
  window.dispatchEvent(new CustomEvent(CHANNEL, { detail: { source } }));
}

export function subscribeEventsRefresh(listener: () => void): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }
  const handler = () => listener();
  window.addEventListener(CHANNEL, handler);
  return () => window.removeEventListener(CHANNEL, handler);
}
