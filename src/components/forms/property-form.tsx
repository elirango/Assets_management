"use client";

import { useActionState } from "react";
import { FormActions } from "@/components/forms/form-actions";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui";
import { PROPERTY_TYPES, toOptions } from "@/lib/constants";
import type { ActionState } from "@/lib/form";

export type PropertyFormValues = {
  name: string;
  address: string;
  city: string;
  type: string;
  rooms: string;
  sizeSqm: string;
  notes: string;
};

const propertyTypeOptions = toOptions(PROPERTY_TYPES);

export function PropertyForm({
  action,
  initial,
  submitLabel,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: Partial<PropertyFormValues>;
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, {});
  // On a failed submit React resets the form, so re-seed it with what was typed.
  const values = { ...initial, ...state.values };

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />

      <Field label="שם הנכס" required hint='לדוגמה: "דירה ברחוב הרצל"'>
        <Input name="name" required maxLength={120} defaultValue={values?.name} autoFocus />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="כתובת" required>
          <Input name="address" required maxLength={200} defaultValue={values?.address} />
        </Field>
        <Field label="עיר" required>
          <Input name="city" required maxLength={80} defaultValue={values?.city} />
        </Field>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="סוג נכס" required>
          <Select name="type" defaultValue={values?.type ?? "APARTMENT"}>
            {propertyTypeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="חדרים">
          <Input name="rooms" type="number" inputMode="decimal" step="0.5" min="0" defaultValue={values?.rooms} dir="ltr" className="text-end" />
        </Field>
        <Field label='שטח (מ"ר)'>
          <Input name="sizeSqm" type="number" inputMode="decimal" step="1" min="0" defaultValue={values?.sizeSqm} dir="ltr" className="text-end" />
        </Field>
      </div>

      <Field label="הערות">
        <Textarea name="notes" maxLength={2000} defaultValue={values?.notes} />
      </Field>

      <FormActions submitLabel={submitLabel} cancelHref={cancelHref} />
    </form>
  );
}
