"use client";

import Link from "next/link";
import { DeleteButton, PendingButton } from "@/components/forms/form-actions";
import { cx } from "@/components/ui";
import { deleteCharge, toggleChargePaid } from "@/lib/actions/meters";
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
    // The list lives in columns of very different widths (dashboard vs. tenant page split), so rows
    // respond to the list's own width (container query) rather than the viewport.
    <ul className="@container divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {charges.map((charge) => {
        const selected = selectedIds?.has(charge.id) ?? false;
        return (
          // Narrow container: the action buttons wrap onto their own line so the description keeps the
          // full width. Wide container (≥ 32rem): everything sits on one line. No fixed heights — rows
          // grow with their content.
          <li
            key={charge.id}
            className={cx(
              "flex flex-wrap items-center gap-x-3 gap-y-2 p-3 @lg:flex-nowrap @lg:p-4",
              selected && "bg-blue-50/60",
            )}
          >
            {selectable && (
              <input
                type="checkbox"
                checked={selected}
                onChange={() => onToggle(charge.id)}
                aria-label={`בחירת החיוב ${charge.description}`}
                className="size-5 shrink-0 cursor-pointer rounded border-slate-300 accent-blue-600"
              />
            )}
            <div className="min-w-0 flex-1 basis-40">
              <p className="break-words font-medium leading-normal text-slate-900">{charge.description}</p>
              <p className="text-sm leading-normal text-slate-500">
                {formatDate(charge.date)}
                {showTenant && charge.tenant && (
                  <>
                    {" · "}
                    <Link href={`/tenants/${charge.tenant.id}`} className="hover:underline">
                      {charge.tenant.fullName}
                    </Link>
                    {charge.tenant.property && ` · ${charge.tenant.property.name}`}
                  </>
                )}
              </p>
            </div>
            <span className="shrink-0 font-semibold leading-normal tabular-nums text-slate-900">
              {formatCurrency(charge.amount)}
            </span>
            {!readOnly && (
              <div
                className={cx(
                  "flex w-full items-center gap-2 @lg:w-auto @lg:shrink-0",
                  // Align the buttons under the text, past the checkbox column, when wrapped.
                  selectable && "ps-8 @lg:ps-0",
                )}
              >
                <form action={toggleChargePaid}>
                  <input type="hidden" name="id" value={charge.id} />
                  <PendingButton variant="secondary" className="min-h-9 px-3 text-sm">
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
