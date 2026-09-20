import type { Metadata } from "next";
import Link from "next/link";
import { DeleteButton } from "@/components/forms/form-actions";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { deleteExpense } from "@/lib/actions/expenses";
import { EXPENSE_CATEGORIES, labelOf } from "@/lib/constants";
import { formatCurrency, formatDate } from "@/lib/format";
import { isAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "הוצאות ותיקונים" };

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
        description={`${expenses.length} רשומות · סה״כ ${formatCurrency(total)}`}
        action={canEdit ? <LinkButton href="/expenses/new">+ הוצאה חדשה</LinkButton> : undefined}
      />

      {properties.length > 1 && (
        <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
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
      )}

      {expenses.length === 0 ? (
        <EmptyState
          title="לא נרשמו הוצאות"
          description="רשמו תיקונים, תחזוקה וחשבונות לכל נכס."
          action={canEdit ? <LinkButton href="/expenses/new">הוספת הוצאה</LinkButton> : undefined}
        />
      ) : (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {expenses.map((expense) => (
            <li key={expense.id} className="flex items-start gap-3 p-3 sm:items-center sm:p-4">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold text-slate-900">{expense.title}</p>
                  <Badge>{labelOf(EXPENSE_CATEGORIES, expense.category)}</Badge>
                </div>
                <p className="mt-1 text-sm text-slate-500">
                  <Link href={`/properties/${expense.property.id}`} className="hover:underline">
                    {expense.property.name}
                  </Link>
                  {" · "}
                  {formatDate(expense.date)}
                  {expense.vendor && ` · ${expense.vendor}`}
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
                <span className="font-semibold tabular-nums text-slate-900">{formatCurrency(expense.amount)}</span>
                {canEdit && (
                  <div className="flex items-center">
                    <Link
                      href={`/expenses/${expense.id}/edit`}
                      className="rounded-lg px-2 py-1 text-sm text-blue-700 hover:bg-blue-50"
                    >
                      עריכה
                    </Link>
                    <DeleteButton
                      id={expense.id}
                      action={deleteExpense}
                      confirmMessage="למחוק את ההוצאה?"
                      variant="ghost"
                    />
                  </div>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}

function FilterChip({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={
        active
          ? "shrink-0 rounded-full bg-slate-900 px-3 py-1.5 text-sm font-medium text-white"
          : "shrink-0 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
      }
    >
      {children}
    </Link>
  );
}
