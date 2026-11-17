import { afterAll, expect, it } from "vitest";
import { getDb } from "../../src/lib/db";
import { anonymizeArchivedTenant, setTenantArchived } from "../../src/modules/tenants/service";
import { scanDocument } from "../../src/modules/documents/inspection";
import { masterDataFixture } from "../support/master-data-fixture";
import { saveTenant } from "../../src/modules/tenants/service";

const db = getDb();
afterAll(() => db.$disconnect());

it("anonymisiert ausschließlich archivierte Kontakte und erhält die Referenz", async () => {
  const user = await masterDataFixture();
  try {
    const id = crypto.randomUUID();
    await saveTenant(user.id, id, { firstName: "Test", lastName: "Person", street: "Testweg", houseNumber: "1", postalCode: "00000",
      city: "Testort", countryCode: "DE", phone: "00000", email: "test@example.invalid" });
    await expect(anonymizeArchivedTenant(user.id, id, 0)).rejects.toThrow();
    await setTenantArchived(user.id, id, 0, true);
    await anonymizeArchivedTenant(user.id, id, 1);
    expect(await db.tenant.findUnique({ where: { id } })).toMatchObject({
      id, anonymizedAt: expect.any(Date), firstName: "Anonymisiert", street: "", phone: null, email: null,
    });
    await expect(setTenantArchived(user.id, id, 2, false)).rejects.toThrow();
    expect(await db.auditEvent.count({ where: { targetId: id, action: "tenant.anonymized" } })).toBe(1);
  } finally { await user.dispose(); }
});

it("verweigert einen vorgeschriebenen Scan ohne Scanner", async () => {
  process.env.REQUIRE_MALWARE_SCAN = "1";
  try { await expect(scanDocument(Buffer.from("synthetisch"))).rejects.toThrow("nicht eingerichtet"); }
  finally { delete process.env.REQUIRE_MALWARE_SCAN; }
});
