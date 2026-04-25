"use client";

import { useSyncExternalStore } from "react";

/** Local calendar day `YYYY-MM-DD` to focus on the main calendar surface. */
export type CalendarViewState = {
  selectedDate: string | null;
};

let state: CalendarViewState = { selectedDate: null };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function subscribeCalendarView(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCalendarViewState(): CalendarViewState {
  return state;
}

export function setCalendarViewSelectedDate(isoLocalDay: string | null) {
  state = { selectedDate: isoLocalDay };
  emit();
}

export function useCalendarViewStore<T>(selector: (s: CalendarViewState) => T): T {
  return useSyncExternalStore(
    subscribeCalendarView,
    () => selector(state),
    () => selector(state),
  );
}

export function resetCalendarViewStore() {
  state = { selectedDate: null };
  emit();
}
