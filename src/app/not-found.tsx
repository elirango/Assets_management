import { EmptyState, LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <div className="mx-auto max-w-md pt-10">
      <EmptyState
        title="הדף לא נמצא"
        description="ייתכן שהפריט נמחק או שהקישור שגוי."
        action={<LinkButton href="/">חזרה ללוח הבקרה</LinkButton>}
      />
    </div>
  );
}
