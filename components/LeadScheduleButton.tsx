"use client";

import type { Lead } from "@/types/lead";
import { getSuggestedScheduleNotes } from "@/lib/calendar/suggestedActionText";
import { toDateInputValue } from "@/lib/calendar/localDateInputs";
import { openFloatingCalendarEditor } from "@/lib/stores/calendarEditorStore";
import { secondaryButton } from "@/lib/ui";

export function LeadScheduleButton({ lead }: { lead: Lead }) {
  return (
    <button
      type="button"
      className={secondaryButton}
      onClick={() =>
        openFloatingCalendarEditor({
          lead,
          draftEvent: {
            date: toDateInputValue(new Date()),
            time: null,
            notes: getSuggestedScheduleNotes(lead),
          },
        })
      }
    >
      Schedule
    </button>
  );
}
