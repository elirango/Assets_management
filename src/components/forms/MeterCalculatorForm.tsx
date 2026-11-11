"use client";

import { type ChangeEvent, useActionState, useEffect, useRef, useState } from "react";
import { PendingButton } from "@/components/forms/form-actions";
import { Badge, Button, Field, FormError, Input, cx } from "@/components/ui";
import { METER_TYPES, METER_UNITS, type MeterType, labelOf, toOptions } from "@/lib/constants";
import type { ActionState } from "@/lib/form";
import { formatCurrency } from "@/lib/format";
import { type MeterRecognition, type RecognizeMeterResult, type RecognitionConfidence } from "@/lib/meterOcr";
import { prepareMeterPhoto } from "@/lib/meterPhotoClient";
import { calculateMeterBill, meterFixedFeeApplies } from "@/lib/meters";

const meterTypeOptions = toOptions(METER_TYPES) as { value: MeterType; label: string }[];

/** Latest saved reading per meter type: seeds the previous reading, the rate and the fixed fee. */
export type LastReadings = Partial<Record<MeterType, { current: number; rate: number; fixedFee: number }>>;

const CONFIDENCE: Record<RecognitionConfidence, { label: string; tone: "green" | "amber" | "red" }> = {
  high: { label: "זיהוי ודאי", tone: "green" },
  medium: { label: "בדקו את הספרות", tone: "amber" },
  low: { label: "זיהוי לא ודאי", tone: "red" },
};

function toNumber(value: string): number | null {
  if (value.trim() === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function asText(value: number | undefined): string {
  return value?.toString() ?? "";
}

export function MeterCalculatorForm({
  action,
  recognize,
  lastReadings,
  today,
  recognitionEnabled,
  photoStorageEnabled,
}: {
  action: (state: ActionState, formData: FormData) => Promise<ActionState>;
  /** Server action that reads a meter photo with Gemini; saves nothing. */
  recognize: (formData: FormData) => Promise<RecognizeMeterResult>;
  lastReadings: LastReadings;
  /** YYYY-MM-DD, computed on the server so client and server agree on "today". */
  today: string;
  /** GEMINI_API_KEY is set on the server. */
  recognitionEnabled: boolean;
  /** BLOB_READ_WRITE_TOKEN is set, so the photo is kept with the reading. */
  photoStorageEnabled: boolean;
}) {
  const [state, formAction] = useActionState(action, {});
  const v = state.values ?? {};

  const [type, setType] = useState<MeterType>((v.type as MeterType) ?? "ELECTRICITY");
  const [previous, setPrevious] = useState(v.previous ?? asText(lastReadings[type]?.current));
  const [current, setCurrent] = useState(v.current ?? "");
  const [rate, setRate] = useState(v.rate ?? asText(lastReadings[type]?.rate));
  const [fixedFee, setFixedFee] = useState(v.fixedFee ?? asText(lastReadings[type]?.fixedFee || undefined));

  // Meter photo: kept in memory until the form is submitted, recognised right after it is picked.
  const fileInput = useRef<HTMLInputElement>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [recognizing, setRecognizing] = useState(false);
  const [recognition, setRecognition] = useState<MeterRecognition | null>(null);
  const [recognitionError, setRecognitionError] = useState<string | null>(null);
  /** The reading as filled in from the photo; the field stays highlighted until the user edits it. */
  const [aiReading, setAiReading] = useState<string | null>(null);

  useEffect(() => {
    if (!photoUrl) return;
    return () => URL.revokeObjectURL(photoUrl);
  }, [photoUrl]);

  function selectType(next: MeterType) {
    const seeded = lastReadings[type];
    const seed = lastReadings[next];
    setType(next);
    // Re-seed each field from the last saved reading of the new type, unless the user already typed something.
    if (previous === "" || previous === asText(seeded?.current)) setPrevious(asText(seed?.current));
    if (rate === "" || rate === asText(seeded?.rate)) setRate(asText(seed?.rate));
    if (fixedFee === "" || fixedFee === asText(seeded?.fixedFee || undefined)) {
      setFixedFee(asText(seed?.fixedFee || undefined));
    }
  }

  function clearPhoto() {
    setPhoto(null);
    setPhotoUrl(null);
    setRecognition(null);
    setRecognitionError(null);
    setAiReading(null);
  }

  async function handlePhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = ""; // let the same file be picked again
    if (!file) return;

    clearPhoto();
    const prepared = await prepareMeterPhoto(file);
    setPhoto(prepared);
    setPhotoUrl(URL.createObjectURL(prepared));
    if (!recognitionEnabled) return;

    setRecognizing(true);
    try {
      const formData = new FormData();
      formData.set("photo", prepared);
      const response = await recognize(formData);
      if (!response.ok) {
        setRecognitionError(response.error);
        return;
      }
      const { result } = response;
      setRecognition(result);
      if (result.type && result.type !== type) selectType(result.type);
      if (result.reading != null) {
        setCurrent(String(result.reading));
        setAiReading(String(result.reading));
      }
    } catch {
      setRecognitionError("הזיהוי נכשל. נסו שוב או הזינו את הקריאה ידנית.");
    } finally {
      setRecognizing(false);
    }
  }

  function submit(formData: FormData) {
    if (photo) formData.set("photo", photo);
    formAction(formData);
  }

  const showFixedFee = meterFixedFeeApplies(type);
  const unit = METER_UNITS[type];

  const prevNum = toNumber(previous);
  const currNum = toNumber(current);
  const rateNum = toNumber(rate);
  const feeNum = showFixedFee ? (toNumber(fixedFee) ?? 0) : 0;
  const readingsValid = prevNum != null && currNum != null && currNum >= prevNum;
  const bill =
    readingsValid && rateNum != null
      ? calculateMeterBill({ type, previous: prevNum, current: currNum, rate: rateNum, fixedFee: feeNum })
      : null;

  const currentFromPhoto = aiReading != null && current === aiReading;
  const recognizedBelowPrevious =
    recognition?.reading != null && prevNum != null && recognition.reading < prevNum;

  return (
    <form action={submit} className="space-y-4">
      <FormError message={state.error} />

      <section aria-label="תמונת מונה">
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          onChange={handlePhoto}
          className="sr-only"
          tabIndex={-1}
          aria-hidden
        />
        {photoUrl ? (
          <div className="grid items-start gap-3 sm:grid-cols-[minmax(0,13rem)_1fr]">
            <a
              href={photoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block overflow-hidden rounded-input border border-rule bg-paper-2"
              title="פתיחת התמונה בגודל מלא"
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- local object URL preview */}
              <img src={photoUrl} alt="תמונת המונה שהועלתה" className="h-52 w-full object-contain" />
            </a>
            <div className="space-y-2 text-sm" role="status" aria-live="polite">
              {recognizing ? (
                <p className="flex items-center gap-2 text-muted">
                  <span
                    className="size-4 animate-spin rounded-full border-2 border-rule-2 border-t-brand"
                    aria-hidden
                  />
                  מזהה את הקריאה מהתמונה…
                </p>
              ) : recognitionError ? (
                <p className="text-accent-2">{recognitionError}</p>
              ) : recognition ? (
                <RecognitionSummary recognition={recognition} />
              ) : (
                <p className="text-muted">התמונה תצורף לקריאה. הזינו את הקריאה ידנית.</p>
              )}
              {recognizedBelowPrevious && (
                <p className="text-accent-2">
                  הקריאה שזוהתה נמוכה מהקריאה הקודמת ({previous}). ייתכן שהזיהוי שגוי או שהמונה הוחלף — בדקו מול
                  התמונה.
                </p>
              )}
              {!photoStorageEnabled && (
                <p className="text-xs text-muted">אחסון תמונות לא מוגדר, לכן התמונה לא תישמר עם הקריאה.</p>
              )}
              <div className="flex flex-wrap gap-2 pt-1">
                <Button
                  type="button"
                  variant="secondary"
                  disabled={recognizing}
                  onClick={() => fileInput.current?.click()}
                  className="min-h-9! px-3 text-sm"
                >
                  החלפת תמונה
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  disabled={recognizing}
                  onClick={clearPhoto}
                  className="min-h-9! px-3 text-sm"
                >
                  הסרה
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-input border border-dashed border-rule-2 px-4 py-4 text-center">
            <Button type="button" variant="secondary" onClick={() => fileInput.current?.click()}>
              <svg
                className="size-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                aria-hidden
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.1l1.4-2h6l1.4 2h2.1A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"
                />
                <circle cx="12" cy="13" r="3.5" />
              </svg>
              צילום או העלאת תמונת מונה
            </Button>
            <p className="mt-2 text-xs leading-normal text-muted">
              {recognitionEnabled
                ? "סוג המונה והקריאה יזוהו אוטומטית וימולאו בטופס. בדקו אותם מול התמונה לפני השמירה."
                : "זיהוי אוטומטי כבוי (לא הוגדר GEMINI_API_KEY). התמונה תצורף כתיעוד בלבד."}
            </p>
          </div>
        )}
      </section>

      <fieldset>
        <legend className="mb-1.5 block text-sm font-medium text-ink-2">סוג מונה</legend>
        <div className="groove grid grid-cols-2 gap-1 p-1" role="radiogroup">
          {meterTypeOptions.map((option) => {
            const active = option.value === type;
            return (
              <label
                key={option.value}
                className={cx(
                  "flex min-h-9 cursor-pointer items-center justify-center rounded-input text-sm font-medium transition-colors duration-(--dur-micro) has-focus-visible:outline-2 has-focus-visible:outline-focus",
                  active ? "edge bg-cotton text-ink" : "text-ink-2 hover:bg-paper-3/70 hover:text-ink",
                )}
              >
                <input
                  type="radio"
                  name="type"
                  value={option.value}
                  checked={active}
                  onChange={() => selectType(option.value)}
                  className="sr-only"
                />
                {option.label}
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="grid grid-cols-2 gap-4">
        <Field label={`קריאה קודמת (${unit})`} required>
          <Input
            name="previous"
            type="number"
            inputMode="decimal"
            min="0"
            step="any"
            required
            value={previous}
            onChange={(event) => setPrevious(event.target.value)}
            dir="ltr"
            className="text-end"
          />
        </Field>
        <Field
          label={`קריאה נוכחית (${unit})`}
          required
          hint={currentFromPhoto ? "זוהה מהתמונה — ודאו מול התמונה" : undefined}
        >
          <Input
            name="current"
            type="number"
            inputMode="decimal"
            min={prevNum ?? 0}
            step="any"
            required
            value={current}
            onChange={(event) => setCurrent(event.target.value)}
            aria-invalid={(prevNum != null && currNum != null && currNum < prevNum) || undefined}
            dir="ltr"
            className={cx("text-end", currentFromPhoto && "border-mint-2! bg-mint!")}
          />
        </Field>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Field label={`תעריף ל-${unit} (₪)`} required>
          <Input
            name="rate"
            type="number"
            inputMode="decimal"
            min="0"
            step="0.0001"
            required
            value={rate}
            onChange={(event) => setRate(event.target.value)}
            dir="ltr"
            className="text-end"
          />
        </Field>
        {showFixedFee && (
          <Field label="תשלום קבוע (₪)" hint="למשל: תשלום קבוע של חברת החשמל">
            <Input
              name="fixedFee"
              type="number"
              inputMode="decimal"
              min="0"
              step="0.01"
              value={fixedFee}
              onChange={(event) => setFixedFee(event.target.value)}
              dir="ltr"
              className="text-end"
            />
          </Field>
        )}
      </div>

      <Field label="תאריך החיוב" required>
        <Input name="date" type="date" required defaultValue={v.date ?? today} className="sm:max-w-56" />
      </Field>

      <div
        role="status"
        aria-live="polite"
        className={cx(
          "rounded-input border px-4 py-3 text-sm",
          bill ? "border-rule bg-paper text-ink" : "border-dashed border-rule-2 text-muted",
        )}
      >
        {bill ? (
          <dl className="space-y-1">
            <div className="flex justify-between">
              <dt>צריכה</dt>
              <dd className="fig" dir="ltr">
                {bill.units} {unit}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt>צריכה × תעריף</dt>
              <dd className="fig">{formatCurrency(bill.usageCost)}</dd>
            </div>
            {showFixedFee && (
              <div className="flex justify-between">
                <dt>תשלום קבוע</dt>
                <dd className="fig">{formatCurrency(bill.fixedFee)}</dd>
              </div>
            )}
            <div className="flex justify-between border-t-2 border-ink/80 pt-2 text-base font-medium">
              <dt>סה״כ לחיוב</dt>
              <dd className="fig">{formatCurrency(bill.total)}</dd>
            </div>
          </dl>
        ) : prevNum != null && currNum != null && currNum < prevNum ? (
          "הקריאה הנוכחית חייבת להיות גדולה או שווה לקריאה הקודמת."
        ) : (
          "מלאו את הקריאות והתעריף כדי לראות את סכום החיוב."
        )}
      </div>

      <PendingButton className="w-full sm:w-auto sm:min-w-40">שמירת קריאה ויצירת חיוב</PendingButton>
    </form>
  );
}

function RecognitionSummary({ recognition }: { recognition: MeterRecognition }) {
  const confidence = CONFIDENCE[recognition.confidence];
  return (
    <>
      {recognition.reading != null ? (
        <p className="flex flex-wrap items-center gap-2 text-ink">
          <span>
            זוהתה קריאה:{" "}
            <strong className="fig font-medium" dir="ltr">
              {recognition.reading.toLocaleString("en-US")}
            </strong>{" "}
            {recognition.type ? METER_UNITS[recognition.type] : ""}
          </span>
          <Badge tone={confidence.tone}>{confidence.label}</Badge>
        </p>
      ) : (
        <p className="text-accent-2">לא זוהתה קריאה בתמונה. הזינו אותה ידנית.</p>
      )}
      <p className="text-muted">
        {recognition.type ? `מונה ${labelOf(METER_TYPES, recognition.type)}` : "סוג המונה לא זוהה"}
        {recognition.serialNumber && (
          <>
            {" · "}מס׳ מונה{" "}
            <span className="fig" dir="ltr">
              {recognition.serialNumber}
            </span>
          </>
        )}
      </p>
      {recognition.note && <p className="text-muted">{recognition.note}</p>}
    </>
  );
}
