import type { Metadata } from "next";
import Link from "next/link";
import { DeleteButton } from "@/components/forms/form-actions";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { deleteTenant } from "@/lib/actions/tenants";
import { daysBetween, formatCurrency, formatDate, todayUtc } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "דיירים" };

export default async function TenantsPage() {
  const tenants = await prisma.tenant.findMany({
    orderBy: { fullName: "asc" },
    include: { property: { select: { id: true, name: true } } },
  });
  const today = todayUtc();

  return (
    <>
      <PageHeader
        title="דיירים"
        description={`${tenants.length} דיירים`}
        action={<LinkButton href="/tenants/new">+ דייר חדש</LinkButton>}
      />

      {tenants.length === 0 ? (
        <EmptyState
          title="עדיין אין דיירים"
          description="הוסיפו דייר ושייכו אותו לנכס."
          action={<LinkButton href="/tenants/new">הוספת דייר</LinkButton>}
        />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {tenants.map((tenant) => {
            const daysLeft = tenant.contractEnd ? daysBetween(today, tenant.contractEnd) : null;
            return (
              <li key={tenant.id} className="flex items-start gap-3 p-3 sm:items-center sm:p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold text-slate-900">{tenant.fullName}</p>
                    {tenant.property ? (
                      <Link href={`/properties/${tenant.property.id}`}>
                        <Badge tone="blue">{tenant.property.name}</Badge>
                      </Link>
                    ) : (
                      <Badge>ללא נכס</Badge>
                    )}
                    {daysLeft != null && daysLeft < 0 && <Badge tone="red">החוזה הסתיים</Badge>}
                    {daysLeft != null && daysLeft >= 0 && daysLeft <= 60 && (
                      <Badge tone="amber">החוזה מסתיים בעוד {daysLeft} ימים</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-slate-500">
                    {tenant.phone && (
                      <a href={`tel:${tenant.phone}`} dir="ltr" className="hover:underline">
                        {tenant.phone}
                      </a>
                    )}
                    {tenant.phone && tenant.monthlyRent != null && " · "}
                    {tenant.monthlyRent != null && `${formatCurrency(tenant.monthlyRent)} / חודש`}
                    {(tenant.phone || tenant.monthlyRent != null) && tenant.contractEnd && " · "}
                    {tenant.contractEnd && `חוזה עד ${formatDate(tenant.contractEnd)}`}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                  <Link href={`/tenants/${tenant.id}/edit`} className="rounded-lg px-2 py-1 text-sm text-blue-700 hover:bg-blue-50">
                    עריכה
                  </Link>
                  <DeleteButton
                    id={tenant.id}
                    action={deleteTenant}
                    confirmMessage={`למחוק את הדייר ${tenant.fullName}?`}
                    variant="ghost"
                  />
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
