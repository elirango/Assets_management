// Server-only call to the Gemini API (Google AI Studio key, free tier) that reads a meter photo.
// Plain fetch against the REST endpoint, so there is no SDK to keep in step with model releases.
// Imported only from server actions; the key never reaches the browser.

import { METER_RECOGNITION_PROMPT, METER_RECOGNITION_SCHEMA, type RecognizeMeterResult, parseMeterRecognition } from "@/lib/meterOcr";

/** Current stable Flash model on the free tier; override with GEMINI_MODEL when Google retires it. */
const DEFAULT_MODEL = "gemini-3.8-flash";
/**
 * Tried when the main model is overloaded (503), out of free quota (429) or too slow. The free tier
 * often answers "high demand" for the newest Flash; Flash-Lite has its own quota and reads digits fine.
 * Override with GEMINI_FALLBACK_MODEL, or set it to "none" to disable.
 */
const DEFAULT_FALLBACK_MODEL = "gemini-3.5-flash-lite";
/** The main model gets less time when a fallback is waiting behind it; the last attempt gets the full wait. */
const TIMEOUT_MS = 25_000;
const TIMEOUT_BEFORE_FALLBACK_MS = 15_000;

export function isMeterRecognitionConfigured(): boolean {
  return Boolean(process.env.GEMINI_API_KEY);
}

type GeminiResponse = {
  candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] }; finishReason?: string }[];
  promptFeedback?: { blockReason?: string };
  error?: { message?: string; status?: string };
};

/** A failed attempt; `retryable` means another model may still succeed. */
type Attempt = RecognizeMeterResult | { ok: false; error: string; retryable: true };

async function callModel(
  model: string,
  apiKey: string,
  mimeType: string,
  data: string,
  timeoutMs: number,
): Promise<Attempt> {
  const body = {
    contents: [{ role: "user", parts: [{ inlineData: { mimeType, data } }, { text: METER_RECOGNITION_PROMPT }] }],
    generationConfig: { responseMimeType: "application/json", responseSchema: METER_RECOGNITION_SCHEMA },
  };

  let response: Response;
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": apiKey },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
        cache: "no-store",
      },
    );
  } catch (error) {
    const timedOut = error instanceof DOMException && error.name === "TimeoutError";
    console.error(`Gemini ${model} request failed:`, timedOut ? `timed out after ${timeoutMs}ms` : error);
    return {
      ok: false,
      retryable: true,
      error: timedOut ? "שירות הזיהוי לא הגיב בזמן. נסו שוב." : "לא ניתן להתחבר לשירות הזיהוי. נסו שוב.",
    };
  }

  const payload = (await response.json().catch(() => ({}))) as GeminiResponse;

  if (!response.ok) {
    console.error(`Gemini ${model} error`, response.status, payload.error?.status, payload.error?.message);
    if (response.status === 429) {
      return {
        ok: false,
        retryable: true,
        error: "הגעתם למכסת הזיהוי החינמית של Gemini. נסו שוב בעוד דקה, או הזינו את הקריאה ידנית.",
      };
    }
    if (response.status >= 500) {
      return { ok: false, retryable: true, error: "שירות הזיהוי עמוס כרגע. נסו שוב בעוד רגע, או הזינו את הקריאה ידנית." };
    }
    if (response.status === 404) {
      return { ok: false, retryable: true, error: `מודל ${model} לא זמין. עדכנו את GEMINI_MODEL.` };
    }
    if (/API key/i.test(payload.error?.message ?? "")) {
      return { ok: false, error: "מפתח ה-API של Gemini אינו תקין. בדקו את GEMINI_API_KEY." };
    }
    return { ok: false, error: "שירות הזיהוי החזיר שגיאה. נסו שוב או הזינו את הקריאה ידנית." };
  }

  if (payload.promptFeedback?.blockReason) {
    return { ok: false, error: "התמונה נדחתה על ידי שירות הזיהוי. נסו תמונה אחרת." };
  }

  // Thinking models may return thought parts before the answer; the JSON is in the non-thought text.
  const text = (payload.candidates?.[0]?.content?.parts ?? [])
    .filter((part) => !part.thought && typeof part.text === "string")
    .map((part) => part.text)
    .join("");
  const result = parseMeterRecognition(text);
  if (!result) {
    console.error(`Gemini ${model} returned unparseable text`, text.slice(0, 500));
    return { ok: false, retryable: true, error: "לא התקבלה תשובה תקינה משירות הזיהוי. נסו שוב." };
  }
  return { ok: true, result };
}

export async function recognizeMeterImage(image: Blob): Promise<RecognizeMeterResult> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return { ok: false, error: "זיהוי תמונות לא מוגדר: חסר GEMINI_API_KEY בהגדרות השרת." };

  const primary = process.env.GEMINI_MODEL || DEFAULT_MODEL;
  const fallback = process.env.GEMINI_FALLBACK_MODEL || DEFAULT_FALLBACK_MODEL;
  const models = fallback === "none" || fallback === primary ? [primary] : [primary, fallback];

  const data = Buffer.from(await image.arrayBuffer()).toString("base64");
  let attempt: Attempt = { ok: false, error: "שירות הזיהוי לא זמין." };
  for (const [index, model] of models.entries()) {
    const timeout = index < models.length - 1 ? TIMEOUT_BEFORE_FALLBACK_MS : TIMEOUT_MS;
    attempt = await callModel(model, apiKey, image.type, data, timeout);
    if (attempt.ok || !("retryable" in attempt)) break;
  }
  return attempt.ok ? attempt : { ok: false, error: attempt.error };
}
