"use client";

import { useEffect, useRef, useState } from "react";
import { ChargeList } from "@/components/charge-list";
import { Button, EmptyState, cx } from "@/components/ui";
import { formatCurrency } from "@/lib/format";
import {
  type MessageCharge,
  type MessageLanguage,
  generatePaymentMessage,
  whatsappLink,
} from "@/lib/messageGenerator";

const COPIED_FEEDBACK_MS = 2000;

/**
 * Open-charges list with per-row selection, "select all", and the WhatsApp message generator.
 * The message is built client-side from the enriched charges the server page passes in.
 */
export function PaymentMessagePanel({
  charges,
  tenantName,
  tenantPhone,
  propertyName,
  readOnly = false,
}: {
  charges: MessageCharge[];
  tenantName: string;
  tenantPhone: string | null;
  propertyName: string | null;
  /** Viewer role: charges cannot be marked paid or deleted, but the message can still be generated. */
  readOnly?: boolean;
}) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [language, setLanguage] = useState<MessageLanguage>("he");
  const [message, setMessage] = useState("");
  const [copied, setCopied] = useState<"idle" | "done" | "failed">("idle");
  const dialogRef = useRef<HTMLDialogElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Charges can disappear underneath us (marked paid / deleted); drop stale selections.
  const chargeIds = new Set(charges.map((charge) => charge.id));
  const selected = charges.filter((charge) => selectedIds.has(charge.id));
  const allSelected = charges.length > 0 && selected.length === charges.length;
  const selectedTotal = selected.reduce((sum, charge) => sum + charge.amount, 0);

  function toggle(id: string) {
    setSelectedIds((previous) => {
      const next = new Set([...previous].filter((selectedId) => chargeIds.has(selectedId)));
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    setSelectedIds(allSelected ? new Set() : new Set(charges.map((charge) => charge.id)));
  }

  function buildMessage(nextLanguage: MessageLanguage) {
    return generatePaymentMessage(selected, { language: nextLanguage, tenantName, propertyName });
  }

  function openPreview() {
    setMessage(buildMessage(language));
    setCopied("idle");
    dialogRef.current?.showModal();
  }

  function switchLanguage(nextLanguage: MessageLanguage) {
    setLanguage(nextLanguage);
    setMessage(buildMessage(nextLanguage));
    setCopied("idle");
  }

  async function copyMessage() {
    try {
      await navigator.clipboard.writeText(message);
      setCopied("done");
      return;
    } catch {
      // Clipboard API can be unavailable (insecure context, embedded webview, denied permission).
    }
    // Legacy path: select the text and let the browser copy it under the click's user gesture.
    textareaRef.current?.select();
    let legacyCopied = false;
    try {
      legacyCopied = document.execCommand("copy");
    } catch {
      legacyCopied = false;
    }
    setCopied(legacyCopied ? "done" : "failed");
  }

  useEffect(() => {
    if (copied === "idle") return;
    const timer = setTimeout(() => setCopied("idle"), COPIED_FEEDBACK_MS);
    return () => clearTimeout(timer);
  }, [copied]);

  const waLink = whatsappLink(tenantPhone, message);

  if (charges.length === 0) {
    return (
      <EmptyState title="אין חיובים פתוחים" description="חיובי ארנונה, ועד בית ומונים יופיעו כאן עד שיסומנו כשולמו." />
    );
  }

  return (
    <div className="space-y-3">
      {charges.length > 1 && (
        <label className="flex min-h-9 w-fit cursor-pointer items-center gap-2 text-sm text-ink-2">
          <input
            type="checkbox"
            checked={allSelected}
            onChange={toggleAll}
            className="size-5 accent-brand"
          />
          בחר הכל ({charges.length})
        </label>
      )}

      <ChargeList charges={charges} selectedIds={selectedIds} onToggle={toggle} readOnly={readOnly} />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted" aria-live="polite">
          {selected.length === 0
            ? "בחרו חיובים כדי ליצור הודעת תשלום."
            : `נבחרו ${selected.length} חיובים, סה״כ ${formatCurrency(selectedTotal)}`}
        </p>
        <Button type="button" onClick={openPreview} disabled={selected.length === 0} className="w-full sm:w-auto">
          צור הודעת תשלום
        </Button>
      </div>

      <dialog
        ref={dialogRef}
        dir="rtl"
        aria-labelledby="payment-message-title"
        onClick={(event) => {
          // Clicks on the backdrop (outside the panel) close the dialog.
          if (event.target === dialogRef.current) dialogRef.current?.close();
        }}
        className="stock m-auto w-[calc(100%-2rem)] max-w-lg p-0 open:flex open:flex-col"
      >
        <div className="flex items-center justify-between gap-3 border-b border-rule px-5 py-4">
          <h2 id="payment-message-title" className="text-section text-ink">
            הודעת תשלום
          </h2>
          <div className="groove flex gap-1 p-1 text-sm" role="group" aria-label="שפת ההודעה">
            {(["he", "en"] as const).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => switchLanguage(option)}
                aria-pressed={language === option}
                className={cx(
                  "min-h-8 rounded-input px-3 font-medium transition-colors duration-(--dur-micro)",
                  language === option ? "edge bg-cotton text-ink" : "text-ink-2 hover:bg-paper-3/70 hover:text-ink",
                )}
              >
                {option === "he" ? "עברית" : "English"}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-4">
          <label className="mb-1.5 block text-sm font-medium text-ink-2" htmlFor="payment-message-text">
            ניתן לערוך את הטקסט לפני ההעתקה
          </label>
          <textarea
            id="payment-message-text"
            ref={textareaRef}
            value={message}
            onChange={(event) => {
              setMessage(event.target.value);
              setCopied("idle");
            }}
            dir={language === "he" ? "rtl" : "ltr"}
            rows={14}
            className="w-full resize-y rounded-input border border-muted/60 bg-paper p-3 font-sans text-base leading-relaxed text-ink hover:border-muted focus-visible:border-focus focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-focus/40"
          />
          {copied === "failed" && (
            <p className="mt-1.5 text-sm text-accent-2">לא ניתן להעתיק אוטומטית. הטקסט סומן, לחצו Ctrl+C.</p>
          )}
        </div>

        <div className="flex flex-col-reverse gap-2 border-t border-rule px-5 py-4 sm:flex-row sm:justify-end">
          <Button type="button" variant="secondary" onClick={() => dialogRef.current?.close()}>
            סגירה
          </Button>
          {waLink && (
            <a
              href={waLink}
              target="_blank"
              rel="noopener noreferrer"
              className="press edge inline-flex min-h-11 items-center justify-center gap-2 rounded-card bg-cotton px-4 text-base font-medium text-print hover:edge-lift md:min-h-10"
            >
              פתיחה בוואטסאפ
            </a>
          )}
          <Button type="button" onClick={copyMessage} className="min-w-32">
            {copied === "done" ? "הועתק!" : "העתק הודעה"}
          </Button>
        </div>
      </dialog>
    </div>
  );
}
