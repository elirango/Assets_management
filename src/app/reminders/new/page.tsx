import type { Metadata } from "next";
import { ReminderForm } from "@/components/forms/reminder-form";
import { Card, PageHeader } from "@/components/ui";
import { createReminder } from "@/lib/actions/reminders";
import { REMINDER_TYPES, isKeyOf } from "@/lib/constants";
import { requireAdminPage } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "תזכורת חדשה" };

export default async function NewReminderPage({
  searchParams,
}: {
  searchParams: Promise<{ propertyId?: string; tenantId?: string; type?: string }>;
}) {
  await requireAdminPage();
  const { propertyId, tenantId, type } = await searchParams;
  const [properties, tenants] = await Promise.all([
    prisma.property.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.tenant.findMany({ orderBy: { fullName: "asc" }, select: { id: true, fullName: true } }),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="תזכורת חדשה" />
      <Card>
        <ReminderForm
          action={createReminder}
          properties={properties}
          tenants={tenants}
          initial={{
            propertyId: propertyId ?? "",
            tenantId: tenantId ?? "",
            type: type && isKeyOf(REMINDER_TYPES, type) ? type : "CHECK_DEPOSIT",
          }}
          submitLabel="שמירת תזכורת"
          cancelHref={propertyId ? `/properties/${propertyId}` : "/reminders"}
        />
      </Card>
    </div>
  );
}
