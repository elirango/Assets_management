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
      <span id={labelId} className="mb-1.5 block text-sm font-medium text-ink-2">
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
        className="flex min-h-11 w-full items-center justify-between gap-2 rounded-input border border-muted/60 bg-cotton px-3 text-start text-base text-ink transition-colors duration-(--dur-micro) hover:border-muted focus-visible:border-focus focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus/40 md:min-h-10"
      >
        <span className={cx("truncate", !summary && "text-muted/80")}>{summary || "בחירת חודשים"}</span>
        <svg
          className={cx("size-4 shrink-0 text-muted motion-safe:transition-transform motion-safe:duration-(--dur-short)", open && "rotate-180")}
          viewBox="0 0 20 20"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="m5 8 5 5 5-5" />
        </svg>
      </button>
      {hint && <span className="mt-1.5 block text-xs leading-normal text-muted">{hint}</span>}

      {open && (
        <div
          id={panelId}
          role="group"
          aria-labelledby={labelId}
          className="stock absolute inset-x-0 top-full z-20 mt-1.5 p-2 shadow-[var(--edge-stock),var(--cast-stock-lift)]"
        >
          <div className="grid grid-cols-3 gap-1">
            {HEBREW_MONTHS.map((monthName, index) => {
              const month = index + 1;
              const checked = selected.has(month);
              return (
                <label
                  key={month}
                  className={cx(
                    "flex min-h-10 cursor-pointer items-center gap-2 rounded-input px-2 text-sm transition-colors duration-(--dur-micro)",
                    checked ? "bg-paper-2 font-medium text-ink" : "text-ink-2 hover:bg-paper",
                  )}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggle(month)}
                    className="size-4 shrink-0 accent-brand"
                  />
                  {monthName}
                </label>
              );
            })}
          </div>
          <div className="mt-2 flex items-center justify-between border-t border-rule pt-2 text-sm">
            <button
              type="button"
              onClick={() => onChange([])}
              disabled={value.length === 0}
              className="min-h-9 rounded-input px-2 text-ink-2 transition-colors duration-(--dur-micro) hover:bg-paper-2 active:bg-paper-3 disabled:cursor-not-allowed disabled:opacity-55"
            >
              ניקוי
            </button>
            <button
              type="button"
              onClick={() => {
                setOpen(false);
                triggerRef.current?.focus();
              }}
              className="min-h-9 rounded-input px-3 font-medium text-ink transition-colors duration-(--dur-micro) hover:bg-paper-2 active:bg-paper-3"
            >
              סגירה
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
