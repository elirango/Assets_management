import Link from "next/link";
import { DeleteButton, PendingButton } from "@/components/forms/form-actions";
import { Badge, cx } from "@/components/ui";
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

export function ReminderList({ reminders, compact = false }: { reminders: ReminderListItem[]; compact?: boolean }) {
  return (
    <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
      {reminders.map((reminder) => {
        const status = dueStatus(reminder.dueDate, reminder.done);
        return (
          <li key={reminder.id} className={cx("flex items-start gap-3 p-3 sm:p-4", reminder.done && "bg-slate-50")}>
            <form action={toggleReminderDone} className="pt-0.5">
              <input type="hidden" name="id" value={reminder.id} />
              <PendingButton
                variant="ghost"
                className={cx(
                  "size-9! min-h-0 rounded-full border-2 p-0!",
                  reminder.done ? "border-emerald-600 bg-emerald-600 text-white" : "border-slate-300 text-transparent hover:border-emerald-500",
                )}
              >
                <span className="sr-only">{reminder.done ? "סמן כלא בוצע" : "סמן כבוצע"}</span>
                <svg viewBox="0 0 20 20" className="size-5" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
                  <path strokeLinecap="round" strokeLinejoin="round" d="m5 10.5 3.5 3.5L15 7" />
                </svg>
              </PendingButton>
            </form>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="blue">{labelOf(REMINDER_TYPES, reminder.type)}</Badge>
                <Badge tone={status.tone}>{status.label}</Badge>
              </div>
              <p className={cx("mt-1.5 font-medium text-slate-900", reminder.done && "text-slate-500 line-through")}>
                {reminder.title}
              </p>
              <p className="mt-0.5 text-sm text-slate-500">
                {formatDate(reminder.dueDate)}
                {reminder.property && (
                  <>
                    {" · "}
                    <Link href={`/properties/${reminder.property.id}`} className="hover:underline">
                      {reminder.property.name}
                    </Link>
                  </>
                )}
                {reminder.tenant && ` · ${reminder.tenant.fullName}`}
              </p>
            </div>

            {!compact && (
              <div className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center">
                <Link href={`/reminders/${reminder.id}/edit`} className="rounded-lg px-2 py-1 text-sm text-blue-700 hover:bg-blue-50">
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
          </li>
        );
      })}
    </ul>
  );
}
