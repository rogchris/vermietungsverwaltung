import { z } from "zod";
import { idSchema } from "@/modules/stammdaten/validation";
import { evidenceKeys, sectionKeys } from "./options";

export const bankInput = z.object({
  id: idSchema,
  sections: z.array(z.enum(sectionKeys)).max(sectionKeys.length).transform((selected) => sectionKeys.filter((key) => key === "documents" || selected.includes(key))),
  evidence: z.record(z.enum(evidenceKeys), z.union([z.literal(""), idSchema])),
  appendices: z.array(idSchema).max(12).default([]).transform((ids) => [...new Set(ids)]),
  riskNotes: z.string().trim().max(1800),
  rentRows: z.string().trim().max(6000).transform((input, ctx) => {
    const lines = input.split(/\r?\n/).filter((line) => line.trim());
    const result: { unit: string; status: "vermietet" | "leer" | "geplant"; monthly: string; source: "entered" | "estimate" }[] = [];
    if (lines.length > 50) { ctx.addIssue({ code: "custom", message: "Höchstens 50 Mietpositionen." }); return z.NEVER; }
    for (const [index, line] of lines.entries()) {
      const [unit, status, amount, source, extra] = line.split("|").map((value) => value.trim());
      if (!unit || unit.length > 80 || (status !== "vermietet" && status !== "leer" && status !== "geplant") ||
          !amount || !/^\d{1,10}([,.]\d{1,2})?$/.test(amount) || (source !== "Angabe" && source !== "Schätzung") || extra !== undefined) {
        ctx.addIssue({ code: "custom", message: "Ungültige Mietposition in Zeile " + (index + 1) + "." });
        return z.NEVER;
      }
      result.push({ unit, status, monthly: amount.replace(",", "."), source: source === "Angabe" ? "entered" : "estimate" });
    }
    return result;
  }),
});

export type BankInput = z.output<typeof bankInput>;

