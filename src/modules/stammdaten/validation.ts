import { z } from "zod";

export const idSchema = z.uuid();
export const versionSchema = z.string().regex(/^\d{1,10}$/).transform(Number).pipe(z.int().min(0).max(2_147_483_646));
export const requiredText = (max: number) => z.string().trim().min(1, "Bitte ausfüllen.").max(max, `Höchstens ${max} Zeichen.`);
export const optionalText = (max: number) => z.string().trim().max(max, `Höchstens ${max} Zeichen.`);
export const integer = (min: number, max: number) =>
  z.string().trim().regex(/^\d+$/, "Bitte eine ganze Zahl eingeben.").transform(Number).pipe(z.int().min(min, `Mindestens ${min}.`).max(max, `Höchstens ${max}.`));
export const decimal = (digits: number) => z.string().trim()
  .regex(new RegExp(`^\\d{1,${digits}}(?:[.,]\\d{1,2})?$`), "Bitte eine positive Zahl mit bis zu zwei Nachkommastellen eingeben. Null ist zulässig.")
  .transform((value) => value.replace(",", "."));
export const optional = <T extends z.ZodType>(schema: T) => z.union([z.literal("").transform(() => null), schema]);
export const date = z.iso.date({ error: "Bitte ein gültiges Datum eingeben." }).transform((value) => new Date(value + "T00:00:00.000Z"));
export const address = {
  street: requiredText(120),
  houseNumber: requiredText(20),
  city: requiredText(100),
};
