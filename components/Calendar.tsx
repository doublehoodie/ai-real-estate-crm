"use client";

import { useMemo, useState } from "react";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function Calendar() {
  const [current, setCurrent] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const today = useMemo(() => new Date(), []);

  const { days, monthLabel, year } = useMemo(() => {
    const year = current.getFullYear();
    const month = current.getMonth();

    const firstDayOfWeek = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    const cells: { day: number; isToday: boolean }[] = [];

    for (let i = 0; i < firstDayOfWeek; i++) {
      cells.push({ day: 0, isToday: false });
    }

    for (let d = 1; d <= daysInMonth; d++) {
      const isToday =
        d === today.getDate() &&
        month === today.getMonth() &&
        year === today.getFullYear();

      cells.push({ day: d, isToday });
    }

    const monthLabel = current.toLocaleString("default", { month: "long" });

    return { days: cells, monthLabel, year };
  }, [current, today]);

  function goToPreviousMonth() {
    setCurrent((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    setCurrent((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1));
  }

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "16px",
        }}
      >
        <div>
          <div className="text-base font-semibold text-gray-900">
            {monthLabel} {year}
          </div>
          <div className="text-[13px] text-gray-500">View and plan showings</div>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            type="button"
            onClick={goToPreviousMonth}
            className="cursor-pointer rounded-full border border-[#1bbff6] bg-white px-2.5 py-1.5 text-[13px] text-[#1bbff6] transition-colors hover:bg-[#1bbff6]/10 focus:outline-none focus:ring-2 focus:ring-[#1bbff6]"
          >
            ←
          </button>
          <button
            type="button"
            onClick={goToNextMonth}
            className="cursor-pointer rounded-full border border-[#1bbff6] bg-white px-2.5 py-1.5 text-[13px] text-[#1bbff6] transition-colors hover:bg-[#1bbff6]/10 focus:outline-none focus:ring-2 focus:ring-[#1bbff6]"
          >
            →
          </button>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: "4px",
          fontSize: "12px",
          color: "#6b7280",
          marginBottom: "4px",
        }}
      >
        {weekdayLabels.map((label) => (
          <div
            key={label}
            style={{ textAlign: "center", fontWeight: 500 }}
          >
            {label}
          </div>
        ))}
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(7, minmax(0, 1fr))",
          gap: "4px",
        }}
      >
        {days.map((cell, index) => {
          if (cell.day === 0) {
            return <div key={index} />;
          }

          return (
            <div
              key={index}
              style={{
                minHeight: "64px",
                borderRadius: "10px",
                border: cell.isToday ? "1px solid #1bbff6" : "1px solid #e5e7eb",
                background: cell.isToday ? "rgba(27, 191, 246, 0.12)" : "white",
                color: "#111827",
                fontSize: "13px",
                padding: "6px 8px",
                display: "flex",
                flexDirection: "column",
              }}
            >
              <span style={{ fontWeight: 600 }}>{cell.day}</span>
              <span style={{ marginTop: "auto", fontSize: "11px", color: "#9ca3af" }}>
                {/* Placeholder for events */}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
