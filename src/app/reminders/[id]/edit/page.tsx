import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { DeleteButton } from "@/components/forms/form-actions";
import { ReminderForm } from "@/components/forms/reminder-form";
import { Card, PageHeader } from "@/components/ui";
import { deleteReminder, updateReminder } from "@/lib/actions/reminders";
import { toDateInputValue } from "@/lib/format";
import { requireAdminPage } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "עריכת תזכורת" };

export default async function EditReminderPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const [reminder, properties, tenants] = await Promise.all([
    prisma.reminder.findUnique({ where: { id } }),
    prisma.property.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.tenant.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
  ]);
  if (!reminder) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="עריכת תזכורת"
        description={reminder.title}
        action={<DeleteButton id={reminder.id} action={deleteReminderAndGoBack} confirmMessage="למחוק את התזכורת?" />}
      />
      <Card>
        <ReminderForm
          action={updateReminder.bind(null, reminder.id)}
          properties={properties}
          tenants={tenants}
          initial={{
            title: reminder.title,
            type: reminder.type,
            dueDate: toDateInputValue(reminder.dueDate),
            propertyId: reminder.propertyId ?? "",
            tenantId: reminder.tenantId ?? "",
            notes: reminder.notes ?? "",
          }}
          submitLabel="שמירת שינויים"
          cancelHref="/reminders"
        />
      </Card>
    </div>
  );
}

// deleteReminder stays on the current page (used inline in lists); from the edit page we navigate back.
async function deleteReminderAndGoBack(formData: FormData) {
  "use server";
  await deleteReminder(formData);
  redirect("/reminders");
}
