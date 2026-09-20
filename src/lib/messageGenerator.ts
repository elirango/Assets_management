// Builds the WhatsApp-ready payment message for a set of charges.
// Pure and framework-free so the client modal and any server code produce identical text.

import { METER_TYPES, METER_UNITS, type MeterType } from "@/lib/constants";
import { roundMoney } from "@/lib/meters";

/** A charge enriched with its meter reading when it came from the meter calculator. */
export type MessageCharge = {
  id: string;
  description: string;
  amount: number;
  date: Date;
  meter?: {
    type: MeterType;
    previous: number;
    current: number;
    units: number;
    unitLabel: string;
  } | null;
};

export type MessageLanguage = "he" | "en";

export type MessageOptions = {
  language: MessageLanguage;
  tenantName: string;
  propertyName?: string | null;
};

type MinimalCharge = { id: string; description: string; amount: number; date: Date };
type MinimalReading = { id: string; type: string; previous: number; current: number; totalAmount: number; date: Date };

/**
 * Charge and MeterReading are not linked in the schema. A meter charge is created in the same
 * transaction as its reading with the same tenant, date and amount, and a description that
 * names the meter type — that is enough to pair them. Each reading is used at most once.
 */
export function attachMeterReadings(charges: MinimalCharge[], readings: MinimalReading[]): MessageCharge[] {
  const unused = [...readings];

  return charges.map((charge) => {
    const type = meterTypeFromDescription(charge.description);
    if (!type) return { ...charge, meter: null };

    const index = unused.findIndex(
      (reading) =>
        reading.type === type &&
        reading.date.getTime() === charge.date.getTime() &&
        roundMoney(reading.totalAmount) === roundMoney(charge.amount),
    );
    if (index === -1) return { ...charge, meter: null };

    const [reading] = unused.splice(index, 1);
    return {
      ...charge,
      meter: {
        type,
        previous: reading.previous,
        current: reading.current,
        units: roundMoney(reading.current - reading.previous),
        unitLabel: METER_UNITS[type],
      },
    };
  });
}

function meterTypeFromDescription(description: string): MeterType | null {
  for (const key of Object.keys(METER_TYPES) as MeterType[]) {
    if (description.startsWith(`חיוב ${METER_TYPES[key]}`)) return key;
  }
  return null;
}

const METER_ICON: Record<MeterType, string> = { ELECTRICITY: "⚡", WATER: "💧" };
const METER_NAME_EN: Record<MeterType, string> = { ELECTRICITY: "Electricity", WATER: "Water" };
const UNIT_EN: Record<MeterType, string> = { ELECTRICITY: "kWh", WATER: "m³" };
const SEPARATOR = "──────────────";

/** "₪1,234.5" — plain text, no bidi marks, so it pastes cleanly into WhatsApp. */
export function formatMessageAmount(amount: number): string {
  return `₪${roundMoney(amount).toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function formatMessageDate(date: Date, language: MessageLanguage): string {
  return new Intl.DateTimeFormat(language === "he" ? "he-IL" : "en-GB", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

function formatNumber(value: number): string {
  return value.toLocaleString("en-US", { maximumFractionDigits: 2 });
}

export function generatePaymentMessage(charges: MessageCharge[], options: MessageOptions): string {
  const { language, tenantName, propertyName } = options;
  const total = roundMoney(charges.reduce((sum, charge) => sum + charge.amount, 0));
  const lines: string[] = [];

  if (language === "he") {
    lines.push(`שלום ${tenantName},`);
    lines.push(propertyName ? `להלן פירוט התשלומים עבור ${propertyName}:` : "להלן פירוט התשלומים:");
  } else {
    lines.push(`Hello ${tenantName},`);
    lines.push(propertyName ? `Here is the payment breakdown for ${propertyName}:` : "Here is the payment breakdown:");
  }
  lines.push("");

  for (const charge of charges) {
    if (charge.meter) {
      const { type, previous, current, units } = charge.meter;
      if (language === "he") {
        lines.push(`${METER_ICON[type]} ${charge.description}`);
        lines.push(`קריאה קודמת: ${formatNumber(previous)} ${METER_UNITS[type]}`);
        lines.push(`קריאה נוכחית: ${formatNumber(current)} ${METER_UNITS[type]}`);
        lines.push(`צריכה: ${formatNumber(units)} ${METER_UNITS[type]}`);
        lines.push(`סכום: ${formatMessageAmount(charge.amount)}`);
      } else {
        lines.push(`${METER_ICON[type]} ${METER_NAME_EN[type]} bill (${formatMessageDate(charge.date, "en")})`);
        lines.push(`Previous reading: ${formatNumber(previous)} ${UNIT_EN[type]}`);
        lines.push(`Current reading: ${formatNumber(current)} ${UNIT_EN[type]}`);
        lines.push(`Consumption: ${formatNumber(units)} ${UNIT_EN[type]}`);
        lines.push(`Amount: ${formatMessageAmount(charge.amount)}`);
      }
    } else if (language === "he") {
      lines.push(`🏠 ${charge.description}`);
      lines.push(`סכום: ${formatMessageAmount(charge.amount)}`);
    } else {
      lines.push(`🏠 ${translateManualDescription(charge.description)} (${formatMessageDate(charge.date, "en")})`);
      lines.push(`Amount: ${formatMessageAmount(charge.amount)}`);
    }
    lines.push("");
  }

  lines.push(SEPARATOR);
  lines.push(language === "he" ? `סה"כ לתשלום: ${formatMessageAmount(total)}` : `Total to pay: ${formatMessageAmount(total)}`);
  lines.push("");
  lines.push(language === "he" ? "תודה 🙏" : "Thank you 🙏");

  return lines.join("\n");
}

/** Best-effort English for the auto-generated Hebrew descriptions; unknown text passes through. */
function translateManualDescription(description: string): string {
  const manual = description.match(/^(ועד בית|ארנונה), (?:(\d+) חודשים|חודש אחד)$/);
  if (manual) {
    const label = manual[1] === "ועד בית" ? "HOA fee" : "Property tax";
    const months = manual[2] ? Number(manual[2]) : 1;
    return `${label}, ${months} ${months === 1 ? "month" : "months"}`;
  }
  return description;
}

/** WhatsApp click-to-chat link; Israeli local numbers (05x…) become +9725x…. Null when the phone is unusable. */
export function whatsappLink(phone: string | null | undefined, message: string): string | null {
  if (!phone) return null;
  let digits = phone.replace(/\D/g, "");
  if (digits.startsWith("00")) digits = digits.slice(2);
  else if (digits.startsWith("0")) digits = `972${digits.slice(1)}`;
  if (digits.length < 9) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
