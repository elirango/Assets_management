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
        // Each property is an index card: name and address on top, its counts ruled off below.
        <ul className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {properties.map((property) => (
            <li key={property.id}>
              <Link
                href={`/properties/${property.id}`}
                className="press stock flex h-full flex-col hover:edge-lift focus-visible:outline-offset-4"
              >
                <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
                  <div className="min-w-0">
                    <p className="truncate text-lg font-semibold tracking-tight text-ink">{property.name}</p>
                    <p className="mt-0.5 text-sm text-muted">
                      {property.address}, {property.city}
                    </p>
                  </div>
                  <Badge tone="blue">{labelOf(PROPERTY_TYPES, property.type)}</Badge>
                </div>
                <div className="mt-auto grid grid-cols-3 divide-x divide-rule border-t border-rule text-sm">
                  <span className="px-5 py-3 text-muted">
                    <span className="fig block text-base text-ink">{property._count.tenants}</span>
                    דיירים
                  </span>
                  <span className="px-5 py-3 text-muted">
                    <span className="fig block text-base text-ink">{property._count.expenses}</span>
                    הוצאות
                  </span>
                  {property.rooms != null && (
                    <span className="px-5 py-3 text-muted">
                      <span className="fig block text-base text-ink">{property.rooms}</span>
                      חדרים
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
