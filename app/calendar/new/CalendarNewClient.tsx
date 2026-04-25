"use client";

import { useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { isUuid } from "@/lib/ids";
import { ScheduleLeadEventModal } from "@/components/ScheduleLeadEventModal";
import { clearSeedCalendarNew, readSeedCalendarNew, type SeedCalendarNewPayload } from "@/lib/navigation/seedSessionBridge";

function toDatetimeLocalValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function consumeSeedForLead(leadId: string): SeedCalendarNewPayload | null {
  const raw = readSeedCalendarNew();
  if (!raw || raw.leadId !== leadId) return null;
  clearSeedCalendarNew();
  return raw;
}

export function CalendarNewClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadIdParam = searchParams.get("leadId")?.trim() ?? "";

  const validLeadId = useMemo(() => (isUuid(leadIdParam) ? leadIdParam : ""), [leadIdParam]);

  const [seed] = useState<SeedCalendarNewPayload | null>(() =>
    isUuid(leadIdParam) ? consumeSeedForLead(leadIdParam) : null,
  );

  if (!validLeadId) {
    return <p className="text-sm text-zinc-400">Missing or invalid leadId in the URL.</p>;
  }

  const startLocal = seed ? toDatetimeLocalValue(new Date(seed.suggestedStartIso)) : undefined;
  const endLocal = seed ? toDatetimeLocalValue(new Date(seed.suggestedEndIso)) : undefined;

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <p className="text-sm text-emerald-400/90">Prefilled from Seed — save to add the event.</p>
      <ScheduleLeadEventModal
        mode="inline"
        open
        leadId={validLeadId}
        leadName={seed?.leadName ?? "Lead"}
        suggestedNotes={seed?.description ?? ""}
        initialEventType="meeting"
        defaultTitle={seed?.title}
        defaultStartLocal={startLocal}
        defaultEndLocal={endLocal}
        defaultDescription={seed?.description}
        onClose={() => router.push("/calendar")}
        onCreated={() => router.push("/calendar")}
      />
    </div>
  );
}
