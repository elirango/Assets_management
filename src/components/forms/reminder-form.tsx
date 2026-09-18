"use client";

import { useActionState } from "react";
import { FormActions } from "@/components/forms/form-actions";
import type { PropertyOption } from "@/components/forms/tenant-form";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui";
import { REMINDER_TYPES, toOptions } from "@/lib/constants";
import type { ActionState } from "@/lib/form";

export type ReminderFormValues = {
  title: string;
  type: string;
  dueDate: string;
  propertyId: string;
  tenantId: string;
  notes: string;
};

export type TenantOption = { id: string; fullName: string };

const typeOptions = toOptions(REMINDER_TYPES);

export function ReminderForm({
  action,
  initial,
  properties,
  tenants,
  submitLabel,
  cancelHref,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  initial?: Partial<ReminderFormValues>;
  properties: PropertyOption[];
  tenants: TenantOption[];
  submitLabel: string;
  cancelHref: string;
}) {
  const [state, formAction] = useActionState(action, {});
  // On a failed submit React resets the form, so re-seed it with what was typed.
  const values = { ...initial, ...state.values };

  return (
    <form action={formAction} className="space-y-4">
      <FormError message={state.error} />

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="סוג תזכורת" required>
          <Select name="type" defaultValue={values?.type ?? "CHECK_DEPOSIT"}>
            {typeOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="תאריך יעד" required>
          <Input name="dueDate" type="date" required defaultValue={values?.dueDate} />
        </Field>
      </div>

      <Field label="כותרת" required hint='לדוגמה: "להפקיד צ׳ק של חודש אוקטובר"'>
        <Input name="title" required maxLength={160} defaultValue={values?.title} autoFocus />
      </Field>

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="נכס">
          <Select name="propertyId" defaultValue={values?.propertyId ?? ""}>
            <option value="">— ללא נכס —</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="דייר">
          <Select name="tenantId" defaultValue={values?.tenantId ?? ""}>
            <option value="">— ללא דייר —</option>
            {tenants.map((tenant) => (
              <option key={tenant.id} value={tenant.id}>
                {tenant.fullName}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <Field label="הערות">
        <Textarea name="notes" maxLength={2000} defaultValue={values?.notes} />
      </Field>

      <FormActions submitLabel={submitLabel} cancelHref={cancelHref} />
    </form>
  );
}
