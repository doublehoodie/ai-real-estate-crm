import { AppLayout } from "@/components/layout/AppLayout";
import { LeadCalendarView } from "@/components/LeadCalendarView";

export default function CalendarPage() {
  return (
    <AppLayout
      active="calendar"
      title="Calendar"
      description="Lead-linked events in month and week views. External calendar sync is not connected yet."
    >
      <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-lg backdrop-blur transition duration-200 ease-out hover:scale-[1.01]">
        <LeadCalendarView />
      </div>
    </AppLayout>
  );
}
