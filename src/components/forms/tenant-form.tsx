"use client";

import { useActionState } from "react";
import { FormActions } from "@/components/forms/form-actions";
import { Field, FormError, Input, Select, Textarea } from "@/components/ui";
import type { ActionState } from "@/lib/form";

export type TenantFormValues = {
  fullName: string;
  phone: string;
  email: string;
  idNumber: string;
  monthlyRent: string;
  contractStart: string;
  contractEnd: string;
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

      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="תחילת חוזה">
          <Input name="contractStart" type="date" defaultValue={values?.contractStart} />
        </Field>
        <Field label="סיום חוזה">
          <Input name="contractEnd" type="date" defaultValue={values?.contractEnd} />
        </Field>
      </div>

      <Field label="הערות">
        <Textarea name="notes" maxLength={2000} defaultValue={values?.notes} />
      </Field>

      <FormActions submitLabel={submitLabel} cancelHref={cancelHref} />
    </form>
  );
}
