"use client";

import Link from "next/link";
import { DeleteButton, PendingButton } from "@/components/forms/form-actions";
import { cx, recordLink } from "@/components/ui";
import { deleteCharge, toggleChargePaid } from "@/lib/actions/meters";
import { formatBillingPeriod, splitBillingPeriod } from "@/lib/billingPeriod";
import { formatCurrency, formatDate } from "@/lib/format";

export type ChargeListItem = {
  id: string;
  description: string;
  amount: number;
  date: Date;
  tenant?: { id: string; fullName: string; property: { id: string; name: string } | null } | null;
};

/**
 * Unpaid charges with "mark as paid" / delete quick actions. Both server actions revalidate
 * the dashboard and the tenant page, so the list refreshes in place.
 * Pass `selectedIds` + `onToggle` to render a checkbox per row (tenant page message generator).
 * `readOnly` (viewer role) hides the mark-paid / delete actions.
 */
export function ChargeList({
  charges,
  showTenant = false,
  selectedIds,
  onToggle,
  readOnly = false,
}: {
  charges: ChargeListItem[];
  showTenant?: boolean;
  selectedIds?: ReadonlySet<string>;
  onToggle?: (id: string) => void;
  readOnly?: boolean;
}) {
  const selectable = selectedIds != null && onToggle != null;

  return (
    // A ruled ledger on one cotton sheet. The list lives in columns of very different widths
    // (dashboard vs. tenant page split), so rows respond to the list's own width (container query).
    <ul className="stock @container divide-y divide-rule overflow-hidden">
      {charges.map((charge) => {
        const selected = selectedIds?.has(charge.id) ?? false;
        const { title, months } = splitBillingPeriod(charge.description);
        return (
          // Narrow container: the action buttons wrap onto their own line so the description keeps the
          // full width. Wide container (≥ 32rem): everything sits on one line. No fixed heights; rows
          // grow with their content.
          <li
            key={charge.id}
            className={cx(
              "flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 transition-colors duration-(--dur-micro) @lg:flex-nowrap @lg:px-5",
              selected && "bg-paper-2",
            )}
          >
            {selectable && (
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggle(charge.id)}
                aria-label={`בחירת החיוב ${charge.description}`}
                className="size-5 shrink-0 cursor-pointer accent-brand"
              />
            )}
            <div className="min-w-0 flex-1 basis-40">
              <p className="break-words font-medium leading-normal text-ink">
                {months ? title : charge.description}
                {months && <BillingPeriodBadge period={formatBillingPeriod(months)} />}
              </p>
              <p className="flex flex-wrap gap-x-3 text-sm leading-normal text-muted">
                <span>{formatDate(charge.date)}</span>
                {showTenant && charge.tenant && (
                  <Link href={`/tenants/${charge.tenant.id}`} className={recordLink}>
                    {charge.tenant.fullName}
                  </Link>
                )}
                {showTenant && charge.tenant?.property && <span>{charge.tenant.property.name}</span>}
              </p>
            </div>
            <span className="fig shrink-0 text-base font-medium leading-normal text-ink">
              {formatCurrency(charge.amount)}
            </span>
            {!readOnly && (
              <div
                className={cx(
                  "flex w-full items-center gap-2 @lg:w-auto @lg:shrink-0",
                  // Align the buttons under the text, past the checkbox column, when wrapped.
                  selectable && "ps-9 @lg:ps-0",
                )}
              >
                <form action={toggleChargePaid}>
                  <input type="hidden" name="id" value={charge.id} />
                  <PendingButton variant="secondary" className="min-h-9! px-3 text-sm">
                    סמן כשולם
                  </PendingButton>
                </form>
                <DeleteButton id={charge.id} action={deleteCharge} confirmMessage="למחוק את החיוב?" variant="ghost" />
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}

/** Months a charge covers, shown next to its title. */
function BillingPeriodBadge({ period }: { period: string }) {
  return (
    <span className="ms-2 inline-block rounded-input bg-paper-2 px-2 py-0.5 align-middle text-xs font-medium text-ink-2">
      {period}
    </span>
  );
}
