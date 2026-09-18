import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/forms/form-actions";
import { ReminderList } from "@/components/reminder-list";
import { Badge, Card, DetailRow, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { deleteProperty } from "@/lib/actions/properties";
import { EXPENSE_CATEGORIES, PROPERTY_TYPES, labelOf } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

async function getProperty(id: string) {
  return prisma.property.findUnique({
    where: { id },
    include: {
      tenants: { orderBy: { createdAt: "desc" } },
      expenses: { orderBy: { date: "desc" } },
      reminders: {
        where: { done: false },
        orderBy: { dueDate: "asc" },
        include: { property: { select: { id: true, name: true } }, tenant: { select: { id: true, fullName: true } } },
      },
    },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const property = await prisma.property.findUnique({ where: { id }, select: { name: true } });
  return { title: property?.name ?? "נכס" };
}

export default async function PropertyPage({ params }: Props) {
  const { id } = await params;
  const property = await getProperty(id);
  if (!property) notFound();

  const totalExpenses = property.expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <>
      <Link href="/properties" className="mb-3 inline-block text-sm text-slate-500 hover:text-slate-800">
        → כל הנכסים
      </Link>
      <PageHeader
        title={property.name}
        description={`${property.address}, ${property.city}`}
        action={
          <div className="flex gap-2">
            <LinkButton href={`/properties/${property.id}/edit`} variant="secondary">
              עריכה
            </LinkButton>
            <DeleteButton
              id={property.id}
              action={deleteProperty}
              confirmMessage="למחוק את הנכס? ההוצאות והתזכורות שלו יימחקו, והדיירים ינותקו ממנו."
            />
          </div>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section>
            <SectionTitle
              action={
                <LinkButton href={`/tenants/new?propertyId=${property.id}`} variant="secondary" className="min-h-9 px-3 text-sm">
                  + דייר
                </LinkButton>
              }
            >
              דיירים ({property.tenants.length})
            </SectionTitle>
            {property.tenants.length === 0 ? (
              <EmptyState title="אין דיירים בנכס זה" />
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {property.tenants.map((tenant) => (
                  <li key={tenant.id} className="flex items-center justify-between gap-3 p-3 sm:p-4">
                    <div className="min-w-0">
                      <Link href={`/tenants/${tenant.id}/edit`} className="font-medium text-slate-900 hover:underline">
                        {tenant.fullName}
                      </Link>
                      <p className="text-sm text-slate-500">
                        {tenant.phone && (
                          <a href={`tel:${tenant.phone}`} dir="ltr" className="hover:underline">
                            {tenant.phone}
                          </a>
                        )}
                        {tenant.phone && tenant.contractEnd && " · "}
                        {tenant.contractEnd && `חוזה עד ${formatDate(tenant.contractEnd)}`}
                      </p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold tabular-nums text-slate-800">
                      {tenant.monthlyRent != null ? `${formatCurrency(tenant.monthlyRent)} / חודש` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <SectionTitle
              action={
                <LinkButton href={`/expenses/new?propertyId=${property.id}`} variant="secondary" className="min-h-9 px-3 text-sm">
                  + הוצאה
                </LinkButton>
              }
            >
              הוצאות ותיקונים ({property.expenses.length})
            </SectionTitle>
            {property.expenses.length === 0 ? (
              <EmptyState title="לא נרשמו הוצאות לנכס זה" />
            ) : (
              <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
                <ul className="divide-y divide-slate-100">
                  {property.expenses.map((expense) => (
                    <li key={expense.id} className="flex items-center justify-between gap-3 p-3 sm:p-4">
                      <div className="min-w-0">
                        <Link href={`/expenses/${expense.id}/edit`} className="font-medium text-slate-900 hover:underline">
                          {expense.title}
                        </Link>
                        <p className="text-sm text-slate-500">
                          {labelOf(EXPENSE_CATEGORIES, expense.category)} · {formatDate(expense.date)}
                          {expense.vendor && ` · ${expense.vendor}`}
                        </p>
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums text-slate-900">{formatCurrency(expense.amount)}</span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between border-t border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold">
                  <span>סה״כ</span>
                  <span className="tabular-nums">{formatCurrency(totalExpenses)}</span>
                </div>
              </div>
            )}
          </section>

          <section>
            <SectionTitle
              action={
                <LinkButton href={`/reminders/new?propertyId=${property.id}`} variant="secondary" className="min-h-9 px-3 text-sm">
                  + תזכורת
                </LinkButton>
              }
            >
              תזכורות פתוחות ({property.reminders.length})
            </SectionTitle>
            {property.reminders.length === 0 ? (
              <EmptyState title="אין תזכורות פתוחות לנכס זה" />
            ) : (
              <ReminderList reminders={property.reminders} />
            )}
          </section>
        </div>

        <aside>
          <Card>
            <h2 className="mb-2 font-semibold text-slate-800">פרטי הנכס</h2>
            <dl className="divide-y divide-slate-100">
              <DetailRow label="סוג" value={<Badge tone="blue">{labelOf(PROPERTY_TYPES, property.type)}</Badge>} />
              <DetailRow label="חדרים" value={property.rooms ?? "—"} />
              <DetailRow label='שטח (מ"ר)' value={property.sizeSqm ?? "—"} />
              <DetailRow label="נוסף בתאריך" value={formatDate(property.createdAt)} />
            </dl>
            {property.notes && (
              <p className="mt-3 whitespace-pre-wrap border-t border-slate-100 pt-3 text-sm text-slate-600">{property.notes}</p>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
