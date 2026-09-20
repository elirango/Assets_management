import Link from "next/link";
import { ChargeList } from "@/components/charge-list";
import { ReminderList } from "@/components/reminder-list";
import { Badge, Card, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { addDays, daysBetween, formatCurrency, formatDate, todayUtc } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const UPCOMING_REMINDERS = 3;
const CONTRACT_HORIZON_DAYS = 60;

export default async function DashboardPage() {
  const today = todayUtc();
  const contractHorizon = addDays(today, CONTRACT_HORIZON_DAYS);

  const [propertyCount, tenantCount, upcomingReminders, overdueCount, expiringContracts, openCharges] =
    await Promise.all([
      prisma.property.count(),
      prisma.tenant.count(),
      // Section 1: the next reminders from today on (open ones only).
      prisma.reminder.findMany({
        where: { done: false, dueDate: { gte: today } },
        orderBy: { dueDate: "asc" },
        take: UPCOMING_REMINDERS,
        include: { property: { select: { id: true, name: true } }, tenant: { select: { id: true, fullName: true } } },
      }),
      // Overdue reminders are not in the "next 3" list, so surface their count separately.
      prisma.reminder.count({ where: { done: false, dueDate: { lt: today } } }),
      // Section 2: contracts ending within the horizon.
      prisma.tenant.findMany({
        where: { contractEnd: { gte: today, lte: contractHorizon } },
        orderBy: { contractEnd: "asc" },
        select: { id: true, fullName: true, contractEnd: true, property: { select: { id: true, name: true } } },
      }),
      // Section 3: every unpaid charge, oldest debt first.
      prisma.charge.findMany({
        where: { isPaid: false },
        orderBy: { date: "asc" },
        include: { tenant: { select: { id: true, fullName: true, property: { select: { id: true, name: true } } } } },
      }),
    ]);

  const openDebt = openCharges.reduce((sum, charge) => sum + charge.amount, 0);

  return (
    <>
      <PageHeader title="לוח בקרה" description={`היום ${formatDate(today)}`} />

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="נכסים" value={propertyCount} href="/properties" />
        <StatCard label="דיירים" value={tenantCount} href="/tenants" />
        <StatCard
          label="חובות פתוחים"
          value={formatCurrency(openDebt)}
          href="#open-charges"
          accent={openCharges.length > 0 ? `${openCharges.length} חיובים` : undefined}
        />
        <StatCard
          label="תזכורות באיחור"
          value={overdueCount}
          href="/reminders"
          accent={overdueCount > 0 ? "לטיפול" : undefined}
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

      {/* Section 1 */}
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
        {overdueCount > 0 && (
          <p className="mb-3 text-sm text-red-700">
            <Link href="/reminders" className="hover:underline">
              {overdueCount === 1 ? "תזכורת אחת באיחור" : `${overdueCount} תזכורות באיחור`} — לצפייה ברשימה המלאה
            </Link>
          </p>
        )}
        {upcomingReminders.length === 0 ? (
          <EmptyState
            title="אין תזכורות קרובות"
            description="הוסיפו תזכורת להפקדת צ׳ק, סיום חוזה או קריאת מונה."
            action={<LinkButton href="/reminders/new">הוספת תזכורת</LinkButton>}
          />
        ) : (
          <ReminderList reminders={upcomingReminders} />
        )}
      </section>

      {/* Section 2 */}
      <section className="mt-8">
        <SectionTitle>חוזים לקראת סיום</SectionTitle>
        {expiringContracts.length === 0 ? (
          <EmptyState title={`אין חוזים שמסתיימים ב-${CONTRACT_HORIZON_DAYS} הימים הקרובים`} />
        ) : (
          <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
            {expiringContracts.map((tenant) => {
              const days = daysBetween(today, tenant.contractEnd!);
              return (
                <li key={tenant.id} className="flex items-center justify-between gap-3 p-3 sm:p-4">
                  <div className="min-w-0">
                    <Link href={`/tenants/${tenant.id}`} className="font-medium text-slate-900 hover:underline">
                      {tenant.fullName}
                    </Link>
                    <p className="text-sm text-slate-500">
                      {tenant.property ? tenant.property.name : "ללא נכס"} · מסתיים {formatDate(tenant.contractEnd)}
                    </p>
                  </div>
                  <Badge tone={days <= 14 ? "red" : "amber"}>
                    {days === 0 ? "היום" : days === 1 ? "מחר" : `בעוד ${days} ימים`}
                  </Badge>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Section 3 */}
      <section id="open-charges" className="mt-8 scroll-mt-20">
        <SectionTitle>
          חובות פתוחים ({openCharges.length})
          {openCharges.length > 0 && (
            <span className="ms-2 text-base font-semibold text-red-700 tabular-nums">{formatCurrency(openDebt)}</span>
          )}
        </SectionTitle>
        {openCharges.length === 0 ? (
          <EmptyState title="אין חובות פתוחים" description="חיובי ארנונה, ועד בית ומונים שטרם שולמו יופיעו כאן." />
        ) : (
          <ChargeList charges={openCharges} showTenant />
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
