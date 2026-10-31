import Link from "next/link";
import { ChargeList } from "@/components/charge-list";
import { ReminderList } from "@/components/reminder-list";
import { Badge, EmptyState, LinkButton, PageHeader, SectionTitle, cx, recordLink } from "@/components/ui";
import { addDays, daysBetween, formatCurrency, formatDate, todayUtc } from "@/lib/format";
import { isAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

const UPCOMING_REMINDERS = 3;
const CONTRACT_HORIZON_DAYS = 60;

export default async function DashboardPage() {
  const canEdit = await isAdmin();
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
      <PageHeader
        title="לוח בקרה"
        description={`היום ${formatDate(today)}`}
        action={
          canEdit ? (
            <div className="flex flex-wrap gap-2">
              <LinkButton href="/expenses/new" variant="secondary" className="px-3">
                + הוצאה
              </LinkButton>
              <LinkButton href="/reminders/new" variant="secondary" className="px-3">
                + תזכורת
              </LinkButton>
              <LinkButton href="/tenants/new" variant="secondary" className="px-3">
                + דייר
              </LinkButton>
              <LinkButton href="/properties/new" variant="secondary" className="px-3">
                + נכס
              </LinkButton>
            </div>
          ) : undefined
        }
      />

      {/* Four mint tiles, each linking to where its figure comes from; a tile that needs attention turns coral. */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCell label="נכסים" value={propertyCount} href="/properties" />
        <StatCell label="דיירים" value={tenantCount} href="/tenants" />
        <StatCell
          label="חובות פתוחים"
          value={formatCurrency(openDebt)}
          href="#open-charges"
          accent={openCharges.length > 0 ? `${openCharges.length} חיובים` : undefined}
        />
        <StatCell
          label="תזכורות באיחור"
          value={overdueCount}
          href="/reminders"
          accent={overdueCount > 0 ? "לטיפול" : undefined}
        />
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-5 lg:gap-8">
        {/* Section 3, the dashboard's lead: the open-debts ledger. */}
        <section id="open-charges" className="scroll-mt-20 lg:col-span-3">
          <SectionTitle
            action={
              openCharges.length > 0 ? (
                <p className="fig text-2xl font-medium text-ink">{formatCurrency(openDebt)}</p>
              ) : undefined
            }
          >
            חובות פתוחים ({openCharges.length})
          </SectionTitle>
          {openCharges.length === 0 ? (
            <EmptyState title="אין חובות פתוחים" description="חיובי ארנונה, ועד בית ומונים שטרם שולמו יופיעו כאן." />
          ) : (
            <ChargeList charges={openCharges} showTenant readOnly={!canEdit} />
          )}
        </section>

        <div className="space-y-10 lg:col-span-2">
          {/* Section 1 */}
          <section>
            <SectionTitle
              action={
                <Link href="/reminders" className={cx(recordLink, "text-sm")}>
                  לכל התזכורות
                </Link>
              }
            >
              תזכורות קרובות
            </SectionTitle>
            {overdueCount > 0 && (
              <p className="mb-3 text-sm text-accent-2">
                <Link href="/reminders" className="underline-offset-4 hover:underline">
                  {overdueCount === 1 ? "תזכורת אחת באיחור" : `${overdueCount} תזכורות באיחור`}, לצפייה ברשימה המלאה
                </Link>
              </p>
            )}
            {upcomingReminders.length === 0 ? (
              <EmptyState
                title="אין תזכורות קרובות"
                description="הוסיפו תזכורת להפקדת צ׳ק, סיום חוזה או קריאת מונה."
                action={canEdit ? <LinkButton href="/reminders/new">הוספת תזכורת</LinkButton> : undefined}
              />
            ) : (
              <ReminderList reminders={upcomingReminders} readOnly={!canEdit} />
            )}
          </section>

          {/* Section 2 */}
          <section>
            <SectionTitle>חוזים לקראת סיום</SectionTitle>
            {expiringContracts.length === 0 ? (
              <EmptyState title={`אין חוזים שמסתיימים ב-${CONTRACT_HORIZON_DAYS} הימים הקרובים`} />
            ) : (
              <ul className="stock divide-y divide-rule overflow-hidden">
                {expiringContracts.map((tenant) => {
                  const days = daysBetween(today, tenant.contractEnd!);
                  return (
                    <li key={tenant.id} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
                      <div className="min-w-0">
                        <Link href={`/tenants/${tenant.id}`} className="font-medium text-ink underline-offset-4 hover:underline">
                          {tenant.fullName}
                        </Link>
                        <p className="flex flex-wrap gap-x-3 text-sm text-muted">
                          <span>{tenant.property ? tenant.property.name : "ללא נכס"}</span>
                          <span>מסתיים {formatDate(tenant.contractEnd)}</span>
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
        </div>
      </div>
    </>
  );
}

function StatCell({
  label,
  value,
  href,
  accent,
}: {
  label: string;
  value: string | number;
  href: string;
  accent?: string;
}) {
  return (
    <Link
      href={href}
      className={cx(
        "press flex flex-col rounded-card px-4 py-4 sm:px-5 sm:py-5",
        accent ? "bg-coral-bg text-coral-ink hover:bg-coral-bg/80" : "bg-mint text-ink hover:bg-mint/70",
      )}
    >
      <span className={cx("text-sm", accent ? "text-coral-ink" : "text-mint-ink")}>{label}</span>
      <span className="fig mt-1 text-2xl font-medium">{value}</span>
      {accent && <span className="mt-0.5 text-sm">{accent}</span>}
    </Link>
  );
}
