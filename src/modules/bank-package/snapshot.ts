import { Prisma, type AcquisitionProject, type AcquisitionScenario, type Document } from "@/generated/prisma/client";
import { acquisitionScenario } from "@/modules/acquisition/calculation";
import { zero } from "@/modules/finance/calculation";
import type { LoanAssumption } from "@/modules/financing/amortization";
import { evidenceKeys, scenarioKeys, scenarioNames, type provenance } from "./options";
import type { BankInput } from "./validation";

export type RentRow = { unit: string; status: "vermietet" | "leer" | "geplant" | "keine aktive Vertragsmiete"; monthly: string | null; source: "entered" | "estimate"; effectiveFrom?: string };
type Loan = LoanAssumption & { id: string; refinancesId: string | null };
type Scenario = AcquisitionScenario & { loans: Loan[] };
type File = Pick<Document, "id" | "filename" | "type" | "sha256" | "size" | "mime" | "createdAt" | "description"> & { available: boolean };
type Frozen<T> = T extends Prisma.Decimal | Date ? string : T extends ReadonlyArray<infer V> ? Frozen<V>[] : T extends object ? { [K in keyof T]: Frozen<T[K]> } : T;

function frozen<T>(data: T): Frozen<T> {
  return JSON.parse(JSON.stringify(data)) as Frozen<T>;
}

export function createBankPayload(project: AcquisitionProject, scenarios: Scenario[], files: File[], rents: RentRow[], input: BankInput, on: Date) {
  const attachments = files.map((file, index) => ({ ...file, reference: "A" + String(index + 1).padStart(2, "0") }));
  const checklist = evidenceKeys.map((key) => ({
    key, assignedAttachmentId: input.evidence[key] || null, attachmentId: attachments.find((file) => file.id === input.evidence[key] && file.available)?.id ?? null,
  }));
  const modeled = scenarioKeys.flatMap((kind) => {
    const scenario = scenarios.find((row) => row.kind === kind);
    if (!scenario) return [];
    const { loans, ...assumptions } = scenario;
    return [{ kind, assumptions, loans, result: acquisitionScenario(project.purchasePrice, assumptions, loans) }];
  });

  const risks: { text: string; source: keyof typeof provenance }[] = [];
  for (const key of scenarioKeys) {
    const scenario = modeled.find((item) => item.kind === key);
    if (!scenario) {
      risks.push({ text: "Szenario " + scenarioNames[key] + " fehlt.", source: "calculated" });
      continue;
    }
    const { result, loans } = scenario;
    if (result.gap.gt(0)) risks.push({ text: scenarioNames[key] + ": Finanzierungslücke.", source: "calculated" });
    if (result.cashflow.lt(0)) risks.push({ text: scenarioNames[key] + ": negativer Cashflow im ersten Jahr.", source: "calculated" });
    if (result.schedules.some((plan, index) => plan.outstanding.gt(0) && !loans.some((loan) => loan.refinancesId === loans[index].id))) {
      risks.push({ text: scenarioNames[key] + ": Restschuld ohne erfasste Anschlussfinanzierung.", source: "calculated" });
    }
  }
  if (!rents.length) risks.push({ text: "Keine Mietpositionen erfasst. Die Ertragsrechnung verwendet die Szenarioannahmen.", source: "calculated" });
  if (rents.some((row) => row.status === "vermietet" && row.monthly === null)) {
    risks.push({ text: "Für mindestens eine vermietete Einheit fehlt eine gültige Mietkondition.", source: "calculated" });
  }
  if (checklist.some((item) => !item.attachmentId)) risks.push({ text: "Die Nachweisprüfung enthält offene Unterlagen.", source: "calculated" });
  if (input.riskNotes) risks.push({ text: input.riskNotes, source: "entered" });

  const actual = rents.filter((row) => row.status === "vermietet" && row.source === "entered");
  const monthly = actual.reduce((total, row) => total.plus(row.monthly ?? "0"), zero);
  const planningMonthly = rents.reduce((total, row) => total.plus(row.monthly ?? "0"), zero);
  const rentSummary = {
    currentMonthly: actual.length && actual.every((row) => row.monthly !== null) ? monthly : null,
    currentAnnual: actual.length && actual.every((row) => row.monthly !== null) ? monthly.times(12) : null,
    planningAnnual: rents.length && rents.every((row) => row.monthly !== null) ? planningMonthly.times(12) : null,
  };
  const rentOrigin = input.rentRows.length ? "manual" : project.acquiredPropertyId ? "portfolio" : "none";
  return frozen({ on, project, appendices: input.appendices, rentOrigin, sections: input.sections, checklist, attachments, rents, rentSummary, risks, scenarios: modeled });
}

export type BankPayload = ReturnType<typeof createBankPayload>;
