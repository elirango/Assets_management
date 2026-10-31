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
      <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-8">
        <div className="min-w-0">
          <h1 className="text-ink">דוחות</h1>
          <p className="mt-2 text-base text-muted">
            {filteredData.length} רשומות, סה״כ {formatCurrency(total)}
            {unpaidTotal > 0 && <span className="text-accent-2">, לא שולם {formatCurrency(unpaidTotal)}</span>}
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
    <div role="tablist" aria-label="סוג דוח" className="groove mb-5 inline-flex gap-1 p-1">
      {(Object.keys(REPORT_TABS) as ReportTab[]).map((tab) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={tab === active}
          onClick={() => onChange(tab)}
          className={cx(
            "min-h-9 rounded-input px-5 text-sm font-medium transition-colors duration-(--dur-micro)",
            tab === active ? "edge bg-cotton text-ink" : "text-ink-2 hover:bg-paper-3/70 hover:text-ink",
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
    <div className="mb-6 flex flex-wrap items-end gap-x-6 gap-y-4">
      <div className="flex max-w-full gap-1 overflow-x-auto" role="group" aria-label="טווח מהיר">
        {QUICK_FILTERS.map(({ key, label }) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange(quickFilterRange(key, today))}
            aria-pressed={key === activeFilter}
            className={cx(
              "inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-input px-3 text-sm font-medium transition-colors duration-(--dur-micro)",
              key === activeFilter ? "edge bg-cotton text-ink" : "text-ink-2 hover:bg-paper-2 hover:text-ink active:bg-paper-3",
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="grid w-full grid-cols-2 gap-3 sm:w-auto sm:min-w-96">
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
    <div className="stock overflow-x-auto">
      <table className="w-full text-sm sm:min-w-[42rem]">
        <thead className="border-b border-rule text-sm font-medium text-muted">
          <tr>
            <th scope="col" className="px-3 py-3 text-start font-medium sm:ps-5 sm:pe-4">תאריך</th>
            <th scope="col" className="hidden px-4 py-3 text-start font-medium sm:table-cell">{nameHeader}</th>
            <th scope="col" className="px-3 py-3 text-start font-medium sm:px-4">תיאור</th>
            <th scope="col" className="hidden px-4 py-3 text-start font-medium sm:table-cell">תקופת חיוב</th>
            <th scope="col" className="px-3 py-3 text-end font-medium sm:ps-4 sm:pe-5">סכום</th>
          </tr>
        </thead>
        {groups.map((group) => (
          <tbody key={group.name} className="border-b border-rule-2">
            {group.rows.map((row) => (
              <tr key={row.id} className="border-b border-rule align-top last:border-0 sm:align-middle">
                <td className="fig whitespace-nowrap px-3 py-3 text-muted sm:ps-5 sm:pe-4">
                  {formatDate(new Date(row.date))}
                  <span className="block font-medium text-ink sm:hidden">{row.name}</span>
                </td>
                <td className="hidden px-4 py-3 font-medium text-ink sm:table-cell">{row.name}</td>
                <td className="px-3 py-3 text-ink-2 sm:px-4">
                  <span className="me-2">{row.description}</span>
                  <Badge tone={row.tagTone}>{row.tag}</Badge>
                  {row.billingPeriod && (
                    <span className="block text-xs text-muted sm:hidden">{row.billingPeriod}</span>
                  )}
                </td>
                <td className="hidden px-4 py-3 text-muted sm:table-cell">{row.billingPeriod || "—"}</td>
                <td className="fig whitespace-nowrap px-3 py-3 text-end font-medium text-ink sm:ps-4 sm:pe-5">
                  {formatCurrency(row.amount)}
                </td>
              </tr>
            ))}
            {groups.length > 1 && (
              <tr className="bg-paper text-ink-2">
                <td colSpan={2} className="px-3 py-2.5 text-sm font-medium sm:ps-5 sm:pe-4">
                  סה״כ {group.name}, {group.rows.length} רשומות
                </td>
                <SpacerCells />
                <td className="fig whitespace-nowrap px-3 py-2.5 text-end font-medium text-ink sm:ps-4 sm:pe-5">
                  {formatCurrency(group.total)}
                </td>
              </tr>
            )}
          </tbody>
        ))}
        <tfoot className="border-t-2 border-ink/80 text-ink">
          <tr>
            <th scope="row" colSpan={2} className="px-3 py-3.5 text-start text-base font-medium sm:ps-5 sm:pe-4">
              סה״כ
            </th>
            <SpacerCells />
            <td className="fig whitespace-nowrap px-3 py-3.5 text-end text-lg font-medium sm:ps-4 sm:pe-5">
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
