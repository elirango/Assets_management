import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Rubik } from "next/font/google";
import { AppShell } from "@/components/app-shell";
import { getSessionUser } from "@/lib/authz";
import "./globals.css";

const rubik = Rubik({
  variable: "--font-rubik",
  subsets: ["hebrew", "latin"],
  weight: ["400", "500", "600"],
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
  themeColor: "#f1ede9",
};

// Every page reads from the local database, so render on each request.
export const dynamic = "force-dynamic";

export default async function RootLayout({ children }: { children: ReactNode }) {
  const user = await getSessionUser();
  return (
    <html lang="he" dir="rtl" className={`${rubik.variable} h-full antialiased`}>
      <body className="min-h-full">
        <AppShell user={user}>{children}</AppShell>
      </body>
    </html>
  );
}
