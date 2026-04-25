/** `YYYY-MM-DD` in local time for `<input type="date" />`. */
export function toDateInputValue(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/** `HH:mm` in local time for `<input type="time" />`. */
export function toTimeInputValue(d: Date): string {
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

export function combineLocalDateAndTime(dateStr: string | null, timeStr: string | null): Date {
  const base = dateStr?.trim() || toDateInputValue(new Date());
  const [y, m, d] = base.split("-").map((x) => Number(x));
  const t = timeStr?.trim() || "10:00";
  const [hh, mm] = t.split(":").map((x) => Number(x));
  return new Date(y, m - 1, d, Number.isFinite(hh) ? hh : 10, Number.isFinite(mm) ? mm : 0, 0, 0);
}
