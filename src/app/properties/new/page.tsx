import type { Metadata } from "next";
import { PropertyForm } from "@/components/forms/property-form";
import { Card, PageHeader } from "@/components/ui";
import { createProperty } from "@/lib/actions/properties";
import { requireAdminPage } from "@/lib/authz";

export const metadata: Metadata = { title: "נכס חדש" };

export default async function NewPropertyPage() {
  await requireAdminPage();
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="נכס חדש" />
      <Card>
        <PropertyForm action={createProperty} submitLabel="שמירת נכס" cancelHref="/properties" />
      </Card>
    </div>
  );
}
