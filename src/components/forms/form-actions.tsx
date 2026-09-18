"use client";

import { useFormStatus } from "react-dom";
import { Button, LinkButton } from "@/components/ui";

/** Submit + cancel row; disables submit while the server action is pending. */
export function FormActions({ submitLabel, cancelHref }: { submitLabel: string; cancelHref: string }) {
  const { pending } = useFormStatus();
  return (
    <div className="flex flex-col-reverse gap-3 pt-2 sm:flex-row">
      <Button type="submit" disabled={pending} className="sm:min-w-32">
        {pending ? "שומר..." : submitLabel}
      </Button>
      <LinkButton href={cancelHref} variant="secondary">
        ביטול
      </LinkButton>
    </div>
  );
}

/** A one-field form that asks for confirmation before running a destructive server action. */
export function DeleteButton({
  id,
  action,
  confirmMessage,
  label = "מחיקה",
  variant = "danger",
}: {
  id: string;
  action: (formData: FormData) => Promise<void>;
  confirmMessage: string;
  label?: string;
  variant?: "danger" | "ghost";
}) {
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(confirmMessage)) event.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <PendingButton
        variant={variant}
        className={variant === "ghost" ? "min-h-9 px-2 text-sm text-red-700 hover:bg-red-50" : undefined}
      >
        {label}
      </PendingButton>
    </form>
  );
}

export function PendingButton({
  children,
  variant = "primary",
  className,
}: {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger" | "ghost";
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" variant={variant} disabled={pending} className={className}>
      {children}
    </Button>
  );
}
