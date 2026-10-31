import Link from "next/link";
import { DeleteButton, PendingButton } from "@/components/forms/form-actions";
import { Badge, cx, recordLink, rowAction } from "@/components/ui";
import { deleteReminder, toggleReminderDone } from "@/lib/actions/reminders";
import { REMINDER_TYPES, labelOf } from "@/lib/constants";
import { daysBetween, formatDate, todayUtc } from "@/lib/format";

export type ReminderListItem = {
  id: string;
  type: string;
  title: string;
  dueDate: Date;
  done: boolean;
  property: { id: string; name: string } | null;
  tenant: { id: string; fullName: string } | null;
};

function dueStatus(dueDate: Date, done: boolean): { label: string; tone: "neutral" | "green" | "amber" | "red" } {
  if (done) return { label: "בוצע", tone: "green" };
  const days = daysBetween(todayUtc(), dueDate);
  if (days < 0) return { label: `באיחור ${-days} ימים`, tone: "red" };
  if (days === 0) return { label: "היום", tone: "red" };
  if (days === 1) return { label: "מחר", tone: "amber" };
  if (days <= 7) return { label: `בעוד ${days} ימים`, tone: "amber" };
  return { label: `בעוד ${days} ימים`, tone: "neutral" };
}

const checkMark = (
  <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
    <path strokeLinecap="round" strokeLinejoin="round" d="m5 10.5 3.5 3.5L15 7" />
  </svg>
);

/** `readOnly` (viewer role) renders the done state as a static mark and hides edit/delete. */
export function ReminderList({
  reminders,
  compact = false,
  readOnly = false,
}: {
  reminders: ReminderListItem[];
  compact?: boolean;
  readOnly?: boolean;
}) {
  return (
    <ul className="stock divide-y divide-rule overflow-hidden">
      {reminders.map((reminder) => {
        const status = dueStatus(reminder.dueDate, reminder.done);
        return (
          <li
            key={reminder.id}
            className={cx("flex items-start gap-3 px-4 py-3 sm:gap-4 sm:px-5 sm:py-4", reminder.done && "bg-paper/70")}
          >
            {readOnly ? (
              <span
                aria-label={reminder.done ? "בוצע" : "טרם בוצע"}
                className={cx(
                  "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full",
                  reminder.done ? "bg-ink text-cotton" : "groove rounded-full! text-transparent",
                )}
              >
                {checkMark}
              </span>
            ) : (
              <form action={toggleReminderDone} className="pt-0.5">
                <input type="hidden" name="id" value={reminder.id} />
                <PendingButton
                  variant="ghost"
                  className={cx(
                    "size-9! min-h-0! rounded-full! p-0!",
                    reminder.done
                      ? "bg-ink text-cotton hover:bg-ink-2"
                      : "groove text-transparent hover:bg-paper-3 hover:text-muted",
                  )}
                >
                  <span className="sr-only">{reminder.done ? "סמן כלא בוצע" : "סמן כבוצע"}</span>
                  {checkMark}
                </PendingButton>
              </form>
            )}

            <div className="min-w-0 flex-1">
              <p className={cx("font-medium text-ink", reminder.done && "text-muted line-through")}>
                {reminder.title}
              </p>
              <p className="mt-0.5 flex flex-wrap gap-x-3 text-sm text-muted">
                <span className="fig">{formatDate(reminder.dueDate)}</span>
                {reminder.property && (
                  <Link href={`/properties/${reminder.property.id}`} className={recordLink}>
                    {reminder.property.name}
                  </Link>
                )}
                {reminder.tenant && <span>{reminder.tenant.fullName}</span>}
              </p>
              {/* Status, type and the row's actions share the last line, so the title keeps the full width. */}
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <Badge tone={status.tone}>{status.label}</Badge>
                <Badge tone="blue">{labelOf(REMINDER_TYPES, reminder.type)}</Badge>
                {!compact && !readOnly && (
                  <div className="-me-2 ms-auto flex items-center">
                    <Link href={`/reminders/${reminder.id}/edit`} className={rowAction}>
                      עריכה
                    </Link>
                    <DeleteButton
                      id={reminder.id}
                      action={deleteReminder}
                      confirmMessage="למחוק את התזכורת?"
                      variant="ghost"
                      label="מחיקה"
                    />
                  </div>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
