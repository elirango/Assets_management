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

/** Contract length in months: default one year, capped at ten. */
export const DEFAULT_CONTRACT_MONTHS = 12;
export const MIN_CONTRACT_MONTHS = 1;
export const MAX_CONTRACT_MONTHS = 120;

export function isValidContractMonths(months: number): boolean {
  return Number.isInteger(months) && months >= MIN_CONTRACT_MONTHS && months <= MAX_CONTRACT_MONTHS;
}

/** Days before the contract end on which the renewal reminder is due. */
export const RENEWAL_LEAD_DAYS = 60;

/** Safety cap for reminder generation (matches the longest allowed contract). */
const MAX_CHECK_REMINDERS = MAX_CONTRACT_MONTHS;

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

/** `date` + `months`, clamped to the target month's length (Jan 31 + 1 → Feb 28). */
export function addMonthsClamped(date: Date, months: number): Date {
  const total = date.getUTCMonth() + months;
  const year = date.getUTCFullYear() + Math.floor(total / 12);
  const month = ((total % 12) + 12) % 12;
  return clampedDayInMonth(year, month, date.getUTCDate());
}

export function addDaysUtc(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

/**
 * Contract end for a start date and a length in months: the day before the anniversary.
 * When the anniversary had to be clamped to a shorter month, that clamped day is already the
 * last day of the term, so nothing is subtracted:
 * 2026-08-28 + 12 → 2027-08-27 · 2027-03-01 + 12 → 2028-02-29 · 2028-02-29 + 12 → 2029-02-28 ·
 * 2026-01-31 + 1 → 2026-02-28.
 */
export function contractEndFromStart(startIso: string, months: number = DEFAULT_CONTRACT_MONTHS): string | null {
  const start = parseIsoDate(startIso);
  if (!start || !isValidContractMonths(months)) return null;
  const anniversary = addMonthsClamped(start, months);
  const wasClamped = anniversary.getUTCDate() < start.getUTCDate();
  return toIsoDate(wasClamped ? anniversary : addDaysUtc(anniversary, -1));
}

/**
 * The contract length in months that reproduces `endIso` from `startIso`, or null when the
 * end date was set by hand and matches no whole number of months.
 */
export function contractMonthsBetween(startIso: string, endIso: string): number | null {
  for (let months = MIN_CONTRACT_MONTHS; months <= MAX_CONTRACT_MONTHS; months++) {
    if (contractEndFromStart(startIso, months) === endIso) return months;
  }
  return null;
}

/** Renewal reminder falls RENEWAL_LEAD_DAYS before the contract end. */
export function renewalReminderDate(contractEnd: Date): Date {
  return addDaysUtc(contractEnd, -RENEWAL_LEAD_DAYS);
}

export function renewalReminderTitle(tenantName: string): string {
  return `חידוש חוזה - ${tenantName}`;
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

type ContractTenant = {
  id: string;
  fullName: string;
  propertyId: string | null;
  contractStart: Date | null;
  contractEnd: Date | null;
  paymentDay: number;
};

/** Reminder types that are generated from the contract and rebuilt when it changes. */
export const CONTRACT_REMINDER_TYPES = ["CHECK_DEPOSIT", "CONTRACT_END"] as const;

function contractEndOf(tenant: ContractTenant): Date | null {
  if (!tenant.contractStart) return null;
  return tenant.contractEnd ?? parseIsoDate(contractEndFromStart(toIsoDate(tenant.contractStart)) ?? "");
}

/**
 * Builds the CHECK_DEPOSIT reminder rows for a tenant's contract period.
 * With a start but no end, a default one-year contract is assumed. Without a start → none.
 */
export function buildCheckDepositReminders(tenant: ContractTenant) {
  const end = contractEndOf(tenant);
  if (!tenant.contractStart || !end) return [];

  return monthlyDueDates(tenant.contractStart, end, tenant.paymentDay).map((dueDate) => ({
    type: "CHECK_DEPOSIT",
    title: checkDepositTitle(dueDate, tenant.fullName),
    dueDate,
    done: false,
    propertyId: tenant.propertyId,
    tenantId: tenant.id,
  }));
}

/** One CONTRACT_END reminder, RENEWAL_LEAD_DAYS before the end; none without a contract end. */
export function buildRenewalReminder(tenant: ContractTenant) {
  const end = contractEndOf(tenant);
  if (!end) return [];

  return [
    {
      type: "CONTRACT_END",
      title: renewalReminderTitle(tenant.fullName),
      dueDate: renewalReminderDate(end),
      done: false,
      propertyId: tenant.propertyId,
      tenantId: tenant.id,
    },
  ];
}

/** Everything derived from the contract: the cheque schedule plus the renewal reminder. */
export function buildContractReminders(tenant: ContractTenant) {
  return [...buildCheckDepositReminders(tenant), ...buildRenewalReminder(tenant)];
}
