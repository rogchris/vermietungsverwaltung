import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { ScenarioKind } from "@/generated/prisma/enums";
import { propertyInput } from "@/modules/properties/validation";
import { date, decimal, idSchema, integer, optional, optionalText, requiredText, versionSchema } from "@/modules/stammdaten/validation";

const amount = decimal(14).transform((text) => new Prisma.Decimal(text));
const price = decimal(12).transform((text) => new Prisma.Decimal(text)).refine((value) => value.gt(0), "Kaufpreis muss größer als null sein.");
const rate = z.string().trim().regex(/^\d{1,3}(?:[.,]\d{1,4})?$/, "Bitte einen Prozentsatz mit höchstens vier Nachkommastellen eingeben.")
  .transform((text) => new Prisma.Decimal(text.replace(",", "."))).refine((value) => value.lte(100), "Höchstens 100 Prozent.");
export const projectInput = propertyInput.extend({
  purchasePrice: price, expectedAnnualRent: amount, vacancyRate: rate, condition: optionalText(1500), renovationNotes: optionalText(1500),
});
export const scenarioInput = z.object({
  kind: z.enum(ScenarioKind), assumptionsOn: date, source: optionalText(500),
  transferTaxRate: rate, notaryRate: rate, registryRate: rate, brokerRate: rate, renovation: amount, otherCosts: amount, reserve: amount,
  equity: amount, annualRent: amount, vacancyRate: rate, lossRate: rate, ownerCosts: amount, maintenance: amount,
});
const extraLine = z.tuple([integer(1, 600), amount.refine((value) => value.gt(0), "Sondertilgung muss größer als null sein.")]);
export const loanInput = z.object({
  id: idSchema, label: requiredText(100), principal: optional(amount), annualRate: rate, initialRepayment: rate,
  fixedMonths: integer(1, 600), refinancesId: optional(idSchema),
  extras: optionalText(4000).transform((text, ctx) => {
    const entries: { month: number; amount: Prisma.Decimal }[] = [];
    for (const line of text.split(/\r?\n/).filter((line) => line.trim())) {
      const result = extraLine.safeParse(line.split(";"));
      if (!result.success) {
        ctx.addIssue({ code: "custom", message: "Sondertilgungen bitte als Monat;Betrag eingeben." });
        return z.NEVER;
      }
      entries.push({ month: result.data[0], amount: result.data[1] });
    }
    return entries;
  }),
}).superRefine((loan, ctx) => {
  if (!loan.initialRepayment.gt(0)) ctx.addIssue({ code: "custom", path: ["initialRepayment"], message: "Die Anfangstilgung muss größer als null sein." });
  if (!loan.refinancesId && (!loan.principal || !loan.principal.gt(0))) ctx.addIssue({ code: "custom", path: ["principal"], message: "Bitte einen positiven Darlehensbetrag eingeben." });
  const months = new Set(loan.extras.map((extra) => extra.month));
  if (months.size !== loan.extras.length || loan.extras.some((extra) => extra.month > loan.fixedMonths)) {
    ctx.addIssue({ code: "custom", path: ["extras"], message: "Nur ein Betrag pro Monat innerhalb der Zinsbindung." });
  }
});
export const acquireInput = z.object({ version: versionSchema, purchaseDate: date });
