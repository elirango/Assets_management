import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Button, Card } from "@/components/ui";
import { signInWithGoogle } from "@/lib/actions/auth";
import { auth } from "@/lib/auth";

export const metadata: Metadata = { title: "התחברות" };

const ERROR_MESSAGES: Record<string, string> = {
  AccessDenied: "חשבון Google זה אינו מורשה להשתמש במערכת.",
  Configuration: "ההתחברות אינה מוגדרת כראוי. יש לבדוק את משתני הסביבה.",
  OAuthCallbackError: "ההתחברות ל-Google נכשלה. נסו שוב.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const session = await auth();
  if (session?.user) redirect("/");

  const { callbackUrl, error } = await searchParams;
  const errorMessage = error ? (ERROR_MESSAGES[error] ?? "ההתחברות נכשלה. נסו שוב.") : null;

  return (
    <div className="flex min-h-dvh items-center justify-center px-4 py-10">
      <Card className="w-full max-w-sm space-y-5 p-6 text-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">ניהול נכסים</h1>
          <p className="mt-1 text-sm text-slate-500">התחברו עם חשבון Google המורשה כדי להמשיך.</p>
        </div>

        {errorMessage && (
          <p role="alert" className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
            {errorMessage}
          </p>
        )}

        <form action={signInWithGoogle}>
          <input type="hidden" name="callbackUrl" value={callbackUrl ?? "/"} />
          <Button type="submit" className="w-full">
            <GoogleIcon />
            התחברות עם Google
          </Button>
        </form>
      </Card>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg className="size-5" viewBox="0 0 24 24" aria-hidden>
      <path fill="#fff" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.4Z" />
      <path fill="#fff" fillOpacity=".8" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22Z" />
      <path fill="#fff" fillOpacity=".6" d="M6.4 13.9a6 6 0 0 1 0-3.8V7.5H3.1a10 10 0 0 0 0 9l3.3-2.6Z" />
      <path fill="#fff" fillOpacity=".9" d="M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A10 10 0 0 0 3.1 7.5l3.3 2.6C7.2 7.8 9.4 6 12 6Z" />
    </svg>
  );
}
