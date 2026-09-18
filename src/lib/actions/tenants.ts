"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
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
  const contractEnd = getDate(formData, "contractEnd");
  if (contractStart && contractEnd && contractEnd < contractStart) {
    return failure("תאריך סיום החוזה חייב להיות אחרי תאריך ההתחלה", formData);
  }

  const monthlyRent = getNumber(formData, "monthlyRent");
  if (monthlyRent != null && monthlyRent < 0) return failure("שכר הדירה לא יכול להיות שלילי", formData);

  return {
    data: {
      fullName,
      phone: getOptionalString(formData, "phone"),
      email: getOptionalString(formData, "email"),
      idNumber: getOptionalString(formData, "idNumber"),
      monthlyRent,
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
  if (propertyId) revalidatePath(`/properties/${propertyId}`);
}

export async function createTenant(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = await parseTenant(formData);
  if ("error" in parsed) return parsed;

  await prisma.tenant.create({ data: parsed.data });
  revalidateTenants(parsed.data.propertyId);
  redirect(parsed.data.propertyId ? `/properties/${parsed.data.propertyId}` : "/tenants");
}

export async function updateTenant(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = await parseTenant(formData);
  if ("error" in parsed) return parsed;

  const previous = await prisma.tenant.findUnique({ where: { id }, select: { propertyId: true } });
  await prisma.tenant.update({ where: { id }, data: parsed.data });
  revalidateTenants(previous?.propertyId);
  revalidateTenants(parsed.data.propertyId);
  redirect("/tenants");
}

export async function deleteTenant(formData: FormData): Promise<void> {
  const id = getString(formData, "id");
  if (!id) return;

  const tenant = await prisma.tenant.delete({ where: { id }, select: { propertyId: true } });
  revalidateTenants(tenant.propertyId);
  revalidatePath("/reminders");
  redirect("/tenants");
}
