"use client";

import { useActionState, useState } from "react";
import { PendingButton } from "@/components/forms/form-actions";
import { Field, FormError, Input, cx } from "@/components/ui";
import { MAX_CHARGE_MONTHS, calculateManualCharge, isValidMonths, manualChargeDescription } from "@/lib/charges";
import {
  MANUAL_CHARGE_DEFAULT_RATE,
  MANUAL_CHARGE_TYPES,
  type ManualChargeType,
  toOptions,
} from "@/lib/constants";
import type { ActionState } from "@/lib/form";
import { formatCurrency } from "@/lib/format";

const chargeTypeOptions = toOptions(MANUAL_CHARGE_TYPES) as { value: ManualChargeType; label: string }[];

function defaultRateFor(type: ManualChargeType): string {
  const rate = MANUAL_CHARGE_DEFAULT_RATE[type];
  return rate == null ? "" : String(rate);
}

function toNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function ManualChargeForm({
  action,
  today,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  /** YYYY-MM-DD, computed on the server so client and server agree on "today". */
  today: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const v = state.values ?? {};

  const [type, setType] = useState<ManualChargeType>((v.type as ManualChargeType) ?? "HOA");
  const [months, setMonths] = useState(v.months ?? "1");
  const [rate, setRate] = useState(v.rate ?? defaultRateFor(type));

  function selectType(next: ManualChargeType) {
    // Swap in the new type's default rate unless the user has typed their own value.
    if (rate === "" || rate === defaultRateFor(type)) setRate(defaultRateFor(next));
    setType(next);
  }

  const monthsNum = toNumber(months);
  const rateNum = toNumber(rate);
  const monthsValid = monthsNum != null && isValidMonths(monthsNum);
  const rateValid = rateNum != null && rateNum > 0;
  const total = monthsValid && rateValid ? calculateManualCharge(monthsNum, rateNum) : null;
  const description = monthsValid ? manualChargeDescription(type, monthsNum) : null;

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />

      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium text-slate-700">סוג חיוב</legend>
        <div className="grid grid-cols-2 gap-1 rounded-lg bg-slate-100 p-1" role="radiogroup">
          {chargeTypeOptions.map((option) => {
            const active = option.value === type;
            return (
              <label
                key={option.value}
                className={cx(
                  "flex min-h-10 cursor-pointer items-center justify-center rounded-md text-sm font-medium transition-colors",
                  active ? "bg-white text-blue-700 shadow-sm" : "text-slate-600 hover:text-slate-900",
                )}
              >
                <input
                  type="radio"
                  name="type"
                  value={option.value}
                  checked={active}
                  onChange={() => selectType(option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <Field label="מספר חודשים" required>
          <Input
            name="months"
            type="number"
            inputMode="numeric"
            min={1}
            max={MAX_CHARGE_MONTHS}
            step="1"
            required
            value={months}
            onChange={(event) => setMonths(event.target.value)}
            aria-invalid={(months !== "" && !monthsValid) || undefined}
            dir="ltr"
            className={cx("text-end", months !== "" && !monthsValid && "border-red-400")}
          />
        </Field>
        <Field label="תעריף חודשי (₪)" required hint={type === "HOA" ? "ברירת מחדל: 40 ₪ לחודש" : undefined}>
          <Input
            name="rate"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            required
            value={rate}
            onChange={(event) => setRate(event.target.value)}
            dir="ltr"
            className="text-end"
          />
        </Field>
      </div>

      <Field label="תאריך החיוב" required>
        <Input name="date" type="date" required defaultValue={v.date ?? today} className="sm:max-w-56" />
      </Field>

      {/* Sent so the saved description matches what the user saw; the server regenerates it if empty. */}
      <input type="hidden" name="description" value={description ?? ""} />

      <div
        role="status"
        aria-live="polite"
        className={cx(
          "rounded-lg border px-4 py-3 text-sm",
          total != null ? "border-blue-100 bg-blue-50 text-blue-900" : "border-slate-200 bg-slate-50 text-slate-500",
        )}
      >
        {total != null && description ? (
          <dl className="space-y-1">
            <div className="flex justify-between gap-3">
              <dt>תיאור</dt>
              <dd className="text-end font-medium">{description}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>חישוב</dt>
              <dd className="tabular-nums" dir="ltr">
                {monthsNum} × {formatCurrency(rateNum!)}
              </dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-blue-200 pt-1 text-base font-semibold">
              <dt>סה״כ לחיוב</dt>
              <dd className="tabular-nums">{formatCurrency(total)}</dd>
            </div>
          </dl>
        ) : (
          "מלאו מספר חודשים ותעריף חודשי כדי לראות את סכום החיוב."
        )}
      </div>

      <PendingButton className="w-full sm:w-auto sm:min-w-40">הוספת חיוב</PendingButton>
    </form>
  );
}
