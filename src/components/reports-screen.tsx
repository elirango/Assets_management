"use client";

import { useMemo, useState } from "react";
import { Badge, Button, EmptyState, Field, Input, cx } from "@/components/ui";
import { formatCurrency, formatDate } from "@/lib/format";
import {
  type DateRange,
  QUICK_FILTERS,
  REPORT_TABS,
  type ReportGroup,
  type ReportRow,
  type ReportTab,
  activeQuickFilter,
  filterRows,
  groupRows,
  quickFilterRange,
  reportFilename,
  reportToCsv,
  sumRows,
} from "@/lib/reports";

/**
 * Reports screen: tenant charges or property expenses for a date range, grouped by name with
 * subtotals and a grand total. Everything after the initial fetch is client-side, including the
 * CSV download. `today` comes from the server so the quick-filter ranges match during hydration.
 */
export function ReportsScreen({ rows, today }: { rows: Record<ReportTab, ReportRow[]>; today: string }) {
  const [activeReportTab, setActiveReportTab] = useState<ReportTab>("tenants");
  const [dateRange, setDateRange] = useState<DateRange>(() => quickFilterRange("thisYear", today));

  const filteredData = useMemo(() => filterRows(rows[activeReportTab], dateRange), [rows, activeReportTab, dateRange]);
  const groups = useMemo(() => groupRows(filteredData), [filteredData]);
  const total = sumRows(filteredData);
  const unpaidTotal =
    activeReportTab === "tenants" ? sumRows(filteredData.filter((row) => row.tagTone === "amber")) : 0;
  const invalidRange = dateRange.start !== "" && dateRange.end !== "" && dateRange.start > dateRange.end;

  function exportCsv() {
    downloadCsv(reportFilename(activeReportTab, today), reportToCsv(activeReportTab, groups));
  }

  return (
    <>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">דוחות</h1>
          <p className="mt-1 text-sm text-slate-500">
            {filteredData.length} רשומות · סה״כ {formatCurrency(total)}
            {unpaidTotal > 0 && ` · לא שולם ${formatCurrency(unpaidTotal)}`}
          </p>
        </div>
        <Button type="button" onClick={exportCsv} disabled={filteredData.length === 0} className="shrink-0">
          <DownloadIcon className="size-5" />
          ייצוא ל-CSV
        </Button>
      </div>

      <ReportTypeTabs active={activeReportTab} onChange={setActiveReportTab} />

      <FilterControls range={dateRange} today={today} onChange={setDateRange} />

      {invalidRange ? (
        <EmptyState title="טווח תאריכים לא תקין" description="תאריך ההתחלה מאוחר מתאריך הסיום." />
      ) : filteredData.length === 0 ? (
        <EmptyState
          title="אין רשומות בטווח שנבחר"
          description={activeReportTab === "tenants" ? "לא נרשמו חיובים לדיירים בתקופה זו." : "לא נרשמו הוצאות לנכסים בתקופה זו."}
        />
      ) : (
        <ReportsDataTable tab={activeReportTab} groups={groups} total={total} />
      )}
    </>
  );
}

function ReportTypeTabs({ active, onChange }: { active: ReportTab; onChange: (tab: ReportTab) => void }) {
  return (
    <div role="tablist" aria-label="סוג דוח" className="mb-4 inline-flex rounded-lg bg-slate-100 p-1">
      {(Object.keys(REPORT_TABS) as ReportTab[]).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={tab === active}
          onClick={() => onChange(tab)}
          className={cx(
            "min-h-10 rounded-md px-5 text-sm font-medium transition-colors",
            tab === active ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900",
          )}
        >
          {REPORT_TABS[tab].label}
        </button>
      ))}
    </div>
  );
}

function FilterControls({
  range,
  today,
  onChange,
}: {
  range: DateRange;
  today: string;
  onChange: (range: DateRange) => void;
}) {
  const activeFilter = activeQuickFilter(range, today);

  return (
    <div className="mb-4 space-y-3 rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex gap-2 overflow-x-auto pb-1">
        {QUICK_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(quickFilterRange(key, today))}
            aria-pressed={key === activeFilter}
            className={
              key === activeFilter
                ? "shrink-0 rounded-full bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
                : "shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            }
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:max-w-md">
        <Field label="מתאריך">
          <Input
            type="date"
            value={range.start}
            max={range.end || undefined}
            onChange={(event) => onChange({ ...range, start: event.target.value })}
          />
        </Field>
        <Field label="עד תאריך">
          <Input
            type="date"
            value={range.end}
            min={range.start || undefined}
            onChange={(event) => onChange({ ...range, end: event.target.value })}
          />
        </Field>
      </div>
    </div>
  );
}

// Phones: the name and billing-period columns fold into the date / description cells so the
// amount stays on screen without horizontal scrolling (sm+ shows all five columns).
function ReportsDataTable({ tab, groups, total }: { tab: ReportTab; groups: ReportGroup[]; total: number }) {
  const { nameHeader } = REPORT_TABS[tab];

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm sm:min-w-[42rem]">
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-600">
          <tr>
            <th scope="col" className="px-3 py-3 text-start sm:px-4">תאריך</th>
            <th scope="col" className="hidden px-4 py-3 text-start sm:table-cell">{nameHeader}</th>
            <th scope="col" className="px-3 py-3 text-start sm:px-4">תיאור</th>
            <th scope="col" className="hidden px-4 py-3 text-start sm:table-cell">תקופת חיוב</th>
            <th scope="col" className="px-3 py-3 text-end sm:px-4">סכום</th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.name} className="border-b border-slate-200">
            {group.rows.map((row) => (
              <tr key={row.id} className="border-b border-slate-100 align-top last:border-0 sm:align-middle">
                <td className="whitespace-nowrap px-3 py-2.5 tabular-nums text-slate-600 sm:px-4">
                  {formatDate(new Date(row.date))}
                  <span className="block font-medium text-slate-900 sm:hidden">{row.name}</span>
                </td>
                <td className="hidden px-4 py-2.5 font-medium text-slate-900 sm:table-cell">{row.name}</td>
                <td className="px-3 py-2.5 text-slate-800 sm:px-4">
                  <span className="me-2">{row.description}</span>
                  <Badge tone={row.tagTone}>{row.tag}</Badge>
                  {row.billingPeriod && (
                    <span className="block text-xs text-slate-500 sm:hidden">{row.billingPeriod}</span>
                  )}
                </td>
                <td className="hidden px-4 py-2.5 text-slate-600 sm:table-cell">{row.billingPeriod || "—"}</td>
                <td className="whitespace-nowrap px-3 py-2.5 text-end font-medium tabular-nums text-slate-900 sm:px-4">
                  {formatCurrency(row.amount)}
                </td>
              </tr>
            ))}
            {groups.length > 1 && (
              <tr className="bg-slate-50/70 text-slate-600">
                <td colSpan={2} className="px-3 py-2 text-xs font-medium sm:px-4">
                  סה״כ {group.name} · {group.rows.length} רשומות
                </td>
                <SpacerCells />
                <td className="whitespace-nowrap px-3 py-2 text-end font-semibold tabular-nums text-slate-800 sm:px-4">
                  {formatCurrency(group.total)}
                </td>
              </tr>
            )}
          </tbody>
        ))}
        <tfoot className="bg-slate-100 text-slate-900">
          <tr>
            <th scope="row" colSpan={2} className="px-3 py-3 text-start font-bold sm:px-4">
              סה״כ
            </th>
            <SpacerCells />
            <td className="whitespace-nowrap px-3 py-3 text-end text-base font-bold tabular-nums sm:px-4">
              {formatCurrency(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}

/**
 * Summary rows: a colSpan-2 label + these + the amount fills 5 columns on sm+ and 3 on phones
 * (hidden cells drop out of the table grid, so a fixed colSpan would add phantom columns).
 */
function SpacerCells() {
  return (
    <>
      <td className="hidden sm:table-cell" />
      <td className="hidden sm:table-cell" />
    </>
  );
}

/** Client-side download: CSV string → Blob → temporary <a download>. No server round trip. */
function downloadCsv(filename: string, csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

function DownloadIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v11m0 0-4-4m4 4 4-4M5 19h14" />
    </svg>
  );
}
