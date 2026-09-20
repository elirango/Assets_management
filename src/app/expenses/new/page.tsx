import type { Metadata } from "next";
import { ExpenseForm } from "@/components/forms/expense-form";
import { Card, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { createExpense } from "@/lib/actions/expenses";
import { toDateInputValue, todayUtc } from "@/lib/format";
import { requireAdminPage } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "הוצאה חדשה" };

export default async function NewExpensePage({ searchParams }: { searchParams: Promise<{ propertyId?: string }> }) {
  await requireAdminPage();
  const { propertyId } = await searchParams;
  const properties = await prisma.property.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="הוצאה חדשה" />
      {properties.length === 0 ? (
        <EmptyState
          title="קודם צריך נכס"
          description="הוצאות משויכות תמיד לנכס. הוסיפו נכס ואז חזרו לכאן."
          action={<LinkButton href="/properties/new">הוספת נכס</LinkButton>}
        />
      ) : (
        <Card>
          <ExpenseForm
            action={createExpense}
            properties={properties}
            initial={{
              propertyId: propertyId ?? (properties.length === 1 ? properties[0].id : ""),
              date: toDateInputValue(todayUtc()),
            }}
            submitLabel="שמירת הוצאה"
            cancelHref={propertyId ? `/properties/${propertyId}` : "/expenses"}
          />
        </Card>
      )}
    </div>
  );
}
