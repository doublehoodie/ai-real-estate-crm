"use client";

import { useSyncExternalStore } from "react";
import type { Lead } from "@/types/lead";

export type CalendarDraftEvent = {
  date: string | null;
  time: string | null;
  notes: string;
};

export type CalendarEditorState = {
  isOpen: boolean;
  lead: Lead | null;
  draftEvent: CalendarDraftEvent;
  isMinimized: boolean;
  position: { x: number; y: number };
};

const defaultDraft: CalendarDraftEvent = {
  date: null,
  time: null,
  notes: "",
};

const defaultState: CalendarEditorState = {
  isOpen: false,
  lead: null,
  draftEvent: { ...defaultDraft },
  isMinimized: false,
  position: { x: 0, y: 0 },
};

let state: CalendarEditorState = { ...defaultState };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getCalendarEditorState(): CalendarEditorState {
  return state;
}

export function subscribeCalendarEditor(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setCal(partial: Partial<CalendarEditorState>) {
  state = { ...state, ...partial };
  emit();
}

export function openFloatingCalendarEditor(args: {
  lead: Lead;
  draftEvent?: Partial<CalendarDraftEvent>;
}) {
  const draft: CalendarDraftEvent = {
    ...defaultDraft,
    ...args.draftEvent,
  };
  setCal({
    isOpen: true,
    lead: args.lead,
    draftEvent: draft,
    isMinimized: false,
  });
}

/** Hide editor without clearing draft (window chrome close). */
export function setCalendarEditorOpen(isOpen: boolean) {
  setCal({ isOpen });
}

export function setCalendarEditorMinimized(isMinimized: boolean) {
  setCal({ isMinimized });
}

/** Dismiss and reset calendar editor (save, Cancel, etc.). */
export function closeFloatingCalendarEditor() {
  setCal({
    isOpen: false,
    isMinimized: false,
    lead: null,
    draftEvent: { ...defaultDraft },
  });
}

export function setCalendarDraftEvent(partial: Partial<CalendarDraftEvent>) {
  setCal({ draftEvent: { ...state.draftEvent, ...partial } });
}

export function setCalendarEditorPosition(position: { x: number; y: number }) {
  setCal({ position });
}

export function useCalendarEditorStore<T>(selector: (s: CalendarEditorState) => T): T {
  return useSyncExternalStore(
    subscribeCalendarEditor,
    () => selector(state),
    () => selector(state),
  );
}

export function resetCalendarEditorStore() {
  state = { ...defaultState };
  emit();
}
