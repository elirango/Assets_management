import type { Metadata } from "next";
import Link from "next/link";
import { DeleteButton } from "@/components/forms/form-actions";
import { Badge, EmptyState, LinkButton, PageHeader, cx, recordLink, rowAction } from "@/components/ui";
import { deleteTenant } from "@/lib/actions/tenants";
import { daysBetween, formatCurrency, formatDate, todayUtc } from "@/lib/format";
import { isAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "דיירים" };

const th = "px-4 py-3 text-start text-sm font-medium text-muted first:ps-5 last:pe-5";
// Phones: each row restacks as a wrapped block (name first, actions last); md+: a ruled table.
const td = "max-md:py-0.5 md:px-4 md:py-3.5 md:first:ps-5 md:last:pe-5";

export default async function TenantsPage() {
  const canEdit = await isAdmin();
  const tenants = await prisma.tenant.findMany({
    orderBy: { fullName: "asc" },
    include: {
      property: { select: { id: true, name: true } },
      charges: { where: { isPaid: false }, select: { amount: true } },
    },
  });
  const today = todayUtc();

  return (
    <>
      <PageHeader
        title="דיירים"
        description={`${tenants.length} דיירים`}
        action={canEdit ? <LinkButton href="/tenants/new">+ דייר חדש</LinkButton> : undefined}
      />

      {tenants.length === 0 ? (
        <EmptyState
          title="עדיין אין דיירים"
          description="הוסיפו דייר ושייכו אותו לנכס."
          action={canEdit ? <LinkButton href="/tenants/new">הוספת דייר</LinkButton> : undefined}
        />
      ) : (
        <div className="stock overflow-hidden">
          <table className="w-full text-sm">
            <thead className="max-md:sr-only">
              <tr className="border-b border-rule">
                <th scope="col" className={th}>דייר</th>
                <th scope="col" className={th}>נכס</th>
                <th scope="col" className={cx(th, "text-end")}>שכר דירה</th>
                <th scope="col" className={th}>חוזה</th>
                <th scope="col" className={cx(th, "text-end")}>חוב פתוח</th>
                {canEdit && (
                  <th scope="col" className={th}>
                    <span className="sr-only">פעולות</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {tenants.map((tenant) => {
                const daysLeft = tenant.contractEnd ? daysBetween(today, tenant.contractEnd) : null;
                const unpaid = tenant.charges.reduce((sum, charge) => sum + charge.amount, 0);
                return (
                  <tr
                    key={tenant.id}
                    className="align-middle transition-colors duration-(--dur-micro) hover:bg-paper/60 max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-4 max-md:px-4 max-md:py-3"
                  >
                    <td className={cx(td, "max-md:w-full")}>
                      <Link
                        href={`/tenants/${tenant.id}`}
                        className="text-base font-medium text-ink underline-offset-4 hover:underline"
                      >
                        {tenant.fullName}
                      </Link>
                      {tenant.phone && (
                        <a href={`tel:${tenant.phone}`} dir="ltr" className={cx(recordLink, "fig block w-fit text-muted")}>
                          {tenant.phone}
                        </a>
                      )}
                    </td>
                    <td className={td}>
                      {tenant.property ? (
                        <Link href={`/properties/${tenant.property.id}`} className={recordLink}>
                          {tenant.property.name}
                        </Link>
                      ) : (
                        <Badge>ללא נכס</Badge>
                      )}
                    </td>
                    <td className={cx(td, "md:text-end")}>
                      {tenant.monthlyRent != null && (
                        <span className="fig text-ink">
                          {formatCurrency(tenant.monthlyRent)}
                          <span className="text-muted"> / חודש</span>
                        </span>
                      )}
                    </td>
                    <td className={td}>
                      <div className="flex flex-wrap items-center gap-2">
                        {tenant.contractEnd && (
                          <span className="text-muted">עד {formatDate(tenant.contractEnd)}</span>
                        )}
                        {daysLeft != null && daysLeft < 0 && <Badge tone="red">החוזה הסתיים</Badge>}
                        {daysLeft != null && daysLeft >= 0 && daysLeft <= 60 && (
                          <Badge tone="amber">מסתיים בעוד {daysLeft} ימים</Badge>
                        )}
                      </div>
                    </td>
                    <td className={cx(td, "md:text-end")}>
                      {unpaid > 0 ? (
                        <span className="fig font-medium text-accent-2">
                          <span className="md:sr-only">חוב פתוח </span>
                          {formatCurrency(unpaid)}
                        </span>
                      ) : (
                        <span className="text-muted max-md:hidden">אין</span>
                      )}
                    </td>
                    {canEdit && (
                      <td className={cx(td, "max-md:ms-auto")}>
                        <div className="flex items-center justify-end gap-1">
                          <Link href={`/tenants/${tenant.id}/edit`} className={rowAction}>
                            עריכה
                          </Link>
                          <DeleteButton
                            id={tenant.id}
                            action={deleteTenant}
                            confirmMessage={`למחוק את הדייר ${tenant.fullName}?`}
                            variant="ghost"
                          />
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
