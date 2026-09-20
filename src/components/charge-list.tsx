import Link from "next/link";
import { DeleteButton, PendingButton } from "@/components/forms/form-actions";
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
 */
export function ChargeList({ charges, showTenant = false }: { charges: ChargeListItem[]; showTenant?: boolean }) {
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {charges.map((charge) => (
        <li key={charge.id} className="flex items-center gap-3 p-3 sm:p-4">
          <div className="min-w-0 flex-1">
            <p className="font-medium text-slate-900">{charge.description}</p>
            <p className="text-sm text-slate-500">
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
  );
}
