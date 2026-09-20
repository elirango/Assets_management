"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { PROPERTY_TYPES, isKeyOf } from "@/lib/constants";
import { type ActionState, failure, getNumber, getOptionalString, getString } from "@/lib/form";

function parseProperty(formData: FormData) {
  const name = getString(formData, "name");
  const address = getString(formData, "address");
  const city = getString(formData, "city");
  const type = getString(formData, "type");

  if (!name) return failure("יש להזין שם לנכס", formData);
  if (!address) return failure("יש להזין כתובת", formData);
  if (!city) return failure("יש להזין עיר", formData);
  if (!isKeyOf(PROPERTY_TYPES, type)) return failure("סוג נכס לא תקין", formData);

  return {
    data: {
      name,
      address,
      city,
      type,
      rooms: getNumber(formData, "rooms"),
      sizeSqm: getNumber(formData, "sizeSqm"),
      notes: getOptionalString(formData, "notes"),
    },
  };
}

function revalidateProperties(id?: string) {
  revalidatePath("/");
  revalidatePath("/properties");
  if (id) revalidatePath(`/properties/${id}`);
}

export async function createProperty(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseProperty(formData);
  if ("error" in parsed) return parsed;

  const property = await prisma.property.create({ data: parsed.data });
  revalidateProperties(property.id);
  redirect(`/properties/${property.id}`);
}

export async function updateProperty(
  id: string,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  await requireAdmin();
  const parsed = parseProperty(formData);
  if ("error" in parsed) return parsed;

  await prisma.property.update({ where: { id }, data: parsed.data });
  revalidateProperties(id);
  redirect(`/properties/${id}`);
}

export async function deleteProperty(formData: FormData): Promise<void> {
  await requireAdmin();
  const id = getString(formData, "id");
  if (!id) return;

  // Expenses & reminders cascade; tenants are detached (propertyId -> null).
  await prisma.property.delete({ where: { id } });
  revalidateProperties();
  revalidatePath("/tenants");
  revalidatePath("/expenses");
  revalidatePath("/reminders");
  redirect("/properties");
}
