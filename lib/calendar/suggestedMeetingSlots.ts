/** Next weekday (Mon–Fri) at 10:00 local, within the next 14 days. */
export function getNextWeekdayMeetingSlot(): { start: Date; end: Date } {
  const base = new Date();
  for (let i = 1; i <= 14; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    const wd = d.getDay();
    if (wd === 0 || wd === 6) continue;
    d.setHours(10, 0, 0, 0);
    const end = new Date(d);
    end.setHours(end.getHours() + 1);
    return { start: d, end };
  }
  const fallback = new Date(base);
  fallback.setHours(fallback.getHours() + 2, 0, 0, 0);
  const end = new Date(fallback);
  end.setHours(end.getHours() + 1);
  return { start: fallback, end };
}

export type WeekdaySlotPick = { start: Date; end: Date; label: string };

/** Up to `max` upcoming weekday starts at 10:00 local (for quick-pick chips). */
export function getUpcomingWeekdaySlots(max = 3): WeekdaySlotPick[] {
  const out: WeekdaySlotPick[] = [];
  const base = new Date();
  for (let i = 1; i <= 21 && out.length < max; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    d.setHours(10, 0, 0, 0);
    const end = new Date(d);
    end.setHours(end.getHours() + 1);
    out.push({
      start: d,
      end,
      label: d.toLocaleString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    });
  }
  return out;
}
