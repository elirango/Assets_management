"use client";

import { useActionState } from "react";
import { FormActions } from "@/components/forms/form-actions";
import type { PropertyOption } from "@/components/forms/tenant-form";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui";
import { EXPENSE_CATEGORIES, toOptions } from "@/lib/constants";
import type { ActionState } from "@/lib/form";

export type ExpenseFormValues = {
  title: string;
  propertyId: string;
  category: string;
  amount: string;
  date: string;
  vendor: string;
  notes: string;
};

const categoryOptions = toOptions(EXPENSE_CATEGORIES);

export function ExpenseForm({
  action,
  initial,
  properties,
  submitLabel,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: Partial<ExpenseFormValues>;
  properties: PropertyOption[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, {});
  // On a failed submit React resets the form, so re-seed it with what was typed.
  const values = { ...initial, ...state.values };

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />

      <Field label="נכס" required>
        <Select name="propertyId" required defaultValue={values?.propertyId ?? ""}>
          <option value="" disabled>
            בחר נכס...
          </option>
          {properties.map((property) => (
            <option key={property.id} value={property.id}>
              {property.name}
            </option>
          ))}
        </Select>
      </Field>

      <Field label="תיאור" required hint='לדוגמה: "תיקון דוד שמש"'>
        <Input name="title" required maxLength={160} defaultValue={values?.title} autoFocus />
      </Field>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="קטגוריה" required>
          <Select name="category" defaultValue={values?.category ?? "REPAIR"}>
            {categoryOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="סכום (₪)" required>
          <Input name="amount" type="number" inputMode="decimal" min="0" step="0.01" required defaultValue={values?.amount} dir="ltr" className="text-end" />
        </Field>
        <Field label="תאריך" required>
          <Input name="date" type="date" required defaultValue={values?.date} />
        </Field>
      </div>

      <Field label="ספק / בעל מקצוע">
        <Input name="vendor" maxLength={120} defaultValue={values?.vendor} />
      </Field>

      <Field label="הערות">
        <Textarea name="notes" maxLength={2000} defaultValue={values?.notes} />
      </Field>

      <FormActions submitLabel={submitLabel} cancelHref={cancelHref} />
    </form>
  );
}
