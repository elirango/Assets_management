import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { DeleteButton, PendingButton } from "@/components/forms/form-actions";
import { type LastReadings, MeterCalculatorForm } from "@/components/forms/MeterCalculatorForm";
import { Badge, Card, DetailRow, EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { createMeterReading, deleteCharge, toggleChargePaid } from "@/lib/actions/meters";
import { METER_TYPES, METER_UNITS, type MeterType, isKeyOf, labelOf } from "@/lib/constants";
import { formatCurrency, formatDate, toDateInputValue, todayUtc } from "@/lib/format";

import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({ where: { id }, select: { fullName: true } });
  return { title: tenant?.fullName ?? "דייר" };
}

export default async function TenantPage({ params }: Props) {
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      property: { select: { id: true, name: true } },
      charges: { where: { isPaid: false }, orderBy: { date: "desc" } },
      meterReadings: { orderBy: { date: "desc" }, take: 6 },
    },
  });
  if (!tenant) notFound();

  const unpaidTotal = tenant.charges.reduce((sum, charge) => sum + charge.amount, 0);

  // Newest `current` per meter type seeds the calculator's "previous" field.
  const lastReadings: LastReadings = {};
  for (const reading of tenant.meterReadings) {
    if (isKeyOf(METER_TYPES, reading.type) && lastReadings[reading.type] == null) {
      lastReadings[reading.type] = reading.current;
    }
  }

  return (
    <>
      <Link href="/tenants" className="mb-3 inline-block text-sm text-slate-500 hover:text-slate-800">
        → כל הדיירים
      </Link>
      <PageHeader
        title={tenant.fullName}
        description={
          tenant.property ? (
            <Link href={`/properties/${tenant.property.id}`} className="hover:underline">
              {tenant.property.name}
            </Link>
          ) : (
            "ללא נכס"
          )
        }
        action={
          <LinkButton href={`/tenants/${tenant.id}/edit`} variant="secondary">
            עריכת פרטים
          </LinkButton>
        }
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section>
            <SectionTitle>מחשבון מונה (חשמל / מים)</SectionTitle>
            <Card>
              <MeterCalculatorForm
                action={createMeterReading.bind(null, tenant.id)}
                lastReadings={lastReadings}
                today={toDateInputValue(todayUtc())}
              />
            </Card>
          </section>

          <section>
            <SectionTitle>
              חיובים פתוחים ({tenant.charges.length})
              {tenant.charges.length > 0 && (
                <span className="ms-2 text-base font-semibold text-red-700 tabular-nums">{formatCurrency(unpaidTotal)}</span>
              )}
            </SectionTitle>
            {tenant.charges.length === 0 ? (
              <EmptyState title="אין חיובים פתוחים" description="חיובים שנוצרו במחשבון המונה יופיעו כאן עד שיסומנו כשולמו." />
            ) : (
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {tenant.charges.map((charge) => (
                  <li key={charge.id} className="flex items-center gap-3 p-3 sm:p-4">
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-slate-900">{charge.description}</p>
                      <p className="text-sm text-slate-500">{formatDate(charge.date)}</p>
                    </div>
                    <span className="shrink-0 font-semibold tabular-nums text-slate-900">{formatCurrency(charge.amount)}</span>
                    <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                      <form action={toggleChargePaid}>
                        <input type="hidden" name="id" value={charge.id} />
                        <PendingButton variant="secondary" className="min-h-9 px-3 text-sm">
                          סמן כשולם
                        </PendingButton>
                      </form>
                      <DeleteButton id={charge.id} action={deleteCharge} confirmMessage="למחוק את החיוב?" variant="ghost" />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {tenant.meterReadings.length > 0 && (
            <section>
              <SectionTitle>קריאות מונה אחרונות</SectionTitle>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {tenant.meterReadings.map((reading) => {
                  const type = isKeyOf(METER_TYPES, reading.type) ? (reading.type as MeterType) : null;
                  const unit = type ? METER_UNITS[type] : "";
                  return (
                    <li key={reading.id} className="flex items-center gap-3 p-3 sm:p-4">
                      <Badge tone={type === "WATER" ? "blue" : "amber"}>{labelOf(METER_TYPES, reading.type)}</Badge>
                      <div className="min-w-0 flex-1 text-sm text-slate-600">
                        <span dir="ltr" className="tabular-nums">
                          {reading.previous} → {reading.current} {unit}
                        </span>
                        {" · "}
                        {formatDate(reading.date)}
                      </div>
                      <span className="shrink-0 font-semibold tabular-nums text-slate-900">{formatCurrency(reading.totalAmount)}</span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <aside>
          <Card>
            <h2 className="mb-2 font-semibold text-slate-800">פרטי הדייר</h2>
            <dl className="divide-y divide-slate-100">
              <DetailRow
                label="טלפון"
                value={
                  tenant.phone ? (
                    <a href={`tel:${tenant.phone}`} dir="ltr" className="hover:underline">
                      {tenant.phone}
                    </a>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailRow label="אימייל" value={tenant.email ? <span dir="ltr">{tenant.email}</span> : "—"} />
              <DetailRow label="שכר דירה" value={tenant.monthlyRent != null ? `${formatCurrency(tenant.monthlyRent)} / חודש` : "—"} />
              <DetailRow label="יום תשלום" value={`${tenant.paymentDay} בחודש`} />
              <DetailRow label="תחילת חוזה" value={formatDate(tenant.contractStart)} />
              <DetailRow label="סיום חוזה" value={formatDate(tenant.contractEnd)} />
            </dl>
            {tenant.notes && (
              <p className="mt-3 whitespace-pre-wrap border-t border-slate-100 pt-3 text-sm text-slate-600">{tenant.notes}</p>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
