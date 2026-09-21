import { NextResponse } from "next/server";
import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { addDays, todayUtc } from "@/lib/format";
import {
  RENEWAL_WINDOW_DAYS,
  digestSize,
  digestSubject,
  renderDigestHtml,
  renderDigestText,
  selectDueReminders,
} from "@/lib/reminderDigest";

// Daily digest, triggered by Vercel Cron (see vercel.json) at 06:00 UTC.
// Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically when the env var is set;
// the same header lets you trigger a run by hand with curl.
//
// Reads request headers and the database, so Next.js treats this handler as dynamic.

const DEFAULT_FROM = "ניהול נכסים <onboarding@resend.dev>";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return request.headers.get("authorization") === `Bearer ${secret}`;
}

/** Public URL of the deployment for the "open the app" button; undefined when unknown. */
function appUrl(): string | undefined {
  if (process.env.APP_URL) return process.env.APP_URL;
  const vercelHost = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return vercelHost ? `https://${vercelHost}` : undefined;
}

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET is not configured" }, { status: 500 });
  }
  if (!isAuthorized(request)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const recipient = process.env.ADMIN_EMAIL?.trim();
  const apiKey = process.env.RESEND_API_KEY;
  if (!recipient || !apiKey) {
    return NextResponse.json(
      { ok: false, error: "ADMIN_EMAIL and RESEND_API_KEY must both be set" },
      { status: 500 },
    );
  }

  const now = new Date();

  // Open cheque + renewal reminders due inside the widest window; the exact rules
  // (tomorrow-or-earlier for cheques, 7-day repeat throttle for renewals) are applied in
  // selectDueReminders so they stay pure and testable.
  const candidates = await prisma.reminder.findMany({
    where: {
      done: false,
      type: { in: ["CHECK_DEPOSIT", "CONTRACT_END"] },
      dueDate: { lte: addDays(todayUtc(), RENEWAL_WINDOW_DAYS) },
    },
    select: {
      id: true,
      type: true,
      title: true,
      dueDate: true,
      notes: true,
      lastReminderSentAt: true,
      tenant: { select: { fullName: true, phone: true, contractEnd: true } },
      property: { select: { name: true, address: true, city: true } },
    },
  });

  const digest = selectDueReminders(candidates, now);
  const summary = {
    checkDeposits: digest.checkDeposits.length,
    contractRenewals: digest.contractRenewals.length,
  };

  if (digestSize(digest) === 0) {
    return NextResponse.json({ ok: true, sent: false, ...summary, message: "Nothing due today" });
  }

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from: process.env.RESEND_FROM ?? DEFAULT_FROM,
    to: recipient,
    subject: digestSubject(digest),
    html: renderDigestHtml(digest, appUrl()),
    text: renderDigestText(digest),
  });

  if (error) {
    console.error("[cron/reminders] Resend failed", error);
    return NextResponse.json({ ok: false, sent: false, ...summary, error: error.message }, { status: 502 });
  }

  // Only renewals are throttled; cheques are repeated every day until they are marked done.
  // Stamp after a successful send so a failed email is retried on the next run.
  const renewalIds = digest.contractRenewals.map((r) => r.id);
  const { count: updated } = renewalIds.length
    ? await prisma.reminder.updateMany({ where: { id: { in: renewalIds } }, data: { lastReminderSentAt: now } })
    : { count: 0 };

  return NextResponse.json({
    ok: true,
    sent: true,
    ...summary,
    renewalsStamped: updated,
    emailId: data?.id ?? null,
    to: recipient,
  });
}
