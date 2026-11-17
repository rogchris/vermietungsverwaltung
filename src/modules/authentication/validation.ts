import { z } from "zod";

export const emailSchema = z.string().trim().toLowerCase().max(254).pipe(z.email());
export const newPasswordSchema = z.string().min(14).max(128)
  .refine((value) => value.trim().length > 0, "Passwort darf nicht nur aus Leerzeichen bestehen.");
export const adminInput = z.object({
  name: z.string().trim().min(1).max(120),
  email: emailSchema,
  password: newPasswordSchema,
}).strict();

export const mfaVerificationPaths = new Set(["/two-factor/verify-totp", "/two-factor/verify-backup-code"]);
