"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { REMINDER_TYPES, isKeyOf } from "@/lib/constants";
import { type ActionState, failure, getDate, getOptionalString, getString } from "@/lib/form";

async function parseReminder(formData: FormData) {
  const title = getString(formData, "title");
  const type = getString(formData, "type");
  const dueDate = getDate(formData, "dueDate");
  const propertyId = getOptionalString(formData, "propertyId");
  const tenantId = getOptionalString(formData, "tenantId");

  if (!title) return failure("יש להזין כותרת לתזכורת", formData);
  if (!isKeyOf(REMINDER_TYPES, type)) return failure("סוג תזכורת לא תקין", formData);
  if (!dueDate) return failure("יש להזין תאריך יעד", formData);

  if (propertyId) {
    const exists = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true } });
    if (!exists) return failure("הנכס שנבחר לא נמצא", formData);
  }
  if (tenantId) {
    const exists = await prisma.tenant.findUnique({ where: { id: tenantId }, select: { id: true } });
    if (!exists) return failure("הדייר שנבחר לא נמצא", formData);
  }

  return {
    data: {
      title,
      type,
      dueDate,
      propertyId,
      tenantId,
      notes: getOptionalString(formData, "notes"),
    },
  };
}

function revalidateReminders(propertyId?: string | null) {
  revalidatePath("/");
  revalidatePath("/reminders");
  if (propertyId) revalidatePath(`/properties/${propertyId}`);
}

export async function createReminder(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = await parseReminder(formData);
  if ("error" in parsed) return parsed;

  await prisma.reminder.create({ data: parsed.data });
  revalidateReminders(parsed.data.propertyId);
  redirect("/reminders");
}

export async function updateReminder(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = await parseReminder(formData);
  if ("error" in parsed) return parsed;

  const previous = await prisma.reminder.findUnique({ where: { id }, select: { propertyId: true } });
  await prisma.reminder.update({ where: { id }, data: parsed.data });
  revalidateReminders(previous?.propertyId);
  revalidateReminders(parsed.data.propertyId);
  redirect("/reminders");
}

export async function toggleReminderDone(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = getString(formData, "id");
  if (!id) return;

  const reminder = await prisma.reminder.findUnique({ where: { id }, select: { done: true, propertyId: true } });
  if (!reminder) return;

  await prisma.reminder.update({ where: { id }, data: { done: !reminder.done } });
  revalidateReminders(reminder.propertyId);
}

export async function deleteReminder(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = getString(formData, "id");
  if (!id) return;

  const reminder = await prisma.reminder.delete({ where: { id }, select: { propertyId: true } });
  revalidateReminders(reminder.propertyId);
}
