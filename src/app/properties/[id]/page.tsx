import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton } from "@/components/forms/form-actions";
import { ReminderList } from "@/components/reminder-list";
import { Badge, Card, DetailRow, EmptyState, LinkButton, PageHeader, SectionTitle, cx, recordLink } from "@/components/ui";
import { deleteProperty } from "@/lib/actions/properties";
import { EXPENSE_CATEGORIES, PROPERTY_TYPES, labelOf } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { isAdmin } from "@/lib/authz";
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
  const [property, canEdit] = await Promise.all([getProperty(id), isAdmin()]);
  if (!property) notFound();

  const totalExpenses = property.expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <>
      <nav aria-label="ניווט משני" className="mb-2 text-sm">
        <Link href="/properties" className={recordLink}>
          כל הנכסים
        </Link>
      </nav>
      <PageHeader
        title={property.name}
        description={`${property.address}, ${property.city}`}
        action={
          canEdit ? (
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
          ) : undefined
        }
      />

      <div className="grid gap-10 lg:grid-cols-3 lg:gap-8">
        <div className="space-y-12 lg:col-span-2">
          <section>
            <SectionTitle
              action={
                canEdit ? (
                  <LinkButton
                    href={`/tenants/new?propertyId=${property.id}`}
                    variant="secondary"
                    className="min-h-9! px-3 text-sm"
                  >
                    + דייר
                  </LinkButton>
                ) : undefined
              }
            >
              דיירים ({property.tenants.length})
            </SectionTitle>
            {property.tenants.length === 0 ? (
              <EmptyState title="אין דיירים בנכס זה" />
            ) : (
              <ul className="stock divide-y divide-rule overflow-hidden">
                {property.tenants.map((tenant) => (
                  <li key={tenant.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                    <div className="min-w-0">
                      <Link href={`/tenants/${tenant.id}`} className="font-medium text-ink underline-offset-4 hover:underline">
                        {tenant.fullName}
                      </Link>
                      <p className="flex flex-wrap gap-x-3 text-sm text-muted">
                        {tenant.phone && (
                          <a href={`tel:${tenant.phone}`} dir="ltr" className={cx(recordLink, "fig text-muted")}>
                            {tenant.phone}
                          </a>
                        )}
                        {tenant.contractEnd && <span>חוזה עד {formatDate(tenant.contractEnd)}</span>}
                      </p>
                    </div>
                    {tenant.monthlyRent != null && (
                      <span className="fig shrink-0 text-ink">
                        {formatCurrency(tenant.monthlyRent)}
                        <span className="text-sm text-muted"> / חודש</span>
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section>
            <SectionTitle
              action={
                canEdit ? (
                  <LinkButton
                    href={`/expenses/new?propertyId=${property.id}`}
                    variant="secondary"
                    className="min-h-9! px-3 text-sm"
                  >
                    + הוצאה
                  </LinkButton>
                ) : undefined
              }
            >
              הוצאות ותיקונים ({property.expenses.length})
            </SectionTitle>
            {property.expenses.length === 0 ? (
              <EmptyState title="לא נרשמו הוצאות לנכס זה" />
            ) : (
              <div className="stock overflow-hidden">
                <ul className="divide-y divide-rule">
                  {property.expenses.map((expense) => (
                    <li key={expense.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                      <div className="min-w-0">
                        <Link
                          href={`/expenses/${expense.id}/edit`}
                          className="font-medium text-ink underline-offset-4 hover:underline"
                        >
                          {expense.title}
                        </Link>
                        <p className="flex flex-wrap gap-x-3 text-sm text-muted">
                          <span>{labelOf(EXPENSE_CATEGORIES, expense.category)}</span>
                          <span className="fig">{formatDate(expense.date)}</span>
                          {expense.vendor && <span>{expense.vendor}</span>}
                        </p>
                      </div>
                      <span className="fig shrink-0 text-base font-medium text-ink">
                        {formatCurrency(expense.amount)}
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="flex justify-between border-t-2 border-ink/80 bg-paper px-4 py-3 font-medium text-ink sm:px-5">
                  <span>סה״כ</span>
                  <span className="fig text-base">{formatCurrency(totalExpenses)}</span>
                </div>
              </div>
            )}
          </section>

          <section>
            <SectionTitle
              action={
                canEdit ? (
                  <LinkButton
                    href={`/reminders/new?propertyId=${property.id}`}
                    variant="secondary"
                    className="min-h-9! px-3 text-sm"
                  >
                    + תזכורת
                  </LinkButton>
                ) : undefined
              }
            >
              תזכורות פתוחות ({property.reminders.length})
            </SectionTitle>
            {property.reminders.length === 0 ? (
              <EmptyState title="אין תזכורות פתוחות לנכס זה" />
            ) : (
              <ReminderList reminders={property.reminders} readOnly={!canEdit} />
            )}
          </section>
        </div>

        <aside className="lg:sticky lg:top-10 lg:self-start">
          <Card>
            <h2 className="mb-2 text-section text-ink">פרטי הנכס</h2>
            <dl className="divide-y divide-rule">
              <DetailRow label="סוג" value={<Badge tone="blue">{labelOf(PROPERTY_TYPES, property.type)}</Badge>} />
              <DetailRow label="חדרים" value={property.rooms ?? "—"} />
              <DetailRow label='שטח (מ"ר)' value={property.sizeSqm ?? "—"} />
              <DetailRow label="נוסף בתאריך" value={formatDate(property.createdAt)} />
            </dl>
            {property.notes && (
              <p className="mt-3 whitespace-pre-wrap border-t border-rule pt-3 text-sm text-ink-2">{property.notes}</p>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
