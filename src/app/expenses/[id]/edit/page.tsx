import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExpenseForm } from "@/components/forms/expense-form";
import { DeleteButton } from "@/components/forms/form-actions";
import { Card, PageHeader } from "@/components/ui";
import { deleteExpense, updateExpense } from "@/lib/actions/expenses";
import { toDateInputValue } from "@/lib/format";
import { requireAdminPage } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "עריכת הוצאה" };

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage();
  const { id } = await params;
  const [expense, properties] = await Promise.all([
    prisma.expense.findUnique({ where: { id } }),
    prisma.property.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ]);
  if (!expense) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="עריכת הוצאה"
        description={expense.title}
        action={<DeleteButton id={expense.id} action={deleteExpense} confirmMessage="למחוק את ההוצאה?" />}
      />
      <Card>
        <ExpenseForm
          action={updateExpense.bind(null, expense.id)}
          properties={properties}
          initial={{
            title: expense.title,
            propertyId: expense.propertyId,
            category: expense.category,
            amount: expense.amount.toString(),
            date: toDateInputValue(expense.date),
            vendor: expense.vendor ?? "",
            notes: expense.notes ?? "",
          }}
          submitLabel="שמירת שינויים"
          cancelHref="/expenses"
        />
      </Card>
    </div>
  );
}
