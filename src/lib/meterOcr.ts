// Meter photo recognition: the prompt, the JSON schema Gemini must answer with, and a defensive
// parser for that answer. Pure and framework-free so client and server agree on the result shape;
// the network call itself lives in src/lib/gemini.ts (server only).

import { METER_TYPES, type MeterType, isKeyOf } from "@/lib/constants";

export type RecognitionConfidence = "high" | "medium" | "low";

export type MeterRecognition = {
  /** Meter kind seen in the photo; null when the model could not tell. */
  type: MeterType | null;
  /** Cumulative register value in kWh / m³, with the decimals the meter shows; null when unreadable. */
  reading: number | null;
  /** Serial number printed on the meter, when visible. */
  serialNumber: string | null;
  confidence: RecognitionConfidence;
  /** Short Hebrew note from the model when something is off (blurry, partial, not a meter). */
  note: string | null;
};

export type RecognizeMeterResult = { ok: true; result: MeterRecognition } | { ok: false; error: string };

/** Formats the browser may send. The client converts to JPEG first; HEIC is the fallback when it can't decode. */
export const METER_PHOTO_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic", "image/heif"] as const;
/** Stays under Vercel's 4.5 MB request cap and next.config's serverActions.bodySizeLimit. */
export const METER_PHOTO_MAX_BYTES = 4 * 1024 * 1024;
/** Longest side the client scales photos down to before upload. Enough to read meter digits. */
export const METER_PHOTO_MAX_DIMENSION = 1600;

export function isAllowedMeterPhotoType(type: string): boolean {
  return (METER_PHOTO_TYPES as readonly string[]).includes(type);
}

export const METER_RECOGNITION_PROMPT = `You are reading a photo of a utility meter in an Israeli rental apartment.
Decide whether it is an ELECTRICITY meter (kWh) or a WATER meter (cubic metres, m³) and read its cumulative register.

Rules:
- ELECTRICITY: read the main total consumption register in kWh. On digital meters use the total import register (often labelled 1.8.0 or "T"), not date, time, tariff or test screens. Include the decimal digits shown after a decimal point or in a separately coloured last box (e.g. 34489.94).
- WATER: the black/white number wheels are whole cubic metres; red wheels or red digits that follow them are decimal fractions (e.g. black 908, red 3 → 908.3). Ignore small pointer dials.
- Never return the meter's serial number, model number or year as the reading.
- Read every digit left to right. When a wheel is between two digits, use the lower one. Return the number without leading zeros.
- If the photo is not a meter, or the register cannot be read reliably, set reading to null.
- confidence: "high" only when every digit is sharp and unambiguous; "medium" when one digit needed judgement; otherwise "low".
- serialNumber: the meter's printed serial / ID number if clearly visible, otherwise null.
- note: one short sentence in Hebrew, only when something is wrong or uncertain (blurry, glare, cropped, not a meter); otherwise null.`;

/** Gemini `responseSchema` (OpenAPI subset) forcing a JSON answer of this exact shape. */
export const METER_RECOGNITION_SCHEMA = {
  type: "OBJECT",
  properties: {
    meterType: { type: "STRING", enum: ["ELECTRICITY", "WATER", "UNKNOWN"] },
    reading: { type: "NUMBER", nullable: true },
    serialNumber: { type: "STRING", nullable: true },
    confidence: { type: "STRING", enum: ["high", "medium", "low"] },
    note: { type: "STRING", nullable: true },
  },
  required: ["meterType", "reading", "confidence"],
  propertyOrdering: ["meterType", "reading", "serialNumber", "confidence", "note"],
} as const;

/** Largest value we accept as a reading; anything above is a misread (e.g. a serial number). */
const MAX_READING = 999_999_999;

function cleanString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed === "" || trimmed.toLowerCase() === "null" ? null : trimmed.slice(0, 200);
}

function parseReading(value: unknown): number | null {
  const number =
    typeof value === "number" ? value : typeof value === "string" ? Number(value.replace(/[\s,]/g, "")) : NaN;
  if (!Number.isFinite(number) || number < 0 || number > MAX_READING) return null;
  // Meters show at most a few decimal digits; this drops float noise like 908.3000000001.
  return Math.round(number * 1000) / 1000;
}

/**
 * Turns the model's JSON text into a MeterRecognition. Returns null when the text is not JSON
 * at all; individual bad fields degrade to null / "low" instead of failing the whole result.
 */
export function parseMeterRecognition(text: string): MeterRecognition | null {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }
  if (typeof raw !== "object" || raw === null) return null;
  const data = raw as Record<string, unknown>;

  const type = typeof data.meterType === "string" && isKeyOf(METER_TYPES, data.meterType) ? data.meterType : null;
  const reading = parseReading(data.reading);
  const confidence: RecognitionConfidence =
    data.confidence === "high" || data.confidence === "medium" ? data.confidence : "low";

  return {
    type,
    reading,
    serialNumber: cleanString(data.serialNumber),
    // An unreadable register is never "high" confidence, whatever the model says.
    confidence: reading == null ? "low" : confidence,
    note: cleanString(data.note),
  };
}
