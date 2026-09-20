import type { Metadata } from "next";
import Link from "next/link";
import { Badge, EmptyState, LinkButton, PageHeader } from "@/components/ui";
import { PROPERTY_TYPES, labelOf } from "@/lib/constants";
import { isAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export const metadata: Metadata = { title: "נכסים" };

export default async function PropertiesPage() {
  const canEdit = await isAdmin();
  const properties = await prisma.property.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { tenants: true, expenses: true } } },
  });

  return (
    <>
      <PageHeader
        title="נכסים"
        description={`${properties.length} נכסים`}
        action={canEdit ? <LinkButton href="/properties/new">+ נכס חדש</LinkButton> : undefined}
      />

      {properties.length === 0 ? (
        <EmptyState
          title="עדיין אין נכסים"
          description="התחילו בהוספת הנכס הראשון שלכם."
          action={canEdit ? <LinkButton href="/properties/new">הוספת נכס</LinkButton> : undefined}
        />
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2">
          {properties.map((property) => (
            <li key={property.id}>
              <Link
                href={`/properties/${property.id}`}
                className="block rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold text-slate-900">{property.name}</p>
                    <p className="mt-0.5 text-sm text-slate-500">
                      {property.address}, {property.city}
                    </p>
                  </div>
                  <Badge tone="blue">{labelOf(PROPERTY_TYPES, property.type)}</Badge>
                </div>
                <div className="mt-3 flex gap-4 text-sm text-slate-600">
                  <span>{property._count.tenants} דיירים</span>
                  <span>{property._count.expenses} הוצאות</span>
                  {property.rooms != null && <span>{property.rooms} חדרים</span>}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
