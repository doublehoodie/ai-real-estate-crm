"use client";

import { resetComposeStore } from "@/lib/stores/composeStore";
import { resetCalendarEditorStore } from "@/lib/stores/calendarEditorStore";
import { resetCalendarViewStore } from "@/lib/stores/calendarViewStore";
import { clearAllAssistantSessionStorage, clearAssistantSessionMessages } from "@/lib/stores/assistantSessionStore";

export const CLIENT_STATE_RESET_EVENT = "grassleads:client-state-reset";

export function clearAllState() {
  resetComposeStore();
  resetCalendarEditorStore();
  resetCalendarViewStore();
  clearAssistantSessionMessages();
  clearAllAssistantSessionStorage();

  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(CLIENT_STATE_RESET_EVENT));
  }
}
