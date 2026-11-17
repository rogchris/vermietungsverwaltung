import type { Prisma } from "@/generated/prisma/client";

export const propertyTypes = {
  SINGLE_FAMILY: "Einfamilienhaus", MULTI_FAMILY: "Mehrfamilienhaus", CONDOMINIUM: "Eigentumswohnung",
  MIXED_USE: "Gemischt genutzt", OTHER: "Sonstiges",
} as const;
export const unitStatuses = {
  RENTED: "Vermietet", VACANT: "Leerstehend", RENOVATION: "Renovierung", UNRENTABLE: "Nicht vermietbar", ARCHIVED: "Archiviert",
} as const;
export const unitUses = {
  RESIDENTIAL: "Wohnen", COMMERCIAL: "Gewerbe", PARKING: "Stellplatz", OTHER: "Sonstiges",
} as const;
export const rentModels = { FIXED: "Festmiete", INDEXED: "Indexmiete", STEPPED: "Staffelmiete" } as const;
export const chargeModes = { ADVANCE: "Vorauszahlung", FLAT_RATE: "Pauschale", NONE: "Keine" } as const;
export const archiveChoices = { aktiv: "Aktiv", archiviert: "Archiviert", alle: "Alle" } as const;
export const leaseStates = { alle: "Alle", laufend: "Laufend", zukuenftig: "Zukünftig", beendet: "Beendet" } as const;

export function choices(values: Record<string, string>) {
  return Object.entries(values).map(([value, label]) => ({ value, label }));
}

const germanDay = new Intl.DateTimeFormat("de-DE", { timeZone: "UTC", dateStyle: "medium" });
const germanInteger = new Intl.NumberFormat("de-DE");

export function dateInput(value?: Date | null) {
  return value?.toISOString().slice(0, 10) ?? "";
}

export function displayDate(value?: Date | null) {
  return value ? germanDay.format(value) : "–";
}

export function displayPeriod(startsOn: Date, endsOn: Date | null) {
  return `${displayDate(startsOn)} – ${endsOn ? displayDate(endsOn) : "unbefristet"}`;
}

export function displayDecimal(value: Prisma.Decimal | null | undefined, unit: string) {
  if (value == null) return "–";
  const [integer, fraction] = value.abs().toFixed(2).split(".");
  const sign = value.isNegative() ? "-" : "";
  return `${sign}${germanInteger.format(BigInt(integer))},${fraction}${unit ? " " + unit : ""}`;
}

export function leaseStatus(startsOn: Date, endsOn: Date | null, today: Date) {
  return startsOn > today ? leaseStates.zukuenftig : endsOn && endsOn < today ? leaseStates.beendet : leaseStates.laufend;
}
