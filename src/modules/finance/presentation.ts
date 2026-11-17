import { berlinToday } from "@/modules/stammdaten/calendar";
import { financeFilter } from "./validation";

export const categories = {
  MAINTENANCE: "Instandhaltung", INSURANCE: "Versicherung", MANAGEMENT: "Verwaltung", FINANCING: "Finanzierung",
  OPERATING: "Betriebskosten", MODERNIZATION: "Modernisierung", OTHER: "Sonstige Kosten",
} as const;

export function financeSelection(params: Record<string, unknown>) {
  const fallback = berlinToday().toISOString().slice(0, 7);
  const month = typeof params.monat === "string" ? params.monat : fallback;
  const parsed = financeFilter.safeParse({ period: month, propertyId: params.objekt ?? "", scope: params.zeitraum ?? "monat" });
  const { period, propertyId, scope } = parsed.success ? parsed.data : financeFilter.parse({ period: fallback, propertyId: "", scope: "monat" });
  const selected = period.toISOString().slice(0, 7);
  const start = new Date(period);
  if (scope === "jahr") start.setUTCMonth(0);
  return { selected, start, propertyId, scope, months: scope === "jahr" ? 12 : 1,
    query: "?monat=" + selected + (propertyId ? "&objekt=" + propertyId : "") + (scope === "jahr" ? "&zeitraum=jahr" : "") };
}
