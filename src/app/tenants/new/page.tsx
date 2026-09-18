import type { Metadata } from "next";
import { TenantForm } from "@/components/forms/tenant-form";
import { Card, PageHeader } from "@/components/ui";
import { createTenant } from "@/lib/actions/tenants";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "דייר חדש" };

export default async function NewTenantPage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
  const { propertyId } = await searchParams;
  const properties = await prisma.property.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="דייר חדש" />
      <Card>
        <TenantForm
          action={createTenant}
          properties={properties}
          initial={{ propertyId: propertyId ?? "" }}
          submitLabel="שמירת דייר"
          cancelHref={propertyId ? `/properties/${propertyId}` : "/tenants"}
        />
      </Card>
    </div>
  );
}
