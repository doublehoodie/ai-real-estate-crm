"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useEvents } from "@/lib/calendar/useEvents";
import { defaultLeadEventsRange } from "@/lib/calendar/defaultLeadEventsRange";

type ThreadLeadEventsStripProps = {
  leadId: string;
};

export function ThreadLeadEventsStrip({ leadId }: ThreadLeadEventsStripProps) {
  const { from, to } = useMemo(() => defaultLeadEventsRange(), []);
  const { events, loading, error } = useEvents({ from, to, leadId });

  const upcoming = useMemo(() => {
    const t = Date.now();
    return [...events]
      .filter((e) => new Date(e.end_time).getTime() >= t)
      .sort((a, b) => new Date(a.start_time).getTime() - new Date(b.start_time).getTime())
      .slice(0, 5);
  }, [events]);

  if (loading) {
    return (
      <div style={{ marginTop: "10px", fontSize: "12px", color: "#a1a1aa" }}>Loading calendar events…</div>
    );
  }
  if (error) {
    return (
      <div style={{ marginTop: "10px", fontSize: "12px", color: "#fca5a5" }} role="alert">
        {error}
      </div>
    );
  }
  if (upcoming.length === 0) {
    return (
      <div style={{ marginTop: "10px", fontSize: "12px", color: "#a1a1aa" }}>
        No upcoming events.{" "}
        <Link href="/calendar" className="font-medium text-emerald-300 underline">
          Calendar
        </Link>
      </div>
    );
  }

  return (
    <div style={{ marginTop: "10px", paddingTop: "10px", borderTop: "1px solid rgba(255,255,255,0.1)" }}>
      <div style={{ fontSize: "11px", fontWeight: 600, color: "#a1a1aa", marginBottom: "6px", letterSpacing: "0.02em" }}>
        UPCOMING EVENTS
      </div>
      <ul style={{ margin: 0, paddingLeft: "16px", fontSize: "12px", color: "#e4e4e7", lineHeight: 1.45 }}>
        {upcoming.map((e) => (
          <li key={e.id} style={{ marginBottom: "4px" }}>
            <span style={{ fontWeight: 600 }}>{e.title}</span>
            <span style={{ color: "#a1a1aa" }}> · {new Date(e.start_time).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
          </li>
        ))}
      </ul>
      <div style={{ marginTop: "6px" }}>
        <Link href={`/leads/${leadId}`} className="text-xs font-medium text-emerald-300 underline">
          Lead page
        </Link>
        <span style={{ color: "#52525b", margin: "0 6px" }}>|</span>
        <Link href="/calendar" className="text-xs font-medium text-emerald-300 underline">
          Calendar
        </Link>
      </div>
    </div>
  );
}
