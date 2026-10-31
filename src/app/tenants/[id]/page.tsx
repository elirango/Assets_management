import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { PaymentMessagePanel } from "@/components/payment-message-panel";
import { ManualChargeForm } from "@/components/forms/ManualChargeForm";
import { type LastReadings, MeterCalculatorForm } from "@/components/forms/MeterCalculatorForm";
import { Badge, Card, DetailRow, LinkButton, PageHeader, SectionTitle, cx, recordLink } from "@/components/ui";
import { createManualCharge, createMeterReading } from "@/lib/actions/meters";
import { METER_TYPES, METER_UNITS, type MeterType, isKeyOf, labelOf } from "@/lib/constants";
import { formatCurrency, formatDate, toDateInputValue, todayUtc } from "@/lib/format";
import { attachMeterReadings } from "@/lib/messageGenerator";
import { isAdmin } from "@/lib/authz";
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
  const canEdit = await isAdmin();

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
      <nav aria-label="ניווט משני" className="mb-2 text-sm">
        <Link href="/tenants" className={recordLink}>
          כל הדיירים
        </Link>
      </nav>
      <PageHeader
        title={tenant.fullName}
        description={
          tenant.property ? (
            <Link href={`/properties/${tenant.property.id}`} className={recordLink}>
              {tenant.property.name}
            </Link>
          ) : (
            "ללא נכס"
          )
        }
        action={
          canEdit ? (
            <LinkButton href={`/tenants/${tenant.id}/edit`} variant="secondary">
              עריכת פרטים
            </LinkButton>
          ) : undefined
        }
      />

      <div className="grid gap-10 lg:grid-cols-3 lg:gap-8">
        <div className="space-y-12 lg:col-span-2">
          {/* The tenant's statement leads: what is owed, and the payment message built from it. */}
          <section>
            <SectionTitle
              action={
                tenant.charges.length > 0 ? (
                  <p className="fig text-2xl font-medium text-ink">{formatCurrency(unpaidTotal)}</p>
                ) : undefined
              }
            >
              חיובים פתוחים ({tenant.charges.length})
            </SectionTitle>
            <PaymentMessagePanel
              charges={messageCharges}
              tenantName={tenant.fullName}
              tenantPhone={tenant.phone}
              propertyName={tenant.property?.name ?? null}
              readOnly={!canEdit}
            />
          </section>

          {canEdit && (
            <div className="grid gap-12 2xl:grid-cols-2 2xl:items-start 2xl:gap-8">
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
                <SectionTitle>הוספת חיוב (ארנונה / ועד בית)</SectionTitle>
                <Card>
                  <ManualChargeForm
                    action={createManualCharge.bind(null, tenant.id)}
                    today={toDateInputValue(todayUtc())}
                  />
                </Card>
              </section>
            </div>
          )}

          {recentReadings.length > 0 && (
            <section>
              <SectionTitle>קריאות מונה אחרונות</SectionTitle>
              <ul className="stock divide-y divide-rule overflow-hidden">
                {recentReadings.map((reading) => {
                  const type = isKeyOf(METER_TYPES, reading.type) ? (reading.type as MeterType) : null;
                  const unit = type ? METER_UNITS[type] : "";
                  return (
                    <li key={reading.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 sm:px-5">
                      <Badge tone="blue">{labelOf(METER_TYPES, reading.type)}</Badge>
                      <div className="flex min-w-0 flex-1 flex-wrap gap-x-4 text-sm text-muted">
                        <span dir="ltr" className="fig text-ink-2">
                          {reading.previous} → {reading.current} {unit}
                        </span>
                        <span className="fig">{formatDate(reading.date)}</span>
                      </div>
                      <span className="fig shrink-0 text-base font-medium text-ink">
                        {formatCurrency(reading.totalAmount)}
                      </span>
                    </li>
                  );
                })}
              </ul>
            </section>
          )}
        </div>

        <aside className="lg:sticky lg:top-10 lg:self-start">
          <Card>
            <h2 className="mb-2 text-section text-ink">פרטי הדייר</h2>
            <dl className="divide-y divide-rule">
              <DetailRow
                label="טלפון"
                value={
                  tenant.phone ? (
                    <a href={`tel:${tenant.phone}`} dir="ltr" className={cx(recordLink, "fig")}>
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
              {tenant.contractUrl && (
                <DetailRow
                  label="חוזה"
                  value={
                    <a
                      href={tenant.contractUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={cx(recordLink, "inline-flex items-center gap-1 underline")}
                    >
                      צפה בחוזה
                      <svg
                        className="size-4"
                        viewBox="0 0 20 20"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        aria-hidden
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M11 3h6v6M17 3l-8 8M15 11v5a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"
                        />
                      </svg>
                    </a>
                  }
                />
              )}
            </dl>
            {tenant.notes && (
              <p className="mt-3 whitespace-pre-wrap border-t border-rule pt-3 text-sm text-ink-2">{tenant.notes}</p>
            )}
          </Card>
        </aside>
      </div>
    </>
  );
}
