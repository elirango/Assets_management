import type { Metadata } from "next";
import { ReportsScreen } from "@/components/reports-screen";
import { EXPENSE_CATEGORIES, labelOf } from "@/lib/constants";
import { toDateInputValue, todayUtc } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { type ReportRow, chargeDescriptionParts } from "@/lib/reports";

export const metadata: Metadata = { title: "דוחות" };

// Raw rows only: filtering, grouping, totals and the CSV export happen on the client.
export default async function ReportsPage() {
  const [charges, expenses] = await Promise.all([
    prisma.charge.findMany({
      orderBy: { date: "desc" },
      select: { id: true, amount: true, description: true, isPaid: true, date: true, tenant: { select: { fullName: true } } },
    }),
    prisma.expense.findMany({
      orderBy: { date: "desc" },
      select: { id: true, title: true, category: true, amount: true, date: true, property: { select: { name: true } } },
    }),
  ]);

  const tenantRows: ReportRow[] = charges.map((charge) => ({
    id: charge.id,
    date: toDateInputValue(charge.date),
    name: charge.tenant.fullName,
    ...chargeDescriptionParts(charge.description),
    tag: charge.isPaid ? "שולם" : "לא שולם",
    tagTone: charge.isPaid ? "green" : "amber",
    amount: charge.amount,
  }));

  const propertyRows: ReportRow[] = expenses.map((expense) => ({
    id: expense.id,
    date: toDateInputValue(expense.date),
    name: expense.property.name,
    description: expense.title,
    billingPeriod: "",
    tag: labelOf(EXPENSE_CATEGORIES, expense.category),
    tagTone: "neutral",
    amount: expense.amount,
  }));

  return (
    <ReportsScreen
      rows={{ tenants: tenantRows, properties: propertyRows }}
      today={toDateInputValue(todayUtc())}
    />
  );
}
