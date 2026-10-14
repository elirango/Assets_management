// Billing period (calendar months a manual charge covers). There is no column for it: the period is
// written into Charge.description as a trailing "(ינואר-פברואר)" and parsed back for display.
// Pure, shared by the form, the server action, the charge list and the message generator.

/** 1-based month number (1 = January). */
export type BillingMonth = number;

export const HEBREW_MONTHS = [
  "ינואר",
  "פברואר",
  "מרץ",
  "אפריל",
  "מאי",
  "יוני",
  "יולי",
  "אוגוסט",
  "ספטמבר",
  "אוקטובר",
  "נובמבר",
  "דצמבר",
] as const;

export const ENGLISH_MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
] as const;

function isMonth(value: number): boolean {
  return Number.isInteger(value) && value >= 1 && value <= 12;
}

/** Distinct valid months in calendar order. */
export function normalizeMonths(months: Iterable<number>): BillingMonth[] {
  return [...new Set([...months].filter(isMonth))].sort((a, b) => a - b);
}

/** "1,2,12" (hidden form field) → [1, 2, 12]; null when the field holds anything that isn't a month. */
export function parseMonthsField(value: string): BillingMonth[] | null {
  if (value.trim() === "") return [];
  const parts = value.split(",").map((part) => Number(part.trim()));
  if (parts.some((part) => !isMonth(part))) return null;
  return normalizeMonths(parts);
}

/**
 * Consecutive runs, wrapping around the year end so Dec + Jan reads "דצמבר-ינואר".
 * Each run is [first, last] (equal for a single month).
 */
function monthRuns(months: BillingMonth[]): [BillingMonth, BillingMonth][] {
  const selected = new Set(normalizeMonths(months));
  if (selected.size === 0) return [];
  if (selected.size === 12) return [[1, 12]];

  // Start right after the longest stretch of unselected months (Nov, Dec, Jan, Mar → from Nov).
  let start = 1;
  let longestGap = 0;
  for (let month = 1; month <= 12; month++) {
    if (!selected.has(month)) continue;
    let gap = 0;
    while (!selected.has(((month - 2 - gap + 24) % 12) + 1)) gap++;
    if (gap > longestGap) [start, longestGap] = [month, gap];
  }

  const runs: [BillingMonth, BillingMonth][] = [];
  for (let offset = 0; offset < 12; offset++) {
    const month = ((start - 1 + offset) % 12) + 1;
    if (!selected.has(month)) continue;
    const previous = month === 1 ? 12 : month - 1;
    const last = runs.at(-1);
    if (last && last[1] === previous) last[1] = month;
    else runs.push([month, month]);
  }
  return runs;
}

/** [1, 2, 3, 5] → "ינואר-מרץ, מאי" (or English names). Empty string for no months. */
export function formatBillingPeriod(months: BillingMonth[], language: "he" | "en" = "he"): string {
  const names = language === "he" ? HEBREW_MONTHS : ENGLISH_MONTHS;
  return monthRuns(months)
    .map(([first, last]) => (first === last ? names[first - 1] : `${names[first - 1]}-${names[last - 1]}`))
    .join(", ");
}

/** "ארנונה" + [1, 2] → "ארנונה (ינואר-פברואר)". */
export function withBillingPeriod(title: string, months: BillingMonth[]): string {
  const period = formatBillingPeriod(months);
  return period ? `${title} (${period})` : title;
}

const MONTH_INDEX = new Map<string, BillingMonth>(HEBREW_MONTHS.map((name, index) => [name, index + 1]));

/**
 * Splits a description into its title and billing period. A trailing "(…)" counts as a period only
 * when every part is a Hebrew month name or a "month-month" range; anything else stays in the title.
 */
export function splitBillingPeriod(description: string): { title: string; months: BillingMonth[] | null } {
  const match = description.match(/^(.*\S)\s+\(([^()]+)\)$/);
  if (!match) return { title: description, months: null };

  const months: BillingMonth[] = [];
  for (const part of match[2].split(",")) {
    const [from, to, ...rest] = part.trim().split("-");
    const first = MONTH_INDEX.get(from);
    const last = to == null ? first : MONTH_INDEX.get(to);
    if (first == null || last == null || rest.length > 0) return { title: description, months: null };
    for (let month = first; ; month = (month % 12) + 1) {
      months.push(month);
      if (month === last) break;
    }
  }
  return { title: match[1], months: normalizeMonths(months) };
}
