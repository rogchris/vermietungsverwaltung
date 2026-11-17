import { z } from "zod";
import { ChargeMode, RentModel } from "@/generated/prisma/enums";
import { date, decimal, idSchema, integer, optional, optionalText } from "../stammdaten/validation";

export const leaseDetails = z.object({
  endsOn: optional(date),
  rentModel: z.enum(RentModel),
  dueDay: integer(1, 31),
  deposit: decimal(12),
  depositTerms: optionalText(2000),
});

const rentAmounts = z.object({
  baseRent: decimal(12),
  operatingCosts: decimal(12),
  operatingMode: z.enum(ChargeMode),
  heatingCosts: decimal(12),
  heatingMode: z.enum(ChargeMode),
});

function checkModes(data: z.output<typeof rentAmounts>, ctx: z.RefinementCtx) {
  if (data.operatingMode === "NONE" && /[1-9]/.test(data.operatingCosts)) {
    ctx.addIssue({ code: "custom", path: ["operatingCosts"], message: "Bei „Keine“ muss der Betrag 0 sein." });
  }
  if (data.heatingMode === "NONE" && /[1-9]/.test(data.heatingCosts)) {
    ctx.addIssue({ code: "custom", path: ["heatingCosts"], message: "Bei „Keine“ muss der Betrag 0 sein." });
  }
}

export const leaseInput = leaseDetails.extend(rentAmounts.shape).extend({
  startsOn: date,
  tenantIds: z.array(idSchema).min(1, "Bitte mindestens eine Vertragspartei wählen.").max(20),
}).superRefine((data, ctx) => {
  checkModes(data, ctx);
  if (data.endsOn && data.endsOn < data.startsOn) {
    ctx.addIssue({ code: "custom", path: ["endsOn"], message: "Das Vertragsende liegt vor dem Vertragsbeginn." });
  }
  if (new Set(data.tenantIds).size !== data.tenantIds.length) {
    ctx.addIssue({ code: "custom", path: ["tenantIds"], message: "Eine Vertragspartei wurde mehrfach gewählt." });
  }
});

export const conditionInput = rentAmounts.extend({ effectiveFrom: date }).superRefine(checkModes);
