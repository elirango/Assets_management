// Utility bill arithmetic shared by the calculator form (live preview) and the server action.

import { METER_TYPES, type MeterType, labelOf } from "@/lib/constants";

export type MeterBillInput = {
  type: MeterType;
  previous: number;
  current: number;
  rate: number;
  /** Only electricity bills carry a fixed fee; it is ignored for water. */
  fixedFee: number;
};

/** Money is rounded to agorot (2 decimals) to avoid float noise like 123.45000000001. */
export function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

export function meterFixedFeeApplies(type: MeterType): boolean {
  return type === "ELECTRICITY";
}

/** ((current − previous) × rate) + fixedFee */
export function calculateMeterBill(input: MeterBillInput): { units: number; usageCost: number; fixedFee: number; total: number } {
  const units = roundMoney(input.current - input.previous);
  const usageCost = roundMoney(units * input.rate);
  const fixedFee = meterFixedFeeApplies(input.type) ? roundMoney(input.fixedFee) : 0;
  return { units, usageCost, fixedFee, total: roundMoney(usageCost + fixedFee) };
}

/** "חיוב חשמל - 09/2026" */
export function meterChargeDescription(type: MeterType, date: Date): string {
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `חיוב ${labelOf(METER_TYPES, type)} - ${month}/${date.getUTCFullYear()}`;
}
