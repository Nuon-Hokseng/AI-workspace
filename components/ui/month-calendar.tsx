"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function toIso(year: number, month: number, day: number) {
  return `${year}-${String(month + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Google-Calendar-style month grid: selected day gets a filled circle,
// today gets an outlined one, adjacent months' days are muted but clickable.
export function MonthCalendar({
  value,
  onSelect,
}: {
  value: string; // ISO date (yyyy-mm-dd)
  onSelect: (isoDate: string) => void;
}) {
  const selected = value ? new Date(`${value}T00:00:00`) : new Date();
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());

  const today = new Date();
  const todayIso = toIso(today.getFullYear(), today.getMonth(), today.getDate());

  // 6 fixed rows of 7, starting on the Sunday on/before the 1st.
  const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(viewYear, viewMonth, 1 - firstWeekday + i);
    return {
      iso: toIso(d.getFullYear(), d.getMonth(), d.getDate()),
      day: d.getDate(),
      inMonth: d.getMonth() === viewMonth,
    };
  });

  function shiftMonth(delta: number) {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  }

  return (
    <div className="w-64 select-none p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-sm font-semibold">
          {MONTHS[viewMonth]} {viewYear}
        </p>
        <div className="flex gap-1">
          <button
            type="button"
            aria-label="Previous month"
            className="rounded-md p-1 hover:bg-accent"
            onClick={() => shiftMonth(-1)}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            className="rounded-md p-1 hover:bg-accent"
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-xs text-muted-foreground">
        {WEEKDAYS.map((d, i) => (
          <span key={i} className="py-1 font-medium">
            {d}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {cells.map((cell) => (
          <button
            key={cell.iso}
            type="button"
            onClick={() => onSelect(cell.iso)}
            className={cn(
              "mx-auto flex size-8 items-center justify-center rounded-full text-sm hover:bg-accent",
              !cell.inMonth && "text-muted-foreground/50",
              cell.iso === todayIso && "border border-primary",
              cell.iso === value && "bg-primary text-primary-foreground hover:bg-primary",
            )}
          >
            {cell.day}
          </button>
        ))}
      </div>

      <button
        type="button"
        className="mt-2 text-sm font-medium text-primary hover:underline"
        onClick={() => {
          setViewYear(today.getFullYear());
          setViewMonth(today.getMonth());
          onSelect(todayIso);
        }}
      >
        Today
      </button>
    </div>
  );
}
