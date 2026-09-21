// Daily reminder digest: which open reminders are emailed today, and the Hebrew HTML body.
//
// Pure and UTC-only (like src/lib/contract.ts) so the rules can be unit-tested without a
// database. `dueDate` is stored as UTC midnight, so every comparison uses todayUtc().

import { formatDate, addDays, daysBetween, todayUtc } from "@/lib/format";

/** Cheques are announced from the day before they are due until they are marked done. */
export const CHECK_LEAD_DAYS = 1;
/** Renewals are announced once they fall inside this window before the reminder's date. */
export const RENEWAL_WINDOW_DAYS = 60;
/** A renewal that was already emailed is repeated no more often than this. */
export const RENEWAL_REPEAT_DAYS = 7;

export type DigestReminder = {
  id: string;
  type: string;
  title: string;
  dueDate: Date;
  notes: string | null;
  lastReminderSentAt: Date | null;
  tenant: { fullName: string; phone: string | null; contractEnd: Date | null } | null;
  property: { name: string; address: string; city: string } | null;
};

export type ReminderDigest<R extends DigestReminder = DigestReminder> = {
  checkDeposits: R[];
  contractRenewals: R[];
};

/**
 * Splits open reminders into the two lists that go out today.
 * - CHECK_DEPOSIT: due tomorrow or earlier (overdue cheques keep appearing daily until done).
 * - CONTRACT_END: due within the next RENEWAL_WINDOW_DAYS (or already overdue) and not emailed
 *   in the last RENEWAL_REPEAT_DAYS.
 * Everything else (METER_READING / OTHER) is left to the in-app dashboard.
 */
export function selectDueReminders<R extends DigestReminder>(reminders: R[], now = new Date()): ReminderDigest<R> {
  const today = todayUtc();
  const checkHorizon = addDays(today, CHECK_LEAD_DAYS);
  const renewalHorizon = addDays(today, RENEWAL_WINDOW_DAYS);
  const repeatCutoff = new Date(now.getTime() - RENEWAL_REPEAT_DAYS * 86_400_000);

  const digest: ReminderDigest<R> = { checkDeposits: [], contractRenewals: [] };

  for (const reminder of reminders) {
    if (reminder.type === "CHECK_DEPOSIT" && reminder.dueDate <= checkHorizon) {
      digest.checkDeposits.push(reminder);
    } else if (
      reminder.type === "CONTRACT_END" &&
      reminder.dueDate <= renewalHorizon &&
      (reminder.lastReminderSentAt === null || reminder.lastReminderSentAt < repeatCutoff)
    ) {
      digest.contractRenewals.push(reminder);
    }
  }

  const byDueDate = (a: R, b: R) => a.dueDate.getTime() - b.dueDate.getTime();
  digest.checkDeposits.sort(byDueDate);
  digest.contractRenewals.sort(byDueDate);
  return digest;
}

export function digestSize(digest: ReminderDigest): number {
  return digest.checkDeposits.length + digest.contractRenewals.length;
}

// ---------- email rendering ----------

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

/** "היום" / "מחר" / "בעוד N ימים" / "באיחור של N ימים" relative to today (UTC calendar). */
export function relativeDueLabel(dueDate: Date): string {
  const diff = daysBetween(todayUtc(), dueDate);
  if (diff === 0) return "היום";
  if (diff === 1) return "מחר";
  if (diff > 1) return `בעוד ${diff} ימים`;
  if (diff === -1) return "באיחור של יום";
  return `באיחור של ${-diff} ימים`;
}

function propertyLabel(property: DigestReminder["property"]): string {
  if (!property) return "";
  return `${property.name} · ${property.address}, ${property.city}`;
}

function renderRow(reminder: DigestReminder, opts: { showContractEnd: boolean }): string {
  const overdue = reminder.dueDate < todayUtc();
  const details: string[] = [];
  if (reminder.tenant) {
    details.push(`דייר: ${escapeHtml(reminder.tenant.fullName)}${reminder.tenant.phone ? ` (${escapeHtml(reminder.tenant.phone)})` : ""}`);
  }
  if (reminder.property) details.push(`נכס: ${escapeHtml(propertyLabel(reminder.property))}`);
  if (opts.showContractEnd && reminder.tenant?.contractEnd) {
    details.push(`סיום חוזה: ${formatDate(reminder.tenant.contractEnd)}`);
  }
  if (reminder.notes) details.push(`הערות: ${escapeHtml(reminder.notes)}`);

  return `
    <tr>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;vertical-align:top;">
        <div style="font-weight:600;color:#111827;">${escapeHtml(reminder.title)}</div>
        ${details.map((d) => `<div style="color:#4b5563;font-size:13px;margin-top:2px;">${d}</div>`).join("")}
      </td>
      <td style="padding:12px 16px;border-bottom:1px solid #e5e7eb;white-space:nowrap;vertical-align:top;text-align:start;">
        <div style="color:#111827;">${formatDate(reminder.dueDate)}</div>
        <div style="font-size:13px;margin-top:2px;color:${overdue ? "#b91c1c" : "#6b7280"};${overdue ? "font-weight:600;" : ""}">${relativeDueLabel(reminder.dueDate)}</div>
      </td>
    </tr>`;
}

function renderSection(heading: string, reminders: DigestReminder[], opts: { showContractEnd: boolean }): string {
  if (reminders.length === 0) return "";
  return `
    <h2 style="font-size:16px;margin:28px 0 8px;color:#111827;">${heading} <span style="color:#6b7280;font-weight:400;">(${reminders.length})</span></h2>
    <table role="presentation" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;border:1px solid #e5e7eb;border-radius:8px;">
      <thead>
        <tr style="background:#f9fafb;">
          <th style="padding:10px 16px;text-align:start;font-size:13px;color:#6b7280;font-weight:600;">פריט</th>
          <th style="padding:10px 16px;text-align:start;font-size:13px;color:#6b7280;font-weight:600;">תאריך יעד</th>
        </tr>
      </thead>
      <tbody>${reminders.map((r) => renderRow(r, opts)).join("")}</tbody>
    </table>`;
}

export function digestSubject(digest: ReminderDigest, today = todayUtc()): string {
  const parts: string[] = [];
  if (digest.checkDeposits.length) parts.push(`${digest.checkDeposits.length} צ'קים`);
  if (digest.contractRenewals.length) parts.push(`${digest.contractRenewals.length} חידושי חוזה`);
  return `תזכורות לטיפול – ${formatDate(today)} (${parts.join(", ")})`;
}

/** Full RTL HTML document for the digest email. `appUrl` (optional) adds a link to the dashboard. */
export function renderDigestHtml(digest: ReminderDigest, appUrl?: string): string {
  const today = todayUtc();
  const link = appUrl
    ? `<p style="margin:28px 0 0;"><a href="${escapeHtml(appUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:10px 18px;border-radius:6px;font-weight:600;">פתיחת המערכת</a></p>`
    : "";

  return `<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:24px;background:#f3f4f6;font-family:Arial,Helvetica,sans-serif;direction:rtl;">
  <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;padding:28px 28px 32px;">
    <h1 style="font-size:20px;margin:0 0 4px;color:#111827;">תזכורות לטיפול</h1>
    <p style="margin:0;color:#6b7280;font-size:14px;">${formatDate(today)} · ${digestSize(digest)} פריטים ממתינים</p>
    ${renderSection("צ'קים להפקדה", digest.checkDeposits, { showContractEnd: false })}
    ${renderSection("חידושי חוזה", digest.contractRenewals, { showContractEnd: true })}
    ${link}
    <p style="margin:28px 0 0;color:#9ca3af;font-size:12px;">הודעה אוטומטית ממערכת ניהול הנכסים. סימון תזכורת כ"בוצע" במערכת יסיר אותה מהדוח היומי.</p>
  </div>
</body>
</html>`;
}

/** Plain-text alternative for clients that do not render HTML. */
export function renderDigestText(digest: ReminderDigest): string {
  const lines: string[] = [`תזכורות לטיפול – ${formatDate(todayUtc())}`, ""];
  const section = (heading: string, reminders: DigestReminder[]) => {
    if (!reminders.length) return;
    lines.push(`${heading} (${reminders.length})`);
    for (const r of reminders) {
      lines.push(`- ${r.title} — ${formatDate(r.dueDate)} (${relativeDueLabel(r.dueDate)})`);
    }
    lines.push("");
  };
  section("צ'קים להפקדה", digest.checkDeposits);
  section("חידושי חוזה", digest.contractRenewals);
  return lines.join("\n");
}
