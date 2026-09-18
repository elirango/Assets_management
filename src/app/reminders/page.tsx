import type { Metadata } from "next";
import { ReminderList } from "@/components/reminder-list";
import { EmptyState, LinkButton, PageHeader, SectionTitle } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "תזכורות" };

const reminderInclude = {
  property: { select: { id: true, name: true } },
  tenant: { select: { id: true, fullName: true } },
} as const;

export default async function RemindersPage() {
  const [open, done] = await Promise.all([
    prisma.reminder.findMany({ where: { done: false }, orderBy: { dueDate: "asc" }, include: reminderInclude }),
    prisma.reminder.findMany({ where: { done: true }, orderBy: { dueDate: "desc" }, take: 20, include: reminderInclude }),
  ]);

  return (
    <>
      <PageHeader
        title="תזכורות"
        description="הפקדות צ׳קים, סיומי חוזים וקריאות מונה"
        action={<LinkButton href="/reminders/new">+ תזכורת חדשה</LinkButton>}
      />

      <section>
        <SectionTitle>פתוחות ({open.length})</SectionTitle>
        {open.length === 0 ? (
          <EmptyState
            title="אין תזכורות פתוחות"
            description="כל הכבוד! אפשר להוסיף תזכורת חדשה."
            action={<LinkButton href="/reminders/new">הוספת תזכורת</LinkButton>}
          />
        ) : (
          <ReminderList reminders={open} />
        )}
      </section>

      {done.length > 0 && (
        <section className="mt-8">
          <SectionTitle>בוצעו לאחרונה</SectionTitle>
          <ReminderList reminders={done} />
        </section>
      )}
    </>
  );
}
