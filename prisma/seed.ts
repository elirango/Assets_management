// Seed the local SQLite database with a real-world sample: one property, its tenant,
// and the two reminders the dashboard should surface.
// Run with: npx prisma db seed   (configured in prisma.config.ts -> migrations.seed)
//
// The script is idempotent: re-running it replaces the previously seeded records
// instead of duplicating them.

import { config as loadEnv } from "dotenv";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

loadEnv({ path: [".env.local", ".env"], quiet: true });

// Seeding is a one-off script, so use the direct (non-pooled) connection like the CLI does.
const connectionString = process.env.POSTGRES_URL_NON_POOLING ?? process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error(
    "Missing POSTGRES_URL_NON_POOLING (or DATABASE_URL). Run `npx vercel env pull` first — see DEPLOYMENT_GUIDE.md.",
  );
}
const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

const PROPERTY = {
  name: "לאון בלום 11, חולון - דירה 1, קומה 1",
  address: "לאון בלום 11 - דירה 1, קומה 1",
  city: "חולון",
  type: "APARTMENT",
  notes: "מושכר ליהודה שאשא",
};

const TENANT = {
  fullName: "יהודה שאשא (באמצעות שרית שאשא מימון)",
  monthlyRent: 4000,
  contractStart: new Date("2026-08-10"),
  contractEnd: new Date("2027-08-09"),
};

/** UTC midnight on the 10th of the month after the current one. */
function tenthOfNextMonth(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 10));
}

async function main() {
  // Remove a previous run of this seed (Property delete cascades to its reminders/expenses).
  await prisma.tenant.deleteMany({ where: { fullName: TENANT.fullName } });
  await prisma.property.deleteMany({ where: { address: PROPERTY.address, city: PROPERTY.city } });

  const property = await prisma.property.create({
    data: {
      ...PROPERTY,
      tenants: { create: TENANT },
    },
    include: { tenants: true },
  });
  const tenant = property.tenants[0];

  await prisma.reminder.createMany({
    data: [
      {
        type: "CHECK_DEPOSIT",
        title: "הפקדת צ'ק שכירות - יהודה שאשא",
        dueDate: tenthOfNextMonth(),
        done: false,
        propertyId: property.id,
        tenantId: tenant.id,
      },
      {
        type: "CONTRACT_END",
        title: "סיום חוזה - יהודה שאשא",
        dueDate: new Date("2027-08-09"),
        done: false,
        propertyId: property.id,
        tenantId: tenant.id,
      },
    ],
  });

  const seeded = await prisma.property.findUniqueOrThrow({
    where: { id: property.id },
    include: { tenants: true, reminders: { include: { tenant: true }, orderBy: { dueDate: "asc" } } },
  });

  console.log(`✔ Property  ${seeded.name} (${seeded.id})`);
  for (const t of seeded.tenants) {
    console.log(`✔ Tenant    ${t.fullName} · ₪${t.monthlyRent} · ${iso(t.contractStart)} → ${iso(t.contractEnd)}`);
  }
  for (const r of seeded.reminders) {
    console.log(`✔ Reminder  ${r.type.padEnd(13)} due ${iso(r.dueDate)} · done=${r.done} · tenant=${r.tenant?.fullName ?? "-"}`);
  }
}

function iso(date: Date | null) {
  return date ? date.toISOString().slice(0, 10) : "-";
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
