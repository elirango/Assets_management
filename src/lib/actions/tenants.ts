"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  CONTRACT_REMINDER_TYPES,
  DEFAULT_CONTRACT_MONTHS,
  DEFAULT_PAYMENT_DAY,
  MAX_CONTRACT_MONTHS,
  MAX_PAYMENT_DAY,
  MIN_CONTRACT_MONTHS,
  MIN_PAYMENT_DAY,
  buildContractReminders,
  contractEndFromStart,
  isValidContractMonths,
  isValidPaymentDay,
  parseIsoDate,
} from "@/lib/contract";
import { type ActionState, failure, getDate, getNumber, getOptionalString, getString } from "@/lib/form";

async function parseTenant(formData: FormData) {
  const fullName = getString(formData, "fullName");
  if (!fullName) return failure("יש להזין שם מלא", formData);

  const propertyId = getOptionalString(formData, "propertyId");
  if (propertyId) {
    const exists = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true } });
    if (!exists) return failure("הנכס שנבחר לא נמצא", formData);
  }

  const contractStart = getDate(formData, "contractStart");
  // Contract length is not stored; it only drives the end-date default. Empty → 12 months.
  const contractMonths = getNumber(formData, "contractMonths") ?? DEFAULT_CONTRACT_MONTHS;
  if (!isValidContractMonths(contractMonths)) {
    return failure(`משך החוזה חייב להיות מספר שלם של חודשים בין ${MIN_CONTRACT_MONTHS} ל-${MAX_CONTRACT_MONTHS}`, formData);
  }
  // The form fills the end date client-side; repeat the rule here so a submit without
  // JavaScript (or a cleared field) still gets start + duration − 1 day.
  const contractEnd =
    getDate(formData, "contractEnd") ??
    (contractStart ? parseIsoDate(contractEndFromStart(getString(formData, "contractStart"), contractMonths)) : null);
  if (contractStart && contractEnd && contractEnd < contractStart) {
    return failure("תאריך סיום החוזה חייב להיות אחרי תאריך ההתחלה", formData);
  }

  const monthlyRent = getNumber(formData, "monthlyRent");
  if (monthlyRent != null && monthlyRent < 0) return failure("שכר הדירה לא יכול להיות שלילי", formData);

  // Empty → default; anything else must be a whole day of month.
  const paymentDay = getNumber(formData, "paymentDay") ?? DEFAULT_PAYMENT_DAY;
  if (!isValidPaymentDay(paymentDay)) {
    return failure(`יום התשלום חייב להיות מספר שלם בין ${MIN_PAYMENT_DAY} ל-${MAX_PAYMENT_DAY}`, formData);
  }

  return {
    data: {
      fullName,
      phone: getOptionalString(formData, "phone"),
      email: getOptionalString(formData, "email"),
      idNumber: getOptionalString(formData, "idNumber"),
      monthlyRent,
      paymentDay,
      contractStart,
      contractEnd,
      propertyId,
      notes: getOptionalString(formData, "notes"),
    },
  };
}

function revalidateTenants(propertyId?: string | null) {
  revalidatePath("/");
  revalidatePath("/tenants");
  revalidatePath("/reminders");
  if (propertyId) revalidatePath(`/properties/${propertyId}`);
}

export async function createTenant(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = await parseTenant(formData);
  if ("error" in parsed) return parsed;

  // Tenant + its contract reminders (monthly cheques and the renewal) are written atomically.
  await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.create({ data: parsed.data });
    const reminders = buildContractReminders(tenant);
    if (reminders.length > 0) await tx.reminder.createMany({ data: reminders });
  });

  revalidateTenants(parsed.data.propertyId);
  redirect(parsed.data.propertyId ? `/properties/${parsed.data.propertyId}` : "/tenants");
}

export async function updateTenant(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = await parseTenant(formData);
  if ("error" in parsed) return parsed;

  const previous = await prisma.tenant.findUnique({
    where: { id },
    select: { propertyId: true, contractStart: true, contractEnd: true, paymentDay: true },
  });
  if (!previous) return failure("הדייר לא נמצא", formData);

  const contractChanged =
    previous.propertyId !== parsed.data.propertyId ||
    previous.paymentDay !== parsed.data.paymentDay ||
    previous.contractStart?.getTime() !== parsed.data.contractStart?.getTime() ||
    previous.contractEnd?.getTime() !== parsed.data.contractEnd?.getTime();

  await prisma.$transaction(async (tx) => {
    const tenant = await tx.tenant.update({ where: { id }, data: parsed.data });
    if (!contractChanged) return;

    // The contract period, payment day or property moved: rebuild the cheque schedule and the
    // renewal reminder. Reminders already marked done are kept as history; only open ones are replaced.
    await tx.reminder.deleteMany({
      where: { tenantId: id, type: { in: [...CONTRACT_REMINDER_TYPES] }, done: false },
    });
    const reminders = buildContractReminders(tenant);
    if (reminders.length > 0) await tx.reminder.createMany({ data: reminders });
  });

  revalidateTenants(previous.propertyId);
  revalidateTenants(parsed.data.propertyId);
  redirect("/tenants");
}

export async function deleteTenant(formData: FormData): Promise<void> {
  const id = getString(formData, "id");
  if (!id) return;

  // Reminders that belong to the tenant (cheque schedule, contract end) go with it;
  // the schema only nulls the link, which would leave orphaned reminders behind.
  const tenant = await prisma.$transaction(async (tx) => {
    await tx.reminder.deleteMany({ where: { tenantId: id } });
    return tx.tenant.delete({ where: { id }, select: { propertyId: true } });
  });
  revalidateTenants(tenant.propertyId);
  redirect("/tenants");
}
