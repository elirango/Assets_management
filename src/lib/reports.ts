// Reports (דוחות): pure helpers for the reports screen. The page fetches raw charges / expenses once;
// date filtering, grouping, totals and the CSV export all run on the client. Dates are "YYYY-MM-DD"
// strings (stored as UTC midnight), so range checks are plain string comparisons.

import { HEBREW_MONTHS, formatBillingPeriod, splitBillingPeriod } from "@/lib/billingPeriod";

export type ReportTab = "tenants" | "properties";

export type ReportRow = {
  id: string;
  /** "YYYY-MM-DD" */
  date: string;
  /** Tenant or property name — rows are grouped by it. */
  name: string;
  description: string;
  /** "" when the row has no billing period. */
  billingPeriod: string;
  /** Payment status (tenants) or expense category (properties). */
  tag: string;
  tagTone: "neutral" | "green" | "amber";
  amount: number;
};

export type ReportGroup = { name: string; rows: ReportRow[]; total: number };

/** "" on either side means open-ended. */
export type DateRange = { start: string; end: string };

export const REPORT_TABS: Record<ReportTab, { label: string; nameHeader: string; tagHeader: string }> = {
  tenants: { label: "דיירים", nameHeader: "דייר", tagHeader: "סטטוס" },
  properties: { label: "נכסים", nameHeader: "נכס", tagHeader: "קטגוריה" },
};

export type QuickFilter = "thisMonth" | "thisYear" | "last12Months" | "lastYear" | "allTime";

export const QUICK_FILTERS: { key: QuickFilter; label: string }[] = [
  { key: "thisMonth", label: "החודש" },
  { key: "thisYear", label: "השנה הנוכחית" },
  { key: "last12Months", label: "12 חודשים אחרונים" },
  { key: "lastYear", label: "שנה שעברה" },
  { key: "allTime", label: "כל הזמן" },
];

function isoDate(year: number, monthIndex: number, day: number): string {
  // Date.UTC normalizes overflow (day 0 = last day of the previous month).
  return new Date(Date.UTC(year, monthIndex, day)).toISOString().slice(0, 10);
}

/** Range for a quick filter, relative to `today` ("YYYY-MM-DD"). */
export function quickFilterRange(filter: QuickFilter, today: string): DateRange {
  const [year, month, day] = today.split("-").map(Number);
  switch (filter) {
    case "thisMonth":
      return { start: isoDate(year, month - 1, 1), end: isoDate(year, month, 0) };
    case "thisYear":
      return { start: `${year}-01-01`, end: `${year}-12-31` };
    case "last12Months": {
      // The day after the same date last year, clamped so Feb 29 → Feb 28 → starts Mar 1.
      const daysInMonth = new Date(Date.UTC(year - 1, month, 0)).getUTCDate();
      return { start: isoDate(year - 1, month - 1, Math.min(day, daysInMonth) + 1), end: today };
    }
    case "lastYear":
      return { start: `${year - 1}-01-01`, end: `${year - 1}-12-31` };
    case "allTime":
      return { start: "", end: "" };
  }
}

/** The quick filter whose range matches `range` exactly, if any (highlights the active button). */
export function activeQuickFilter(range: DateRange, today: string): QuickFilter | null {
  const match = QUICK_FILTERS.find(({ key }) => {
    const preset = quickFilterRange(key, today);
    return preset.start === range.start && preset.end === range.end;
  });
  return match?.key ?? null;
}

export function filterRows(rows: ReportRow[], range: DateRange): ReportRow[] {
  return rows.filter((row) => (!range.start || row.date >= range.start) && (!range.end || row.date <= range.end));
}

function roundMoney(amount: number): number {
  return Math.round(amount * 100) / 100;
}

export function sumRows(rows: ReportRow[]): number {
  return roundMoney(rows.reduce((sum, row) => sum + row.amount, 0));
}

/** Groups by name (Hebrew alphabetical), newest row first inside each group. */
export function groupRows(rows: ReportRow[]): ReportGroup[] {
  const byName = new Map<string, ReportRow[]>();
  for (const row of rows) {
    const group = byName.get(row.name);
    if (group) group.push(row);
    else byName.set(row.name, [row]);
  }
  return [...byName.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "he"))
    .map(([name, groupRows]) => {
      const sorted = [...groupRows].sort((a, b) => b.date.localeCompare(a.date));
      return { name, rows: sorted, total: sumRows(sorted) };
    });
}

/**
 * Description + billing period of a charge: a manual charge's trailing "(ינואר-פברואר)", or a meter
 * charge's "חיוב חשמל - 09/2026" → "ספטמבר 2026".
 */
export function chargeDescriptionParts(description: string): { description: string; billingPeriod: string } {
  const { title, months } = splitBillingPeriod(description);
  if (months) return { description: title, billingPeriod: formatBillingPeriod(months) };

  const meter = description.match(/^(.*\S)\s+-\s+(\d{2})\/(\d{4})$/);
  const month = meter ? Number(meter[2]) : 0;
  if (meter && month >= 1 && month <= 12) {
    return { description: meter[1], billingPeriod: `${HEBREW_MONTHS[month - 1]} ${meter[3]}` };
  }
  return { description, billingPeriod: "" };
}

/** "2026-10-20" → "20/10/2026" */
function displayDate(date: string): string {
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function csvCell(value: string | number): string {
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * CSV of the grouped rows plus a total line. Starts with a BOM so Excel reads the Hebrew as UTF-8;
 * amounts are plain numbers so the sheet can sum them.
 */
export function reportToCsv(tab: ReportTab, groups: ReportGroup[]): string {
  const { nameHeader, tagHeader } = REPORT_TABS[tab];
  const lines: (string | number)[][] = [["תאריך", nameHeader, "תיאור", "תקופת חיוב", tagHeader, "סכום"]];
  for (const group of groups) {
    for (const row of group.rows) {
      lines.push([displayDate(row.date), row.name, row.description, row.billingPeriod, row.tag, row.amount.toFixed(2)]);
    }
  }
  const total = roundMoney(groups.reduce((sum, group) => sum + group.total, 0));
  lines.push(["סה״כ", "", "", "", "", total.toFixed(2)]);
  return "﻿" + lines.map((line) => line.map(csvCell).join(",")).join("\r\n");
}

/** "report_tenants_20_10_2026.csv" */
export function reportFilename(tab: ReportTab, today: string): string {
  return `report_${tab}_${displayDate(today).replace(/\//g, "_")}.csv`;
}
