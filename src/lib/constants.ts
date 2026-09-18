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

export type PropertyType = keyof typeof PROPERTY_TYPES;
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
