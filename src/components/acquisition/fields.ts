import type { AcquisitionLoan, AcquisitionProject, AcquisitionScenario, LoanExtraPayment } from "@/generated/prisma/client";
import { berlinToday } from "@/modules/stammdaten/calendar";
import { dateInput } from "@/modules/stammdaten/presentation";
import { propertyFields } from "@/components/stammdaten/fields";
import type { Choice, Field } from "@/components/stammdaten/form";

export const scenarios = { CONSERVATIVE: "Konservativ", BASE: "Basis", OPTIMISTIC: "Optimistisch" } as const;
const numeric = (name: string, label: string, value?: { toString(): string } | string, required = true): Field =>
  ({ name, label, type: "decimal", value: value?.toString(), required, maxLength: 20 });

export function projectFields(project?: AcquisitionProject): Field[] {
  return [
    ...propertyFields(project).map((field) => field.name === "purchasePrice" ? { ...field, required: true } : field),
    numeric("expectedAnnualRent", "Erwartete Jahresnettokaltmiete (EUR)", project?.expectedAnnualRent ?? "0"),
    numeric("vacancyRate", "Leerstand (%)", project?.vacancyRate ?? "0"),
    { name: "condition", label: "Zustand", type: "textarea", value: project?.condition, maxLength: 1500 },
    { name: "renovationNotes", label: "Sanierungsbedarf", type: "textarea", value: project?.renovationNotes, maxLength: 1500 },
  ];
}

export function scenarioFields(project: AcquisitionProject, scenario?: AcquisitionScenario): Field[] {
  return [
    { name: "assumptionsOn", label: "Annahmenstand", type: "date", value: dateInput(scenario?.assumptionsOn ?? berlinToday()), required: true },
    { name: "source", label: "Quelle und Annahmen", value: scenario?.source, maxLength: 500, hint: "Steuersätze und Schätzwerte anhand deiner Unterlagen eingeben." },
    numeric("transferTaxRate", "Grunderwerbsteuer (%)", scenario?.transferTaxRate),
    numeric("notaryRate", "Notar (%)", scenario?.notaryRate),
    numeric("registryRate", "Grundbuch (%)", scenario?.registryRate),
    numeric("brokerRate", "Makler (%)", scenario?.brokerRate),
    numeric("renovation", "Sanierung (EUR)", scenario?.renovation ?? "0"),
    numeric("otherCosts", "Sonstige Erwerbskosten (EUR)", scenario?.otherCosts ?? "0"),
    numeric("reserve", "Liquiditätsreserve (EUR)", scenario?.reserve ?? "0"),
    numeric("equity", "Eigenkapital (EUR)", scenario?.equity ?? "0"),
    numeric("annualRent", "Jahresnettokaltmiete (EUR)", scenario?.annualRent ?? project.expectedAnnualRent),
    numeric("vacancyRate", "Leerstand (%)", scenario?.vacancyRate ?? project.vacancyRate),
    numeric("lossRate", "Mietausfall nach Leerstand (%)", scenario?.lossRate ?? "0"),
    numeric("ownerCosts", "Jährliche Eigentümerkosten (EUR)", scenario?.ownerCosts ?? "0"),
    numeric("maintenance", "Jährliches Instandhaltungsbudget (EUR)", scenario?.maintenance ?? "0"),
  ];
}

export function loanFields(options: Choice[], loan?: AcquisitionLoan & { extraPayments: LoanExtraPayment[] }): Field[] {
  return [
    { name: "label", label: "Darlehensname", value: loan?.label, required: true, maxLength: 100 },
    ...(loan ? [] : [{ name: "refinancesId", label: "Anschlussfinanzierung für", type: "select", options: [{ value: "", label: "Erstfinanzierung" }, ...options] } satisfies Field]),
    numeric("principal", "Darlehensbetrag (EUR)", loan?.refinancesId ? undefined : loan?.principal, false),
    numeric("annualRate", "Sollzinssatz (%)", loan?.annualRate),
    numeric("initialRepayment", "Anfangstilgung (%)", loan?.initialRepayment),
    { name: "fixedMonths", label: "Zinsbindung in Monaten", type: "integer", value: String(loan?.fixedMonths ?? 120), required: true },
    { name: "extras", label: "Sondertilgungen", type: "textarea", maxLength: 4000,
      value: loan?.extraPayments.map((item) => item.month + ";" + item.amount.toFixed(2)).join("\n"),
      hint: "Eine Sondertilgung je Zeile als Monat;Betrag, etwa 12;2500,00. Bei Anschlussfinanzierung wird der Betrag aus der Restschuld übernommen." },
  ];
}
