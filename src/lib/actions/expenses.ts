"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { EXPENSE_CATEGORIES, isKeyOf } from "@/lib/constants";
import { type ActionState, failure, getDate, getNumber, getOptionalString, getString } from "@/lib/form";

async function parseExpense(formData: FormData) {
  const title = getString(formData, "title");
  const propertyId = getString(formData, "propertyId");
  const category = getString(formData, "category");
  const amount = getNumber(formData, "amount");
  const date = getDate(formData, "date");

  if (!title) return failure("יש להזין תיאור להוצאה", formData);
  if (!propertyId) return failure("יש לבחור נכס", formData);
  if (!isKeyOf(EXPENSE_CATEGORIES, category)) return failure("קטגוריה לא תקינה", formData);
  if (amount == null || amount <= 0) return failure("יש להזין סכום גדול מאפס", formData);
  if (!date) return failure("יש להזין תאריך", formData);

  const exists = await prisma.property.findUnique({ where: { id: propertyId }, select: { id: true } });
  if (!exists) return failure("הנכס שנבחר לא נמצא", formData);

  return {
    data: {
      title,
      propertyId,
      category,
      amount,
      date,
      vendor: getOptionalString(formData, "vendor"),
      notes: getOptionalString(formData, "notes"),
    },
  };
}

function revalidateExpenses(propertyId?: string) {
  revalidatePath("/");
  revalidatePath("/expenses");
  if (propertyId) revalidatePath(`/properties/${propertyId}`);
}

export async function createExpense(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = await parseExpense(formData);
  if ("error" in parsed) return parsed;

  await prisma.expense.create({ data: parsed.data });
  revalidateExpenses(parsed.data.propertyId);
  redirect(`/properties/${parsed.data.propertyId}`);
}

export async function updateExpense(id: string, _prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = await parseExpense(formData);
  if ("error" in parsed) return parsed;

  const previous = await prisma.expense.findUnique({ where: { id }, select: { propertyId: true } });
  await prisma.expense.update({ where: { id }, data: parsed.data });
  revalidateExpenses(previous?.propertyId);
  revalidateExpenses(parsed.data.propertyId);
  redirect("/expenses");
}

export async function deleteExpense(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = getString(formData, "id");
  if (!id) return;

  const expense = await prisma.expense.delete({ where: { id }, select: { propertyId: true } });
  revalidateExpenses(expense.propertyId);
  redirect("/expenses");
}
