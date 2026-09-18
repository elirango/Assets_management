// Small FormData helpers shared by all server actions.

/**
 * State returned by form actions. React resets an uncontrolled <form> after its
 * action settles, so on validation failure we echo the submitted values back and
 * the form components use them as defaultValues to keep what the user typed.
 */
export type ActionFailure = { error: string; values: Record<string, string> };
export type ActionState = Partial<ActionFailure>;

export function failure(error: string, formData: FormData): ActionFailure {
  const values: Record<string, string> = {};
  formData.forEach((value, key) => {
    if (typeof value === "string" && !key.startsWith("$ACTION")) values[key] = value;
  });
  return { error, values };
}

export function getString(formData: FormData, key: string): string {
  const value = formData.get(key);
  return typeof value === "string" ? value.trim() : "";
}

export function getOptionalString(formData: FormData, key: string): string | null {
  const value = getString(formData, key);
  return value === "" ? null : value;
}

export function getNumber(formData: FormData, key: string): number | null {
  const value = getString(formData, key);
  if (value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function getDate(formData: FormData, key: string): Date | null {
  const value = getString(formData, key);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}
