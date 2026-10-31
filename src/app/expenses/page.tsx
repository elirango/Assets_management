import type { Metadata } from "next";
import Link from "next/link";
import { DeleteButton } from "@/components/forms/form-actions";
import { Badge, EmptyState, LinkButton, PageHeader, cx, recordLink, rowAction } from "@/components/ui";
import { deleteExpense } from "@/lib/actions/expenses";
import { EXPENSE_CATEGORIES, labelOf } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { isAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "הוצאות ותיקונים" };

const th = "px-4 py-3 text-start text-sm font-medium text-muted first:ps-5 last:pe-5";
// Phones: each row restacks as a wrapped block (title first, actions last); md+: a ruled table.
const td = "max-md:py-0.5 md:px-4 md:py-3.5 md:first:ps-5 md:last:pe-5";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
  const { propertyId } = await searchParams;
  const canEdit = await isAdmin();

  const [expenses, properties] = await Promise.all([
    prisma.expense.findMany({
      where: propertyId ? { propertyId } : undefined,
      orderBy: { date: "desc" },
      include: { property: { select: { id: true, name: true } } },
    }),
    prisma.property.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);

  const total = expenses.reduce((sum, expense) => sum + expense.amount, 0);

  return (
    <>
      <PageHeader
        title="הוצאות ותיקונים"
        description={`${expenses.length} רשומות, סה״כ ${formatCurrency(total)}`}
        action={canEdit ? <LinkButton href="/expenses/new">+ הוצאה חדשה</LinkButton> : undefined}
      />

      {properties.length > 1 && (
        <nav aria-label="סינון לפי נכס" className="mb-5 max-w-full overflow-x-auto">
          <div className="groove inline-flex gap-1 p-1">
            <FilterChip href="/expenses" active={!propertyId}>
              הכל
            </FilterChip>
            {properties.map((property) => (
              <FilterChip
                key={property.id}
                href={`/expenses?propertyId=${property.id}`}
                active={propertyId === property.id}
              >
                {property.name}
              </FilterChip>
            ))}
          </div>
        </nav>
      )}

      {expenses.length === 0 ? (
        <EmptyState
          title="לא נרשמו הוצאות"
          description="רשמו תיקונים, תחזוקה וחשבונות לכל נכס."
          action={canEdit ? <LinkButton href="/expenses/new">הוספת הוצאה</LinkButton> : undefined}
        />
      ) : (
        <div className="stock overflow-hidden">
          <table className="w-full text-sm">
            <thead className="max-md:sr-only">
              <tr className="border-b border-rule">
                <th scope="col" className={th}>הוצאה</th>
                <th scope="col" className={th}>נכס</th>
                <th scope="col" className={th}>תאריך</th>
                <th scope="col" className={cx(th, "text-end")}>סכום</th>
                {canEdit && (
                  <th scope="col" className={th}>
                    <span className="sr-only">פעולות</span>
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-rule">
              {expenses.map((expense) => (
                <tr
                  key={expense.id}
                  className="align-middle transition-colors duration-(--dur-micro) hover:bg-paper/60 max-md:flex max-md:flex-wrap max-md:items-center max-md:gap-x-4 max-md:px-4 max-md:py-3"
                >
                  <td className={cx(td, "max-md:w-full")}>
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-medium text-ink">{expense.title}</p>
                      <Badge tone="blue">{labelOf(EXPENSE_CATEGORIES, expense.category)}</Badge>
                    </div>
                    {expense.vendor && <p className="text-muted">{expense.vendor}</p>}
                  </td>
                  <td className={td}>
                    <Link href={`/properties/${expense.property.id}`} className={recordLink}>
                      {expense.property.name}
                    </Link>
                  </td>
                  <td className={cx(td, "fig text-muted")}>{formatDate(expense.date)}</td>
                  <td className={cx(td, "fig text-base font-medium text-ink md:text-end")}>
                    {formatCurrency(expense.amount)}
                  </td>
                  {canEdit && (
                    <td className={cx(td, "max-md:ms-auto")}>
                      <div className="flex items-center justify-end gap-1">
                        <Link href={`/expenses/${expense.id}/edit`} className={rowAction}>
                          עריכה
                        </Link>
                        <DeleteButton
                          id={expense.id}
                          action={deleteExpense}
                          confirmMessage="למחוק את ההוצאה?"
                          variant="ghost"
                        />
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cx(
        "inline-flex min-h-9 shrink-0 items-center whitespace-nowrap rounded-input px-3 text-sm font-medium transition-colors duration-(--dur-micro)",
        active ? "edge bg-cotton text-ink" : "text-ink-2 hover:bg-paper-3/70 hover:text-ink",
      )}
    >
      {children}
    </Link>
  );
}
