import Link from "next/link";
import { ReminderList } from "@/components/reminder-list";
import { Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { EXPENSE_CATEGORIES, labelOf } from "@/lib/constants";
import { addDays, daysBetween, formatCurrency, formatDate, todayUtc } from "@/lib/format";
import { prisma } from "@/lib/prisma";

export default async function DashboardPage() {
  const today = todayUtc();
  const monthStart = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
  const contractHorizon = addDays(today, 60);

  const [propertyCount, tenantCount, monthExpenses, openReminders, endingContracts, recentExpenses] =
    await Promise.all([
      prisma.property.count(),
      prisma.tenant.count(),
      prisma.expense.aggregate({ _sum: { amount: true }, where: { date: { gte: monthStart } } }),
      prisma.reminder.findMany({
        where: { done: false },
        orderBy: { dueDate: "asc" },
        take: 8,
        include: { property: { select: { id: true, name: true } }, tenant: { select: { id: true, fullName: true } } },
      }),
      prisma.tenant.findMany({
        where: { contractEnd: { gte: today, lte: contractHorizon } },
        orderBy: { contractEnd: "asc" },
        include: { property: { select: { id: true, name: true } } },
      }),
      prisma.expense.findMany({
        orderBy: { date: "desc" },
        take: 5,
        include: { property: { select: { id: true, name: true } } },
      }),
    ]);

  const overdueCount = openReminders.filter((reminder) => reminder.dueDate < today).length;

  return (
    <>
      <PageHeader title="לוח בקרה" description={`היום ${formatDate(today)}`} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="נכסים" value={propertyCount} href="/properties" />
        <StatCard label="דיירים" value={tenantCount} href="/tenants" />
        <StatCard label="הוצאות החודש" value={formatCurrency(monthExpenses._sum.amount ?? 0)} href="/expenses" />
        <StatCard
          label="תזכורות פתוחות"
          value={openReminders.length}
          href="/reminders"
          accent={overdueCount > 0 ? `${overdueCount} באיחור` : undefined}
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <LinkButton href="/expenses/new" variant="secondary">
          + הוצאה
        </LinkButton>
        <LinkButton href="/reminders/new" variant="secondary">
          + תזכורת
        </LinkButton>
        <LinkButton href="/tenants/new" variant="secondary">
          + דייר
        </LinkButton>
        <LinkButton href="/properties/new" variant="secondary">
          + נכס
        </LinkButton>
      </div>

      <section className="mt-8">
        <SectionTitle
          action={
            <Link href="/reminders" className="text-sm text-blue-700 hover:underline">
              לכל התזכורות
            </Link>
          }
        >
          תזכורות קרובות
        </SectionTitle>
        {openReminders.length === 0 ? (
          <EmptyState
            title="אין תזכורות פתוחות"
            description="הוסיפו תזכורת להפקדת צ׳ק, סיום חוזה או קריאת מונה."
            action={<LinkButton href="/reminders/new">הוספת תזכורת</LinkButton>}
          />
        ) : (
          <ReminderList reminders={openReminders} compact />
        )}
      </section>

      {endingContracts.length > 0 && (
        <section className="mt-8">
          <SectionTitle>חוזים שמסתיימים ב-60 הימים הקרובים</SectionTitle>
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {endingContracts.map((tenant) => {
              const days = daysBetween(today, tenant.contractEnd!);
              return (
                <li key={tenant.id} className="flex items-center justify-between gap-3 p-3 sm:p-4">
                  <div className="min-w-0">
                    <Link href={`/tenants/${tenant.id}/edit`} className="font-medium text-slate-900 hover:underline">
                      {tenant.fullName}
                    </Link>
                    <p className="text-sm text-slate-500">
                      {tenant.property ? tenant.property.name : "ללא נכס"} · מסתיים {formatDate(tenant.contractEnd)}
                    </p>
                  </div>
                  <Badge tone={days <= 14 ? "red" : "amber"}>{days === 0 ? "היום" : `בעוד ${days} ימים`}</Badge>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="mt-8">
        <SectionTitle
          action={
            <Link href="/expenses" className="text-sm text-blue-700 hover:underline">
              לכל ההוצאות
            </Link>
          }
        >
          הוצאות אחרונות
        </SectionTitle>
        {recentExpenses.length === 0 ? (
          <EmptyState title="עדיין לא נרשמו הוצאות" />
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {recentExpenses.map((expense) => (
              <li key={expense.id} className="flex items-center justify-between gap-3 p-3 sm:p-4">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{expense.title}</p>
                  <p className="text-sm text-slate-500">
                    {expense.property.name} · {labelOf(EXPENSE_CATEGORIES, expense.category)} · {formatDate(expense.date)}
                  </p>
                </div>
                <span className="shrink-0 font-semibold tabular-nums text-slate-900">{formatCurrency(expense.amount)}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

function StatCard({ label, value, href, accent }: { label: string; value: string | number; href: string; accent?: string }) {
  return (
    <Link href={href} className="block">
      <Card className="h-full transition-shadow hover:shadow-md">
        <p className="text-sm text-slate-500">{label}</p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{value}</p>
        {accent && <p className="mt-1 text-xs font-medium text-red-600">{accent}</p>}
      </Card>
    </Link>
  );
}
