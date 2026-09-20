import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Heebo } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { getSessionUser } from "@/lib/authz";
import "./globals.css";

const heebo = Heebo({
  variable: "--font-heebo",
  subsets: ["hebrew", "latin"],
});

export const metadata: Metadata = {
  title: {
    default: "ניהול נכסים",
    template: "%s | ניהול נכסים",
  },
  description: "ניהול נכסים, דיירים, הוצאות ותזכורות",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

// Every page reads from the local database, so render on each request.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  return (
    <html lang="he" dir="rtl" className={`${heebo.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppShell user={user}>{children}</AppShell>
      </body>
    </html>
  );
}
