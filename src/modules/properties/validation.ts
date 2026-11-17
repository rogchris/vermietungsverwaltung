import { z } from "zod";
import { PropertyType } from "@/generated/prisma/enums";
import { address, date, decimal, integer, optional, optionalText, requiredText } from "../stammdaten/validation";

export const states = {
  BW: "Baden-Württemberg", BY: "Bayern", BE: "Berlin", BB: "Brandenburg", HB: "Bremen", HH: "Hamburg",
  HE: "Hessen", MV: "Mecklenburg-Vorpommern", NI: "Niedersachsen", NW: "Nordrhein-Westfalen",
  RP: "Rheinland-Pfalz", SL: "Saarland", SN: "Sachsen", ST: "Sachsen-Anhalt", SH: "Schleswig-Holstein", TH: "Thüringen",
} as const;

export const propertyInput = z.object({
  name: requiredText(120),
  ...address,
  postalCode: z.string().trim().regex(/^\d{5}$/, "Bitte eine fünfstellige Postleitzahl eingeben."),
  state: z.enum(Object.keys(states) as (keyof typeof states)[]),
  type: z.enum(PropertyType),
  builtYear: optional(integer(1000, 9999)),
  landArea: optional(decimal(10)),
  livingArea: decimal(10),
  purchaseDate: optional(date),
  purchasePrice: optional(decimal(12)),
  description: optionalText(4000),
});
