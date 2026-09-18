import type { Metadata } from "next";
import { PropertyForm } from "@/components/forms/property-form";
import { Card, PageHeader } from "@/components/ui";
import { createProperty } from "@/lib/actions/properties";

export const metadata: Metadata = { title: "נכס חדש" };

export default function NewPropertyPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="נכס חדש" />
      <Card>
        <PropertyForm action={createProperty} submitLabel="שמירת נכס" cancelHref="/properties" />
      </Card>
    </div>
  );
}
