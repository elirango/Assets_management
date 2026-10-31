"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cx } from "@/components/ui";
import { signOutAction } from "@/lib/actions/auth";

export type ShellUser = { email: string | null; name: string | null; role: "admin" | "viewer" };

const navItems = [
  { href: "/", label: "ראשי", icon: HomeIcon },
  { href: "/properties", label: "נכסים", icon: BuildingIcon },
  { href: "/tenants", label: "דיירים", icon: UsersIcon },
  { href: "/expenses", label: "הוצאות", icon: ReceiptIcon },
  { href: "/reminders", label: "תזכורות", icon: BellIcon },
  { href: "/reports", label: "דוחות", icon: ChartIcon },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

// Mobile: deep-teal top bar + fixed bottom tab bar. Desktop (md+): fixed deep-teal sidebar on the start side;
// the current destination is a brand-teal pill.
// Without a signed-in user (login page) the children render bare, with no navigation.
export function AppShell({ children, user }: { children: ReactNode; user: ShellUser | null }) {
  const pathname = usePathname();

  if (!user) return <>{children}</>;

  const viewer = user.role === "viewer";

  return (
    <div className="min-h-dvh">
      <header className="sticky top-0 z-20 bg-brand-deep text-on-brand md:hidden">
        <div className="flex h-14 items-center justify-between gap-3 px-4">
          <Link href="/" className="text-lg font-semibold tracking-tight text-on-brand focus-visible:outline-mint-2">
            ניהול נכסים
          </Link>
          <div className="flex items-center gap-2">
            {viewer && <ViewerBadge />}
            <SignOutButton compact />
          </div>
        </div>
      </header>

      <aside className="fixed inset-y-0 start-0 z-20 hidden w-60 flex-col bg-brand-deep text-on-brand md:flex">
        <div className="flex h-20 items-center px-6">
          <Link href="/" className="text-xl font-semibold tracking-tight text-on-brand focus-visible:outline-mint-2">
            ניהול נכסים
          </Link>
        </div>
        <nav className="flex-1 space-y-1 px-3" aria-label="ניווט ראשי">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex min-h-10 items-center gap-3 rounded-card px-3 text-base font-medium transition-colors duration-(--dur-micro) focus-visible:outline-mint-2",
                  active ? "bg-brand text-on-brand" : "text-mint-2 hover:bg-brand/45 hover:text-on-brand",
                )}
              >
                <Icon className="size-5" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-on-brand/15 px-4 py-4">
          <p className="truncate text-sm font-medium text-on-brand" title={user.email ?? undefined}>
            {user.name ?? user.email}
          </p>
          <div className="mt-1 flex items-center justify-between gap-2">
            {viewer ? <ViewerBadge /> : <span className="text-xs text-mint-2">מנהל</span>}
            <SignOutButton />
          </div>
        </div>
      </aside>

      <div className="md:ps-60">
        <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 md:px-10 md:pb-16 md:pt-10">{children}</main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-20 border-t border-rule bg-paper-2 pb-[env(safe-area-inset-bottom)] md:hidden"
        aria-label="ניווט ראשי"
      >
        <ul className="grid grid-cols-6">
          {navItems.map(({ href, label, icon: Icon }) => {
            const active = isActive(pathname, href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cx(
                    "relative flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors duration-(--dur-micro)",
                    active
                      ? "text-brand before:absolute before:inset-x-3 before:top-0 before:h-0.5 before:rounded-b-sm before:bg-brand"
                      : "text-muted hover:text-ink-2",
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <Icon className="size-6" />
                  {label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

function ViewerBadge() {
  return (
    <span className="inline-flex items-center rounded-input border border-mint-2/70 px-2 py-0.5 text-xs font-medium text-on-brand">
      צפייה בלבד
    </span>
  );
}

function SignOutButton({ compact = false }: { compact?: boolean }) {
  return (
    <form action={signOutAction}>
      <button
        type="submit"
        className={cx(
          "rounded-input text-mint-2 transition-colors duration-(--dur-micro) hover:bg-brand/45 hover:text-on-brand focus-visible:outline-mint-2 active:bg-brand",
          compact ? "min-h-9 px-2 text-sm" : "min-h-8 px-2 text-xs",
        )}
      >
        התנתקות
      </button>
    </form>
  );
}

type IconProps = { className?: string };

function HomeIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 11.5 12 4l9 7.5M5.5 9.8V20h13V9.8M10 20v-6h4v6" />
    </svg>
  );
}

function BuildingIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 20h16M6 20V4h12v16M9 8h2m2 0h2M9 12h2m2 0h2M9 16h2m2 0h2" />
    </svg>
  );
}

function UsersIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16 19v-1.5a3.5 3.5 0 0 0-3.5-3.5h-5A3.5 3.5 0 0 0 4 17.5V19M10 10.5A3.25 3.25 0 1 0 10 4a3.25 3.25 0 0 0 0 6.5ZM20 19v-1.5a3.5 3.5 0 0 0-2.5-3.35M15.5 4.2a3.25 3.25 0 0 1 0 6.1" />
    </svg>
  );
}

function ReceiptIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 3h12v18l-2-1.5L14 21l-2-1.5L10 21l-2-1.5L6 21V3ZM9 8h6M9 12h6M9 16h4" />
    </svg>
  );
}

function BellIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16ZM10 20a2 2 0 0 0 4 0" />
    </svg>
  );
}

function ChartIcon({ className }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v16h16M8 16v-4m4 4V8m4 8v-6" />
    </svg>
  );
}
