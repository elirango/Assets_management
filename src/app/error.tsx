"use client";

import { Button, EmptyState, LinkButton } from "@/components/ui";

// Route-level error boundary. Server-action errors (including UnauthorizedError from a
// viewer's forged request) surface here with a Hebrew message instead of a blank screen.
export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto max-w-md pt-10">
      <EmptyState
        title="הפעולה נכשלה"
        description={error.message || "אירעה שגיאה בלתי צפויה."}
        action={
          <div className="flex gap-2">
            <Button type="button" onClick={reset} variant="secondary">
              נסו שוב
            </Button>
            <LinkButton href="/">חזרה ללוח הבקרה</LinkButton>
          </div>
        }
      />
    </div>
  );
}
