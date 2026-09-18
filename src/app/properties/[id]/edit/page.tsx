import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PropertyForm } from "@/components/forms/property-form";
import { Card, PageHeader } from "@/components/ui";
import { updateProperty } from "@/lib/actions/properties";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "עריכת נכס" };

export default async function EditPropertyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const property = await prisma.property.findUnique({ where: { id } });
  if (!property) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="עריכת נכס" description={property.name} />
      <Card>
        <PropertyForm
          action={updateProperty.bind(null, property.id)}
          initial={{
            name: property.name,
            address: property.address,
            city: property.city,
            type: property.type,
            rooms: property.rooms?.toString() ?? "",
            sizeSqm: property.sizeSqm?.toString() ?? "",
            notes: property.notes ?? "",
          }}
          submitLabel="שמירת שינויים"
          cancelHref={`/properties/${property.id}`}
        />
      </Card>
    </div>
  );
}
