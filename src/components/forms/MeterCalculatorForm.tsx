"use client";

import { useActionState, useState } from "react";
import { PendingButton } from "@/components/forms/form-actions";
import { Field, FormError, Input, cx } from "@/components/ui";
import { METER_TYPES, METER_UNITS, type MeterType, toOptions } from "@/lib/constants";
import type { ActionState } from "@/lib/form";
import { formatCurrency } from "@/lib/format";
import { calculateMeterBill, meterFixedFeeApplies } from "@/lib/meters";

const meterTypeOptions = toOptions(METER_TYPES) as { value: MeterType; label: string }[];

/** Latest `current` reading per meter type, used to pre-fill the previous reading. */
export type LastReadings = Partial<Record<MeterType, number>>;

function toNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function MeterCalculatorForm({
  action,
  lastReadings,
  today,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  lastReadings: LastReadings;
  /** YYYY-MM-DD, computed on the server so client and server agree on "today". */
  today: string;
}) {
  const [state, formAction] = useActionState(action, {});
  const v = state.values ?? {};

  const [type, setType] = useState<MeterType>((v.type as MeterType) ?? "ELECTRICITY");
  const [previous, setPrevious] = useState(v.previous ?? (lastReadings[type]?.toString() ?? ""));
  const [current, setCurrent] = useState(v.current ?? "");
  const [rate, setRate] = useState(v.rate ?? "");
  const [fixedFee, setFixedFee] = useState(v.fixedFee ?? "");

  function selectType(next: MeterType) {
    setType(next);
    // Seed the previous reading from the last saved one of this type, unless the user already typed something.
    if (previous === "" || previous === (lastReadings[type]?.toString() ?? "")) {
      setPrevious(lastReadings[next]?.toString() ?? "");
    }
  }

  const showFixedFee = meterFixedFeeApplies(type);
  const unit = METER_UNITS[type];

  const prevNum = toNumber(previous);
  const currNum = toNumber(current);
  const rateNum = toNumber(rate);
  const feeNum = showFixedFee ? (toNumber(fixedFee) ?? 0) : 0;
  const readingsValid = prevNum != null && currNum != null && currNum >= prevNum;
  const bill =
    readingsValid && rateNum != null
      ? calculateMeterBill({ type, previous: prevNum, current: currNum, rate: rateNum, fixedFee: feeNum })
      : null;

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />

      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium text-ink-2">סוג מונה</legend>
        <div className="groove grid grid-cols-2 gap-1 p-1" role="radiogroup">
          {meterTypeOptions.map((option) => {
            const active = option.value === type;
            return (
              <label
                key={option.value}
                className={cx(
                  "flex min-h-9 cursor-pointer items-center justify-center rounded-input text-sm font-medium transition-colors duration-(--dur-micro) has-focus-visible:outline-2 has-focus-visible:outline-focus",
                  active ? "edge bg-cotton text-ink" : "text-ink-2 hover:bg-paper-3/70 hover:text-ink",
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
        <Field label={`קריאה קודמת (${unit})`} required>
          <Input
            name="previous"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            required
            value={previous}
            onChange={(event) => setPrevious(event.target.value)}
            dir="ltr"
            className="text-end"
          />
        </Field>
        <Field label={`קריאה נוכחית (${unit})`} required>
          <Input
            name="current"
            type="number"
            inputMode="decimal"
            min={prevNum ?? 0}
            step="any"
            required
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            aria-invalid={(prevNum != null && currNum != null && currNum < prevNum) || undefined}
            dir="ltr"
            className="text-end"
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label={`תעריף ל-${unit} (₪)`} required>
          <Input
            name="rate"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.0001"
            required
            value={rate}
            onChange={(event) => setRate(event.target.value)}
            dir="ltr"
            className="text-end"
          />
        </Field>
        {showFixedFee && (
          <Field label="תשלום קבוע (₪)" hint="למשל: תשלום קבוע של חברת החשמל">
            <Input
              name="fixedFee"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={fixedFee}
              onChange={(event) => setFixedFee(event.target.value)}
              dir="ltr"
              className="text-end"
            />
          </Field>
        )}
      </div>

      <Field label="תאריך החיוב" required>
        <Input name="date" type="date" required defaultValue={v.date ?? today} className="sm:max-w-56" />
      </Field>

      <div
        role="status"
        aria-live="polite"
        className={cx(
          "rounded-input border px-4 py-3 text-sm",
          bill ? "border-rule bg-paper text-ink" : "border-dashed border-rule-2 text-muted",
        )}
      >
        {bill ? (
          <dl className="space-y-1">
            <div className="flex justify-between">
              <dt>צריכה</dt>
              <dd className="fig" dir="ltr">
                {bill.units} {unit}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>צריכה × תעריף</dt>
              <dd className="fig">{formatCurrency(bill.usageCost)}</dd>
            </div>
            {showFixedFee && (
              <div className="flex justify-between">
                <dt>תשלום קבוע</dt>
                <dd className="fig">{formatCurrency(bill.fixedFee)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t-2 border-ink/80 pt-2 text-base font-medium">
              <dt>סה״כ לחיוב</dt>
              <dd className="fig">{formatCurrency(bill.total)}</dd>
            </div>
          </dl>
        ) : prevNum != null && currNum != null && currNum < prevNum ? (
          "הקריאה הנוכחית חייבת להיות גדולה או שווה לקריאה הקודמת."
        ) : (
          "מלאו את הקריאות והתעריף כדי לראות את סכום החיוב."
        )}
      </div>

      <PendingButton className="w-full sm:w-auto sm:min-w-40">שמירת קריאה ויצירת חיוב</PendingButton>
    </form>
  );
}
