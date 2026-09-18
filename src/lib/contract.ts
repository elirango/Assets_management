// Contract date rules shared by the tenant form (client) and the tenant actions (server).
//
// Every calculation runs on UTC calendar dates. <input type="date"> values are "YYYY-MM-DD"
// strings and the database stores UTC midnight, so we never construct a local-time Date —
// that is what produces off-by-one-day bugs across timezones.

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/** Default day of month on which rent cheques are deposited. */
export const DEFAULT_PAYMENT_DAY = 10;
export const MIN_PAYMENT_DAY = 1;
export const MAX_PAYMENT_DAY = 31;

export function isValidPaymentDay(day: number): boolean {
  return Number.isInteger(day) && day >= MIN_PAYMENT_DAY && day <= MAX_PAYMENT_DAY;
}

/** Number of days in a UTC month (0-based month). Day 0 of the next month is the last day of this one. */
export function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
}

/**
 * The requested day of a month, clamped to that month's length: day 31 → Feb 28/29, Apr 30, etc.
 * Without clamping Date.UTC(2027, 1, 31) would silently roll over to March 3.
 */
export function clampedDayInMonth(year: number, month: number, day: number): Date {
  return new Date(Date.UTC(year, month, Math.min(day, daysInMonth(year, month))));
}

/** Safety cap for reminder generation (5 years of monthly cheques). */
const MAX_CHECK_REMINDERS = 60;

export function parseIsoDate(value: string | null | undefined): Date | null {
  if (!value || !ISO_DATE.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  // Reject rolled-over inputs such as 2026-02-31.
  return date.getUTCMonth() === month - 1 && date.getUTCDate() === day ? date : null;
}

export function toIsoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Default contract end: one year after the start, minus one day.
 * 2026-08-28 → 2027-08-27. A Feb 29 start rolls to Feb 28 of the next year.
 */
export function contractEndFromStart(startIso: string): string | null {
  const start = parseIsoDate(startIso);
  if (!start) return null;
  const end = new Date(Date.UTC(start.getUTCFullYear() + 1, start.getUTCMonth(), start.getUTCDate() - 1));
  return toIsoDate(end);
}

/**
 * Every `day`-of-month that falls inside [start, end] (inclusive), as UTC midnight dates,
 * clamped to the last day of shorter months. For a one-year-minus-one-day contract this is
 * exactly 12 dates.
 */
export function monthlyDueDates(start: Date, end: Date, day = DEFAULT_PAYMENT_DAY): Date[] {
  if (end < start || !isValidPaymentDay(day)) return [];

  const dates: Date[] = [];
  let year = start.getUTCFullYear();
  let month = start.getUTCMonth();

  while (dates.length < MAX_CHECK_REMINDERS) {
    const candidate = clampedDayInMonth(year, month, day);
    if (candidate > end) break;
    if (candidate >= start) dates.push(candidate);
    month += 1;
    if (month === 12) {
      month = 0;
      year += 1;
    }
  }
  return dates;
}

/** Hebrew "month year" label for a reminder title, e.g. "ספטמבר 2026". */
const monthLabel = new Intl.DateTimeFormat("he-IL", { month: "long", year: "numeric", timeZone: "UTC" });

export function checkDepositTitle(dueDate: Date, tenantName: string): string {
  return `הפקדת צ'ק שכירות – ${monthLabel.format(dueDate)} – ${tenantName}`;
}

/**
 * Builds the CHECK_DEPOSIT reminder rows for a tenant's contract period.
 * With a start but no end, a default one-year contract is assumed. Without a start → none.
 */
export function buildCheckDepositReminders(tenant: {
  id: string;
  fullName: string;
  propertyId: string | null;
  contractStart: Date | null;
  contractEnd: Date | null;
  paymentDay: number;
}) {
  if (!tenant.contractStart) return [];
  const end = tenant.contractEnd ?? parseIsoDate(contractEndFromStart(toIsoDate(tenant.contractStart)) ?? "");
  if (!end) return [];

  return monthlyDueDates(tenant.contractStart, end, tenant.paymentDay).map((dueDate) => ({
    type: "CHECK_DEPOSIT",
    title: checkDepositTitle(dueDate, tenant.fullName),
    dueDate,
    done: false,
    propertyId: tenant.propertyId,
    tenantId: tenant.id,
  }));
}
