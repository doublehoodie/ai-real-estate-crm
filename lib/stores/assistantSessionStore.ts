"use client";

import { useSyncExternalStore } from "react";
import type { AssistantMessageContent } from "@/lib/ai/assistantSurfaceTypes";

export type SessionAssistantMessage = {
  role: "user" | "assistant";
  content: AssistantMessageContent;
};

const STORAGE_KEY_PREFIX = "grassleads:assistantSession:v2:";
const MAX_MESSAGES = 24;
const RESET_EVENT = "grassleads:client-state-reset";

let messages: SessionAssistantMessage[] = [];
const listeners = new Set<() => void>();
let activeUserId: string | null = null;

function emit() {
  listeners.forEach((l) => l());
}

function storageKeyForUser(userId: string): string {
  return `${STORAGE_KEY_PREFIX}${userId}`;
}

function persist() {
  if (typeof window === "undefined") return;
  if (!activeUserId) return;
  try {
    sessionStorage.setItem(storageKeyForUser(activeUserId), JSON.stringify({ messages: messages.slice(-MAX_MESSAGES) }));
  } catch {
    /* quota */
  }
}

function loadFromStorage(userId: string): SessionAssistantMessage[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(storageKeyForUser(userId));
    if (!raw) return [];
    const o = JSON.parse(raw) as { messages?: SessionAssistantMessage[] };
    if (!Array.isArray(o.messages)) return [];
    return o.messages.slice(-MAX_MESSAGES);
  } catch {
    return [];
  }
}

export function subscribeAssistantSession(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setAssistantSessionUser(userId: string | null) {
  activeUserId = userId;
  messages = userId ? loadFromStorage(userId) : [];
  emit();
}

export function clearAssistantSessionMessages() {
  messages = [];
  if (typeof window !== "undefined" && activeUserId) {
    sessionStorage.removeItem(storageKeyForUser(activeUserId));
  }
  emit();
}

export function clearAllAssistantSessionStorage() {
  if (typeof window === "undefined") return;
  const keysToDelete: string[] = [];
  for (let i = 0; i < sessionStorage.length; i += 1) {
    const key = sessionStorage.key(i);
    if (key && key.startsWith(STORAGE_KEY_PREFIX)) {
      keysToDelete.push(key);
    }
  }
  keysToDelete.forEach((key) => sessionStorage.removeItem(key));
}

export function getAssistantSessionMessages(): SessionAssistantMessage[] {
  return messages;
}

export function setAssistantSessionMessages(
  next: SessionAssistantMessage[] | ((prev: SessionAssistantMessage[]) => SessionAssistantMessage[]),
) {
  messages = typeof next === "function" ? next(messages) : next;
  messages = messages.slice(-MAX_MESSAGES);
  persist();
  emit();
}

/** Append a plain assistant line (e.g. after scheduling from floating editor). */
export function appendAssistantSessionLine(text: string) {
  setAssistantSessionMessages((prev) => [...prev, { role: "assistant", content: text }]);
}

export function useAssistantSessionMessages(): SessionAssistantMessage[] {
  return useSyncExternalStore(
    subscribeAssistantSession,
    () => messages,
    () => messages,
  );
}

if (typeof window !== "undefined") {
  window.addEventListener(RESET_EVENT, () => {
    messages = [];
    emit();
  });
}
