// Manual (HOA / property tax) charge arithmetic shared by the form preview and the server action.

import { MANUAL_CHARGE_TYPES, type ManualChargeType, labelOf } from "@/lib/constants";
import { roundMoney } from "@/lib/meters";
import { type BillingMonth, withBillingPeriod } from "@/lib/billingPeriod";

export const MAX_CHARGE_MONTHS = 60;

export function isValidMonths(months: number): boolean {
  return Number.isInteger(months) && months >= 1 && months <= MAX_CHARGE_MONTHS;
}

/** months × monthly rate, rounded to agorot. */
export function calculateManualCharge(months: number, rate: number): number {
  return roundMoney(months * rate);
}

/**
 * "ועד בית, 3 חודשים" / "ארנונה, חודש אחד"; with a billing period the months are named instead:
 * "ארנונה (ינואר-פברואר)".
 */
export function manualChargeDescription(
  type: ManualChargeType,
  months: number,
  billingMonths: BillingMonth[] = [],
): string {
  const label = labelOf(MANUAL_CHARGE_TYPES, type);
  if (billingMonths.length > 0) return withBillingPeriod(label, billingMonths);
  const period = months === 1 ? "חודש אחד" : `${months} חודשים`;
  return `${label}, ${period}`;
}
