import { describe, expect, it } from "vitest";
import { allowsAccess } from "../../src/modules/authentication/policy";
import { adminInput, newPasswordSchema } from "../../src/modules/authentication/validation";

describe("Zugriffsregeln", () => {
  it("sperrt anonyme, nicht vollständig verifizierte und unbekannte Rollen", () => {
    expect(allowsAccess(null)).toBe(false);
    expect(allowsAccess({ user: { role: "ADMIN", twoFactorEnabled: true }, session: { mfaVerified: false } })).toBe(false);
    expect(allowsAccess({ user: { role: "ADMIN", twoFactorEnabled: false }, session: { mfaVerified: true } })).toBe(false);
    expect(allowsAccess({ user: { role: "UNKNOWN", twoFactorEnabled: true }, session: { mfaVerified: true } })).toBe(false);
  });

  it("gewährt bestätigten Betrachtern Lesezugriff, aber keine Adminrechte", () => {
    const user = { user: { role: "VIEWER", twoFactorEnabled: true }, session: { mfaVerified: true } };
    expect(allowsAccess(user)).toBe(true);
    expect(allowsAccess(user, true)).toBe(false);
    expect(allowsAccess({ ...user, user: { ...user.user, role: "ADMIN" } }, true)).toBe(true);
  });
});

describe("Konto-Eingaben", () => {
  it("normalisiert E-Mail-Adressen und weist eingeschleuste Rollen zurück", () => {
    const data = { name: " Testkonto ", email: "TEST@EXAMPLE.INVALID", password: "Ein ausschließlich synthetisches Passwort" };
    expect(adminInput.parse(data)).toMatchObject({ name: "Testkonto", email: "test@example.invalid" });
    expect(adminInput.safeParse({ ...data, role: "ADMIN" }).success).toBe(false);
    expect(adminInput.parse({ ...data, email: "  TEST@EXAMPLE.INVALID  " }).email).toBe("test@example.invalid");
  });

  it.each(["kurz", " ".repeat(14), "x".repeat(129)])("lehnt ungültige Passwörter ab (%j)", (input) => {
    expect(newPasswordSchema.safeParse(input).success).toBe(false);
  });
});
