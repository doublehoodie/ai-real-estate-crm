"use client";

import { useSyncExternalStore } from "react";
import type { Lead } from "@/types/lead";

export type ComposePosition = { x: number; y: number };

export type ComposeMode = "reply" | "new";

export type ComposeState = {
  isOpen: boolean;
  mode: ComposeMode;
  lead: Lead | null;
  /** Recipient (reply: resolved at open; new: user-editable). */
  to: string;
  content: string;
  /** Reply: auto `Re: …`; new: user-editable. */
  subject: string;
  /** Gmail thread id when replying in-thread; null for new mail or reply without thread. */
  gmailThreadId: string | null;
  isMinimized: boolean;
  position: ComposePosition;
};

const defaultState: ComposeState = {
  isOpen: false,
  mode: "reply",
  lead: null,
  to: "",
  content: "",
  subject: "",
  gmailThreadId: null,
  isMinimized: false,
  position: { x: 0, y: 0 },
};

let state: ComposeState = { ...defaultState };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function getComposeState(): ComposeState {
  return state;
}

export function subscribeCompose(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setCompose(partial: Partial<ComposeState>) {
  state = { ...state, ...partial };
  emit();
}

export function openFloatingCompose(args: {
  mode: ComposeMode;
  lead: Lead | null;
  to: string;
  subject: string;
  content: string;
  gmailThreadId?: string | null;
}) {
  setCompose({
    isOpen: true,
    mode: args.mode,
    lead: args.lead,
    to: args.to.trim(),
    subject: args.mode === "new" ? args.subject : args.subject.trim(),
    content: args.content,
    gmailThreadId: args.gmailThreadId?.trim() || null,
    isMinimized: false,
  });
}

export function setComposeOpen(isOpen: boolean) {
  setCompose({ isOpen });
}

export function setComposeMinimized(isMinimized: boolean) {
  setCompose({ isMinimized });
}

export function closeFloatingCompose() {
  setCompose({
    ...defaultState,
    position: { x: state.position.x, y: state.position.y },
  });
}

export function setComposeContent(content: string) {
  setCompose({ content });
}

export function setComposeSubject(subject: string) {
  setCompose({ subject });
}

export function setComposeTo(to: string) {
  setCompose({ to });
}

export function setComposePosition(position: ComposePosition) {
  setCompose({ position });
}

export function useComposeStore<T>(selector: (s: ComposeState) => T): T {
  return useSyncExternalStore(
    subscribeCompose,
    () => selector(state),
    () => selector(state),
  );
}

export function resetComposeStore() {
  state = { ...defaultState };
  emit();
}
