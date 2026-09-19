"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { MANUAL_CHARGE_TYPES, METER_TYPES, isKeyOf } from "@/lib/constants";
import { type ActionState, failure, getDate, getNumber, getString } from "@/lib/form";
import { todayUtc } from "@/lib/format";
import { MAX_CHARGE_MONTHS, calculateManualCharge, isValidMonths, manualChargeDescription } from "@/lib/charges";
import { calculateMeterBill, meterChargeDescription, meterFixedFeeApplies } from "@/lib/meters";

function revalidateTenant(tenantId: string, propertyId?: string | null) {
  revalidatePath("/");
  revalidatePath(`/tenants/${tenantId}`);
  if (propertyId) revalidatePath(`/properties/${propertyId}`);
}

/**
 * Saves a meter reading and, in the same transaction, the charge it produces for the tenant.
 * Bound to a tenant id from the tenant page: `createMeterReading.bind(null, tenantId)`.
 */
export async function createMeterReading(
  tenantId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const type = getString(formData, "type");
  const previous = getNumber(formData, "previous");
  const current = getNumber(formData, "current");
  const rate = getNumber(formData, "rate");
  const date = getDate(formData, "date") ?? todayUtc();

  if (!isKeyOf(METER_TYPES, type)) return failure("יש לבחור סוג מונה", formData);
  if (previous == null || previous < 0) return failure("יש להזין קריאה קודמת תקינה", formData);
  if (current == null || current < 0) return failure("יש להזין קריאה נוכחית תקינה", formData);
  if (current < previous) return failure("הקריאה הנוכחית חייבת להיות גדולה או שווה לקריאה הקודמת", formData);
  if (rate == null || rate < 0) return failure("יש להזין תעריף ליחידה", formData);

  // The fee only exists for electricity; a stale value from a hidden field is ignored.
  const fixedFee = meterFixedFeeApplies(type) ? (getNumber(formData, "fixedFee") ?? 0) : 0;
  if (fixedFee < 0) return failure("התשלום הקבוע לא יכול להיות שלילי", formData);

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, propertyId: true } });
  if (!tenant) return failure("הדייר לא נמצא", formData);

  const bill = calculateMeterBill({ type, previous, current, rate, fixedFee });

  await prisma.$transaction(async (tx) => {
    await tx.meterReading.create({
      data: { tenantId, type, previous, current, rate, fixedFee: bill.fixedFee, totalAmount: bill.total, date },
    });
    await tx.charge.create({
      data: { tenantId, amount: bill.total, description: meterChargeDescription(type, date), date, isPaid: false },
    });
  });

  revalidateTenant(tenantId, tenant.propertyId);
  redirect(`/tenants/${tenantId}`);
}

/**
 * Saves a hand-entered recurring charge (HOA / property tax) for a tenant.
 * Amount and description are derived on the server from type × months × rate so a
 * tampered form cannot post an arbitrary total; a non-empty `description` field wins
 * over the generated one when the user wants to annotate the charge.
 * Bound to a tenant id from the tenant page: `createManualCharge.bind(null, tenantId)`.
 */
export async function createManualCharge(
  tenantId: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const type = getString(formData, "type");
  const months = getNumber(formData, "months");
  const rate = getNumber(formData, "rate");
  const date = getDate(formData, "date") ?? todayUtc();

  if (!isKeyOf(MANUAL_CHARGE_TYPES, type)) return failure("יש לבחור סוג חיוב", formData);
  if (months == null || !isValidMonths(months)) {
    return failure(`מספר החודשים חייב להיות מספר שלם בין 1 ל-${MAX_CHARGE_MONTHS}`, formData);
  }
  if (rate == null || rate <= 0) return failure("יש להזין תעריף חודשי גדול מאפס", formData);

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true, propertyId: true } });
  if (!tenant) return failure("הדייר לא נמצא", formData);

  const amount = calculateManualCharge(months, rate);
  const description = getString(formData, "description") || manualChargeDescription(type, months);

  await prisma.charge.create({ data: { tenantId, amount, description, date, isPaid: false } });

  revalidateTenant(tenantId, tenant.propertyId);
  redirect(`/tenants/${tenantId}`);
}

export async function toggleChargePaid(formData: FormData): Promise<void> {
  const id = getString(formData, "id");
  if (!id) return;

  const charge = await prisma.charge.findUnique({
    where: { id },
    select: { isPaid: true, tenantId: true, tenant: { select: { propertyId: true } } },
  });
  if (!charge) return;

  await prisma.charge.update({ where: { id }, data: { isPaid: !charge.isPaid } });
  revalidateTenant(charge.tenantId, charge.tenant.propertyId);
}

export async function deleteCharge(formData: FormData): Promise<void> {
  const id = getString(formData, "id");
  if (!id) return;

  const charge = await prisma.charge.delete({
    where: { id },
    select: { tenantId: true, tenant: { select: { propertyId: true } } },
  });
  revalidateTenant(charge.tenantId, charge.tenant.propertyId);
}
