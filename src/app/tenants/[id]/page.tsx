import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentMessagePanel } from "@/components/payment-message-panel";
import { ManualChargeForm } from "@/components/forms/ManualChargeForm";
import { type LastReadings, MeterCalculatorForm } from "@/components/forms/MeterCalculatorForm";
import { Badge, Card, DetailRow, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { createManualCharge, createMeterReading } from "@/lib/actions/meters";
import { METER_TYPES, METER_UNITS, type MeterType, isKeyOf, labelOf } from "@/lib/constants";
import { formatCurrency, formatDate, toDateInputValue, todayUtc } from "@/lib/format";
import { attachMeterReadings } from "@/lib/messageGenerator";

import { prisma } from "@/lib/prisma";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    select: { fullName: true },
  });
  return { title: tenant?.fullName ?? "דייר" };
}

export default async function TenantPage({ params }: Props) {
  const { id } = await params;
  const tenant = await prisma.tenant.findUnique({
    where: { id },
    include: {
      property: { select: { id: true, name: true } },
      charges: { where: { isPaid: false }, orderBy: { date: "desc" } },
      meterReadings: { orderBy: [{ date: "desc" }, { createdAt: "desc" }] },
    },
  });
  if (!tenant) notFound();

  const unpaidTotal = tenant.charges.reduce((sum, charge) => sum + charge.amount, 0);
  // Pair meter charges with their readings so the payment message can quote the meter values.
  const messageCharges = attachMeterReadings(tenant.charges, tenant.meterReadings);
  const recentReadings = tenant.meterReadings.slice(0, 6);

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

          <div className="grid gap-6 xl:grid-cols-2 xl:items-start">
            <section>
              <SectionTitle>הוספת חיוב (ארנונה / ועד בית)</SectionTitle>
              <Card>
                <ManualChargeForm
                  action={createManualCharge.bind(null, tenant.id)}
                  today={toDateInputValue(todayUtc())}
                />
              </Card>
            </section>

            <section>
              <SectionTitle>
                חיובים פתוחים ({tenant.charges.length})
                {tenant.charges.length > 0 && (
                  <span className="ms-2 text-base font-semibold text-red-700 tabular-nums">
                    {formatCurrency(unpaidTotal)}
                  </span>
                )}
              </SectionTitle>
              <PaymentMessagePanel
                charges={messageCharges}
                tenantName={tenant.fullName}
                tenantPhone={tenant.phone}
                propertyName={tenant.property?.name ?? null}
              />
            </section>
          </div>

          {recentReadings.length > 0 && (
            <section>
              <SectionTitle>קריאות מונה אחרונות</SectionTitle>
              <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
                {recentReadings.map((reading) => {
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
                      <span className="shrink-0 font-semibold tabular-nums text-slate-900">
                        {formatCurrency(reading.totalAmount)}
                      </span>
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
              <DetailRow
                label="שכר דירה"
                value={tenant.monthlyRent != null ? `${formatCurrency(tenant.monthlyRent)} / חודש` : "—"}
              />
              <DetailRow label="יום תשלום" value={`${tenant.paymentDay} בחודש`} />
              <DetailRow label="תחילת חוזה" value={formatDate(tenant.contractStart)} />
              <DetailRow label="סיום חוזה" value={formatDate(tenant.contractEnd)} />
            </dl>
            {tenant.notes && (
              <p className="mt-3 whitespace-pre-wrap border-t border-slate-100 pt-3 text-sm text-slate-600">
                {tenant.notes}
              </p>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
