"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cx } from "@/components/ui";
import { type BillingMonth, HEBREW_MONTHS, formatBillingPeriod } from "@/lib/billingPeriod";

/**
 * Dropdown of the 12 months with a checkbox each. Checking/unchecking keeps the panel open;
 * it closes on an outside click, Escape, or the "סגירה" button. The selection is posted as
 * `name` = "1,2,12" through a hidden input.
 */
export function MonthMultiSelect({
  name,
  label,
  value,
  onChange,
  hint,
}: {
  name: string;
  label: string;
  value: BillingMonth[];
  onChange: (months: BillingMonth[]) => void;
  hint?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelId = useId();
  const labelId = useId();
  const selected = new Set(value);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(event: PointerEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key !== "Escape") return;
      setOpen(false);
      triggerRef.current?.focus();
    }
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  function toggle(month: BillingMonth) {
    const next = new Set(selected);
    if (next.has(month)) next.delete(month);
    else next.add(month);
    onChange([...next].sort((a, b) => a - b));
  }

  const summary = formatBillingPeriod(value);

  return (
    <div ref={rootRef} className="relative">
      <span id={labelId} className="mb-1.5 block text-sm font-medium text-slate-700">
        {label}
      </span>
      <input type="hidden" name={name} value={value.join(",")} />
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((previous) => !previous)}
        aria-haspopup="true"
        aria-expanded={open}
        aria-controls={panelId}
        aria-labelledby={labelId}
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 text-start text-base text-slate-900 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20"
      >
        <span className={cx("truncate", !summary && "text-slate-400")}>{summary || "בחירת חודשים"}</span>
        <svg
          className={cx("size-4 shrink-0 text-slate-500 transition-transform", open && "rotate-180")}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 8 5 5 5-5" />
        </svg>
      </button>
      {hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>}

      {open && (
        <div
          id={panelId}
          role="group"
          aria-labelledby={labelId}
          className="absolute inset-x-0 top-full z-20 mt-1 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
        >
          <div className="grid grid-cols-3 gap-1">
            {HEBREW_MONTHS.map((monthName, index) => {
              const month = index + 1;
              const checked = selected.has(month);
              return (
                <label
                  key={month}
                  className={cx(
                    "flex min-h-10 cursor-pointer items-center gap-2 rounded-md px-2 text-sm",
                    checked ? "bg-blue-50 text-blue-800" : "text-slate-700 hover:bg-slate-50",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(month)}
                    className="size-4 shrink-0 rounded border-slate-300 accent-blue-600"
                  />
                  {monthName}
                </label>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-sm">
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={value.length === 0}
              className="min-h-9 rounded-md px-2 text-slate-600 hover:bg-slate-100 disabled:opacity-50"
            >
              ניקוי
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className="min-h-9 rounded-md px-3 font-medium text-blue-700 hover:bg-blue-50"
            >
              סגירה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
