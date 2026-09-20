"use client";

import { useActionState, useState } from "react";
import { FormActions } from "@/components/forms/form-actions";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui";
import {
  DEFAULT_CONTRACT_MONTHS,
  DEFAULT_PAYMENT_DAY,
  MAX_CONTRACT_MONTHS,
  MAX_PAYMENT_DAY,
  MIN_CONTRACT_MONTHS,
  MIN_PAYMENT_DAY,
  RENEWAL_LEAD_DAYS,
  contractEndFromStart,
  contractMonthsBetween,
  isValidContractMonths,
  isValidPaymentDay,
  monthlyDueDates,
  parseIsoDate,
  renewalReminderDate,
} from "@/lib/contract";
import type { ActionState } from "@/lib/form";
import { formatDate } from "@/lib/format";

export type TenantFormValues = {
  fullName: string;
  phone: string;
  email: string;
  idNumber: string;
  monthlyRent: string;
  paymentDay: string;
  contractStart: string;
  contractEnd: string;
  contractMonths: string;
  propertyId: string;
  notes: string;
};

export type PropertyOption = { id: string; name: string };

export function TenantForm({
  action,
  initial,
  properties,
  submitLabel,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: Partial<TenantFormValues>;
  properties: PropertyOption[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, {});
  // On a failed submit React resets the form, so re-seed it with what was typed.
  const values = { ...initial, ...state.values };

  // Contract dates are controlled so the end date can follow start + duration.
  // `endIsAuto` is true while the end date is empty or still equals the derived value;
  // once the user edits the end date by hand we stop overriding it.
  const [contractStart, setContractStart] = useState(values.contractStart ?? "");
  const [contractEnd, setContractEnd] = useState(values.contractEnd ?? "");
  // Duration is not stored: on edit it is recovered from the saved dates, or left blank
  // when the saved end date does not match a whole number of months.
  const [contractMonthsInput, setContractMonthsInput] = useState(() => {
    if (values.contractMonths) return values.contractMonths;
    if (values.contractStart && values.contractEnd) {
      return contractMonthsBetween(values.contractStart, values.contractEnd)?.toString() ?? "";
    }
    return String(DEFAULT_CONTRACT_MONTHS);
  });
  const contractMonths = contractMonthsInput === "" ? null : Number(contractMonthsInput);
  const contractMonthsValid = contractMonths != null && isValidContractMonths(contractMonths);

  function derivedEnd(start: string, months: number | null): string {
    return months != null && isValidContractMonths(months) ? (contractEndFromStart(start, months) ?? "") : "";
  }

  const [endIsAuto, setEndIsAuto] = useState(
    () => !values.contractEnd || values.contractEnd === derivedEnd(values.contractStart ?? "", contractMonths),
  );

  function handleStartChange(next: string) {
    setContractStart(next);
    if (endIsAuto) setContractEnd(derivedEnd(next, contractMonths));
  }

  function handleMonthsChange(next: string) {
    setContractMonthsInput(next);
    const months = next === "" ? null : Number(next);
    if (months != null && isValidContractMonths(months) && contractStart) {
      setContractEnd(derivedEnd(contractStart, months));
      setEndIsAuto(true);
    }
  }

  function handleEndChange(next: string) {
    setContractEnd(next);
    setEndIsAuto(next === "" || next === derivedEnd(contractStart, contractMonths));
    // Keep the duration honest: show the matching month count, or blank for a custom end date.
    if (next && contractStart) setContractMonthsInput(contractMonthsBetween(contractStart, next)?.toString() ?? "");
  }

  const startDate = parseIsoDate(contractStart);
  const endDate = parseIsoDate(contractEnd);

  // Payment day is controlled too so the preview can react to it; empty means "use the default".
  const [paymentDayInput, setPaymentDayInput] = useState(values.paymentDay ?? String(DEFAULT_PAYMENT_DAY));
  const paymentDay = paymentDayInput === "" ? DEFAULT_PAYMENT_DAY : Number(paymentDayInput);
  const paymentDayValid = isValidPaymentDay(paymentDay);
  const chequeCount =
    startDate && endDate && paymentDayValid ? monthlyDueDates(startDate, endDate, paymentDay).length : 0;

  // Editing an existing tenant and moving the contract replaces its open cheque reminders.
  const isEdit = Boolean(initial?.fullName);
  const contractChanged =
    contractStart !== (initial?.contractStart ?? "") ||
    contractEnd !== (initial?.contractEnd ?? "") ||
    String(paymentDay) !== (initial?.paymentDay ?? String(DEFAULT_PAYMENT_DAY));

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />

      <Field label="שם מלא" required>
        <Input name="fullName" required maxLength={120} defaultValue={values?.fullName} autoFocus />
      </Field>

      <Field label="נכס" hint="ניתן להשאיר ריק ולשייך מאוחר יותר">
        <Select name="propertyId" defaultValue={values?.propertyId ?? ""}>
          <option value="">— ללא נכס —</option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </Select>
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="טלפון">
          <Input name="phone" type="tel" inputMode="tel" autoComplete="tel" maxLength={30} defaultValue={values?.phone} dir="ltr" className="text-end" />
        </Field>
        <Field label="אימייל">
          <Input name="email" type="email" inputMode="email" autoComplete="email" maxLength={120} defaultValue={values?.email} dir="ltr" className="text-end" />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="תעודת זהות">
          <Input name="idNumber" inputMode="numeric" maxLength={20} defaultValue={values?.idNumber} dir="ltr" className="text-end" />
        </Field>
        <Field label="שכר דירה חודשי (₪)">
          <Input name="monthlyRent" type="number" inputMode="decimal" min="0" step="1" defaultValue={values?.monthlyRent} dir="ltr" className="text-end" />
        </Field>
      </div>

      <Field
        label="יום תשלום בחודש"
        required
        hint={
          paymentDay > 28
            ? "בחודשים קצרים יותר התזכורת תיקבע ליום האחרון בחודש (למשל 28 בפברואר)."
            : `היום בחודש שבו מופקד צ'ק השכירות (${MIN_PAYMENT_DAY}–${MAX_PAYMENT_DAY}).`
        }
      >
        <Input
          name="paymentDay"
          type="number"
          inputMode="numeric"
          min={MIN_PAYMENT_DAY}
          max={MAX_PAYMENT_DAY}
          step="1"
          required
          value={paymentDayInput}
          onChange={(event) => setPaymentDayInput(event.target.value)}
          aria-invalid={!paymentDayValid || undefined}
          dir="ltr"
          className={`text-end sm:max-w-40 ${paymentDayValid ? "" : "border-red-400 focus:border-red-500 focus:ring-red-500/20"}`}
        />
      </Field>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
        <Field label="תחילת חוזה">
          <Input
            name="contractStart"
            type="date"
            value={contractStart}
            onChange={(event) => handleStartChange(event.target.value)}
          />
        </Field>
        <Field label="משך חוזה (חודשים)" hint={contractMonthsInput === "" ? "תאריך סיום מותאם אישית" : undefined}>
          <Input
            name="contractMonths"
            type="number"
            inputMode="numeric"
            min={MIN_CONTRACT_MONTHS}
            max={MAX_CONTRACT_MONTHS}
            step="1"
            value={contractMonthsInput}
            onChange={(event) => handleMonthsChange(event.target.value)}
            aria-invalid={(contractMonthsInput !== "" && !contractMonthsValid) || undefined}
            dir="ltr"
            className={`text-end ${contractMonthsInput !== "" && !contractMonthsValid ? "border-red-400 focus:border-red-500 focus:ring-red-500/20" : ""}`}
          />
        </Field>
        <Field
          label="סיום חוזה"
          hint={
            endIsAuto && contractEnd && contractMonthsValid
              ? `חושב אוטומטית: תחילת חוזה + ${contractMonths} חודשים פחות יום. ניתן לשנות ידנית.`
              : undefined
          }
        >
          <Input
            name="contractEnd"
            type="date"
            min={contractStart || undefined}
            value={contractEnd}
            onChange={(event) => handleEndChange(event.target.value)}
          />
        </Field>
      </div>

      {startDate && (!isEdit || contractChanged) && (
        <p role="status" className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
          {!paymentDayValid
            ? `יום התשלום חייב להיות בין ${MIN_PAYMENT_DAY} ל-${MAX_PAYMENT_DAY}.`
            : chequeCount > 0
              ? `בשמירה ייווצרו ${chequeCount} תזכורות להפקדת צ'ק – ב-${paymentDay} לכל חודש לאורך תקופת החוזה.`
              : `לא ייווצרו תזכורות להפקדת צ'ק: ה-${paymentDay} בחודש לא נופל בתוך תקופת החוזה.`}
          {endDate &&
            ` בנוסף תיווצר תזכורת חידוש חוזה ל-${formatDate(renewalReminderDate(endDate))} (${RENEWAL_LEAD_DAYS} ימים לפני הסיום).`}
          {isEdit && " תזכורות פתוחות קיימות (צ'קים וחידוש חוזה) של דייר זה יוחלפו."}
        </p>
      )}

      <Field label="הערות">
        <Textarea name="notes" maxLength={2000} defaultValue={values?.notes} />
      </Field>

      <FormActions submitLabel={submitLabel} cancelHref={cancelHref} />
    </form>
  );
}
