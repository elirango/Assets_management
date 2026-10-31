import Link from "next/link";
import type {
  ButtonHTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";

// Small, dependency-free UI primitives in the Coral system (tokens in src/app/tokens.css).
// Controls are 40px on desktop and 44px on phones; inputs use 16px text so iOS doesn't zoom in on focus.

type Variant = "primary" | "secondary" | "danger" | "ghost";

const buttonBase =
  "press inline-flex min-h-11 items-center justify-center gap-2 rounded-card px-4 text-base font-medium md:min-h-10 disabled:cursor-not-allowed disabled:opacity-55";

const buttonVariants: Record<Variant, string> = {
  // Ink board, label pressed the other way.
  primary: "cast bg-board text-board-type hover:bg-ink-2 active:bg-ink",
  // Letterpress card on cotton.
  secondary: "edge bg-cotton text-print hover:edge-lift active:bg-paper",
  // Delete is never the page's one action, so it takes the card with coral ink.
  danger: "edge bg-cotton text-accent-2 hover:edge-lift active:bg-paper",
  ghost: "text-ink-2 hover:bg-paper-2 active:bg-paper-3",
};

/** A quiet text action inside a ledger row ("עריכה"). */
export const rowAction =
  "inline-flex min-h-9 items-center rounded-input px-2 text-sm text-ink-2 transition-colors duration-(--dur-micro) hover:bg-paper-2 hover:text-ink active:bg-paper-3";

/** An inline link to a record from running text or a meta line. */
export const recordLink = "text-ink-2 underline-offset-4 hover:text-ink hover:underline";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button className={cx(buttonBase, buttonVariants[variant], className)} {...props} />;
}

export function LinkButton({
  href,
  variant = "primary",
  className,
  children,
}: {
  href: string;
  variant?: Variant;
  className?: string;
  children: ReactNode;
}) {
  return (
    <Link href={href} className={cx(buttonBase, buttonVariants[variant], className)}>
      {children}
    </Link>
  );
}

const fieldBase =
  "w-full min-h-11 rounded-input border border-muted/60 bg-cotton px-3 text-base text-ink transition-colors duration-(--dur-micro) placeholder:text-muted/70 hover:border-muted focus-visible:border-focus focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus/40 aria-invalid:border-accent-2 [&[readonly]]:bg-paper-2 [&[readonly]]:text-muted md:min-h-10";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx(fieldBase, className)} {...props} />;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="relative block">
      <select className={cx(fieldBase, "appearance-none pe-9", className)} {...props}>
        {children}
      </select>
      <svg
        className="pointer-events-none absolute inset-y-0 end-3 my-auto size-4 text-muted"
        viewBox="0 0 20 20"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden
      >
        <path strokeLinecap="round" strokeLinejoin="round" d="m5 8 5 5 5-5" />
      </svg>
    </span>
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx(fieldBase, "min-h-24 py-2 leading-relaxed", className)} {...props} />;
}

export function Field({
  label,
  required,
  hint,
  children,
}: {
  label: string;
  required?: boolean;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium text-ink-2">
        {label}
        {required && <span className="ms-1 text-accent-2">*</span>}
      </span>
      {children}
      {hint && <span className="mt-1.5 block text-xs leading-normal text-muted">{hint}</span>}
    </label>
  );
}

export function FormError({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <div role="alert" className="rounded-input border border-accent-2/60 bg-cotton px-4 py-3 text-sm text-accent-2">
      {message}
    </div>
  );
}

/** A cotton sheet: the one container for panels, forms and ledgers. */
export function Card({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cx("stock p-4 md:p-6", className)}>{children}</div>;
}

export function PageHeader({
  title,
  description,
  action,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-4 md:mb-8">
      <div className="min-w-0">
        <h1 className="text-ink">{title}</h1>
        {description && <p className="mt-2 text-base text-muted">{description}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function SectionTitle({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div className="mb-3 flex min-h-10 items-center justify-between gap-3">
      <h2 className="flex flex-wrap items-baseline gap-x-3 text-ink">{children}</h2>
      {action}
    </div>
  );
}

/** An empty slot pressed into the desk: says what belongs here and offers the one action that fills it. */
export function EmptyState({ title, description, action }: { title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="groove px-4 py-10 text-center">
      <p className="mx-auto font-medium text-ink-2">{title}</p>
      {description && <p className="mx-auto mt-1 max-w-[46ch] text-sm text-muted">{description}</p>}
      {action && <div className="mt-5 flex justify-center">{action}</div>}
    </div>
  );
}

type Tone = "neutral" | "blue" | "green" | "amber" | "red";

// Status is an outline in ink; coral ink only where money is owed or a date has passed.
const badgeTones: Record<Tone, string> = {
  neutral: "border-rule-2 text-ink-2",
  // Category labels (property type, reminder type, meter): a quiet tag, no outline.
  blue: "border-transparent bg-paper-2 text-ink-2",
  green: "border-rule text-muted",
  amber: "border-ink-2/70 text-ink",
  red: "border-accent-2/70 text-accent-2",
};

export function Badge({ tone = "neutral", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center whitespace-nowrap rounded-input border px-2 py-0.5 text-xs font-medium leading-normal",
        badgeTones[tone],
      )}
    >
      {children}
    </span>
  );
}

export function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2.5 text-sm">
      <dt className="text-muted">{label}</dt>
      <dd className="text-end font-medium text-ink">{value ?? "—"}</dd>
    </div>
  );
}
