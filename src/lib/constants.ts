// Enum-like string fields stored in SQLite. Hebrew labels are defined once here
// and used by forms, lists, and server-side validation.

export const PROPERTY_TYPES = {
  APARTMENT: "דירה",
  HOUSE: "בית פרטי",
  COMMERCIAL: "נכס מסחרי",
  PARKING: "חניה / מחסן",
  OTHER: "אחר",
} as const;

export const EXPENSE_CATEGORIES = {
  REPAIR: "תיקון",
  MAINTENANCE: "תחזוקה שוטפת",
  TAX: "ארנונה ומיסים",
  INSURANCE: "ביטוח",
  UTILITY: "חשבונות (מים / חשמל / גז)",
  VAAD: "ועד בית",
  OTHER: "אחר",
} as const;

export const REMINDER_TYPES = {
  CHECK_DEPOSIT: "הפקדת צ'ק",
  CONTRACT_END: "סיום חוזה",
  METER_READING: "קריאת מונה",
  OTHER: "אחר",
} as const;

export const METER_TYPES = {
  ELECTRICITY: "חשמל",
  WATER: "מים",
} as const;

/** Unit shown next to meter readings, per type. */
export const METER_UNITS: Record<keyof typeof METER_TYPES, string> = {
  ELECTRICITY: "קוט\"ש",
  WATER: "מ\"ק",
};

/** Recurring charges entered by hand on the tenant page (months × monthly rate). */
export const MANUAL_CHARGE_TYPES = {
  TAX: "ארנונה",
  HOA: "ועד בית",
} as const;

/** Pre-filled monthly rate per manual charge type; null leaves the field empty. */
export const MANUAL_CHARGE_DEFAULT_RATE: Record<keyof typeof MANUAL_CHARGE_TYPES, number | null> = {
  TAX: null,
  HOA: 40,
};

export type PropertyType = keyof typeof PROPERTY_TYPES;
export type ManualChargeType = keyof typeof MANUAL_CHARGE_TYPES;
export type MeterType = keyof typeof METER_TYPES;
export type ExpenseCategory = keyof typeof EXPENSE_CATEGORIES;
export type ReminderType = keyof typeof REMINDER_TYPES;

type LabelMap = Record<string, string>;

export function isKeyOf<M extends LabelMap>(map: M, key: string): key is Extract<keyof M, string> {
  return Object.prototype.hasOwnProperty.call(map, key);
}

export function labelOf(map: LabelMap, key: string): string {
  return map[key] ?? key;
}

export function toOptions(map: LabelMap): { value: string; label: string }[] {
  return Object.entries(map).map(([value, label]) => ({ value, label }));
}
