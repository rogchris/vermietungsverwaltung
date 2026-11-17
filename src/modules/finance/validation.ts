import { z } from "zod";
import { ExpenseCategory } from "@/generated/prisma/enums";
import { date, decimal, idSchema, optional, optionalText, requiredText } from "@/modules/stammdaten/validation";
import { Prisma } from "@/generated/prisma/client";

export const monthInput = z.string().regex(/^(19\d{2}|20\d{2}|21\d{2})-(0[1-9]|1[0-2])$/, "Bitte einen Monat von 1900 bis 2199 wählen.")
  .transform((value) => new Date(value + "-01T00:00:00.000Z"));
const amount = decimal(14).transform((value) => new Prisma.Decimal(value));
const positive = amount.refine((value) => value.gt(0), "Der Betrag muss größer als null sein.");
export const requestId = z.object({ id: idSchema });
export const generationInput = z.object({ period: monthInput, propertyId: optional(idSchema) });
export const allocationInput = z.object({ receivableId: idSchema, amount: positive });
export const paymentInput = requestId.extend({
  propertyId: idSchema, receivedOn: date, amount: positive, note: optionalText(500),
  allocations: z.array(allocationInput).max(30),
});
export const expenseInput = requestId.extend({
  propertyId: idSchema, unitId: optional(idSchema), paidOn: date, amount: positive, category: z.enum(ExpenseCategory),
  description: requiredText(500), vendor: optional(requiredText(160)),
});
export const voidInput = z.object({ id: idSchema, reason: requiredText(500) });
export const correctionInput = voidInput.extend({ baseRent: amount, operating: amount, heating: amount });
export const financeFilter = z.object({ period: monthInput, propertyId: optional(idSchema), scope: z.enum(["monat", "jahr"]) });
