import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/forms/form-actions";
import { TenantForm } from "@/components/forms/tenant-form";
import { Card, PageHeader } from "@/components/ui";
import { deleteTenant, updateTenant } from "@/lib/actions/tenants";
import { toDateInputValue } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "עריכת דייר" };

export default async function EditTenantPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [tenant, properties] = await Promise.all([
    prisma.tenant.findUnique({ where: { id } }),
    prisma.property.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!tenant) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="עריכת דייר"
        description={tenant.fullName}
        action={
          <DeleteButton id={tenant.id} action={deleteTenant} confirmMessage={`למחוק את הדייר ${tenant.fullName}?`} />
        }
      />
      <Card>
        <TenantForm
          action={updateTenant.bind(null, tenant.id)}
          properties={properties}
          initial={{
            fullName: tenant.fullName,
            phone: tenant.phone ?? "",
            email: tenant.email ?? "",
            idNumber: tenant.idNumber ?? "",
            monthlyRent: tenant.monthlyRent?.toString() ?? "",
            paymentDay: String(tenant.paymentDay),
            contractStart: toDateInputValue(tenant.contractStart),
            contractEnd: toDateInputValue(tenant.contractEnd),
            propertyId: tenant.propertyId ?? "",
            notes: tenant.notes ?? "",
          }}
          submitLabel="שמירת שינויים"
          cancelHref="/tenants"
        />
      </Card>
    </div>
  );
}
