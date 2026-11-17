import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "../../src/lib/db";
import { bootstrapAdmin } from "../../src/modules/authentication/bootstrap";
import { verifyPassword } from "better-auth/crypto";

const db = getDb();
afterAll(() => db.$disconnect());

describe("PostgreSQL", () => {
  it("speichert einen einzelnen Administrator atomar und hasht das Passwort", async () => {
    const email = `bootstrap-${randomUUID()}@example.invalid`;
    const secondEmail = `bootstrap-${randomUUID()}@example.invalid`;
    const password = "Synthetisches Testpasswort 2026";
    try {
      const results = await Promise.allSettled([
        bootstrapAdmin({ email, password, name: "Testkonto" }),
        bootstrapAdmin({ email: secondEmail, password, name: "Testkonto" }),
      ]);
      expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(1);
      const users = await db.user.findMany({ where: { email: { in: [email, secondEmail] } }, include: { accounts: true, audits: true } });
      expect(users).toHaveLength(1);
      expect(users[0].role).toBe("ADMIN");
      expect(users[0].accounts).toHaveLength(1);
      const hash = users[0].accounts[0].password;
      expect(hash).toBeTruthy();
      expect(hash).not.toBe(password);
      expect(await verifyPassword({ hash: hash!, password })).toBe(true);
      expect(users[0].audits.map((audit) => audit.action)).toContain("auth.admin_bootstrapped");
    } finally {
      await db.$transaction(async (tx) => {
        const users = await tx.user.findMany({ where: { email: { in: [email, secondEmail] } }, select: { id: true } });
        const ids = users.map(({ id }) => id);
        if (!ids.length) return;
        await tx.auditEvent.deleteMany({ where: { actorId: { in: ids } } });
        await tx.user.deleteMany({ where: { id: { in: ids } } });
        await tx.bootstrap.delete({ where: { id: "initial-admin" } });
      });
    }
  });

  it("weist ungültige Fremdschlüssel zurück und rollt die Transaktion zurück", async () => {
    const id = randomUUID();
    await expect(db.$transaction(async (tx) => {
      await tx.property.create({ data: {
        id, name: "Testobjekt", street: "Teststraße", houseNumber: "1",
        postalCode: "00000", city: "Testort", state: "HE", type: "OTHER", livingArea: "80.25",
      } });
      await tx.rentalUnit.create({ data: {
        propertyId: randomUUID(), label: "Nicht zugeordnet", livingArea: "60.25", use: "RESIDENTIAL",
      } });
    })).rejects.toMatchObject({ code: "P2003" });
    expect(await db.property.findUnique({ where: { id } })).toBeNull();
  });
});
