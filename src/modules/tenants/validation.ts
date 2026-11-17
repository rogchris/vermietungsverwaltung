import { z } from "zod";
import { address, optional, requiredText } from "../stammdaten/validation";

export const tenantInput = z.object({
  firstName: requiredText(100),
  lastName: requiredText(100),
  ...address,
  postalCode: requiredText(20),
  countryCode: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Bitte einen zweistelligen Ländercode eingeben."),
  phone: optional(z.string().trim().max(40).regex(/^[+\d()./ -]+$/, "Bitte eine gültige Telefonnummer eingeben.")),
  email: optional(z.string().trim().max(254).pipe(z.email({ error: "Bitte eine gültige E-Mail-Adresse eingeben." }))),
});
