import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { getDb } from "../../src/lib/db";
import { listProperties, propertyDetail, saveProperty, setPropertyArchived } from "../../src/modules/properties/service";
import { propertyInput } from "../../src/modules/properties/validation";
import { saveUnit, setUnitArchived } from "../../src/modules/rental-units/service";
import { unitInput } from "../../src/modules/rental-units/validation";
import { saveTenant, setTenantArchived, tenantDetail } from "../../src/modules/tenants/service";
import { tenantInput } from "../../src/modules/tenants/validation";
import { addRentCondition, createLease, leaseDetail, updateLease } from "../../src/modules/leases/service";
import { conditionInput, leaseDetails, leaseInput } from "../../src/modules/leases/validation";
import { masterDataFixture } from "../support/master-data-fixture";

const db = getDb();
afterAll(() => db.$disconnect());

const address = { street: "Testweg", houseNumber: "1", postalCode: "00000", city: "Testort" };
const propertyData = (name: string) => propertyInput.parse({
  ...address, name, state: "HE", type: "MULTI_FAMILY", builtYear: "", landArea: "",
  livingArea: "100,25", purchaseDate: "", purchasePrice: "", description: "",
});
const unitData = unitInput.parse({
  label: "WE 1", floor: "", livingArea: "80", rooms: "2,5", use: "RESIDENTIAL", status: "VACANT", features: "", parkingSpaces: "1",
});
const tenantData = (firstName: string) => tenantInput.parse({
  ...address, firstName, lastName: "Testperson", countryCode: "DE", email: "", phone: "",
});
const details = { endsOn: "", rentModel: "FIXED", dueDay: "3", deposit: "0", depositTerms: "" };
const costs = { baseRent: "800", operatingCosts: "100", operatingMode: "ADVANCE", heatingCosts: "0", heatingMode: "NONE" };

async function inventory(actor: string, prefix: string) {
  const property = randomUUID();
  const unit = randomUUID();
  const tenant = randomUUID();
  await saveProperty(actor, property, propertyData(prefix));
  await saveUnit(actor, property, unit, unitData);
  await saveTenant(actor, tenant, tenantData(prefix));
  return { property, unit, tenant };
}

describe("Stammdaten in PostgreSQL", () => {
  it("verhindert verlorene Updates und doppelte Erstellungen und filtert das Archiv", async () => {
    const fixture = await masterDataFixture();
    try {
      const id = randomUUID();
      await saveProperty(fixture.id, id, propertyData(fixture.prefix));
      await expect(saveProperty(fixture.id, id, propertyData(fixture.prefix))).rejects.toMatchObject({ code: "P2002" });
      const update = await Promise.allSettled([
        saveProperty(fixture.id, id, propertyData(fixture.prefix + " A"), 0),
        saveProperty(fixture.id, id, propertyData(fixture.prefix + " B"), 0),
      ]);
      expect(update.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      expect(await propertyDetail(id)).toMatchObject({ version: 1 });
      await setPropertyArchived(fixture.id, id, 1, true);
      expect(await listProperties(fixture.prefix.toLowerCase(), "aktiv")).toHaveLength(0);
      expect(await listProperties(fixture.prefix.toLowerCase(), "archiviert", "MULTI_FAMILY")).toHaveLength(1);
      await setPropertyArchived(fixture.id, id, 2, false);
      expect(await listProperties(fixture.prefix, "aktiv")).toHaveLength(1);
      expect(await db.auditEvent.count({ where: { actorId: fixture.id, action: "property.created" } })).toBe(1);
    } finally {
      await fixture.dispose();
    }
  });

  it("speichert mehrere Parteien und ergänzt historische Konditionen atomar", async () => {
    const fixture = await masterDataFixture();
    try {
      const { property, unit, tenant } = await inventory(fixture.id, fixture.prefix);
      const secondTenant = randomUUID();
      await saveTenant(fixture.id, secondTenant, tenantData(fixture.prefix + " Zweitpartei"));
      const lease = randomUUID();
      await createLease(fixture.id, unit, lease, leaseInput.parse({
        ...costs, ...details, startsOn: "2000-12-01", tenantIds: [tenant, secondTenant],
      }));
      await expect(setPropertyArchived(fixture.id, property, 0, true)).rejects.toThrow("laufende oder zukünftige");
      await expect(setUnitArchived(fixture.id, unit, 0, true)).rejects.toThrow("laufende oder zukünftige");
      await expect(setTenantArchived(fixture.id, tenant, 0, true)).rejects.toThrow("laufende oder zukünftige");
      await addRentCondition(fixture.id, lease, 0, conditionInput.parse({ ...costs, baseRent: "850,25", effectiveFrom: "2001-01-01" }));
      await expect(addRentCondition(fixture.id, lease, 1, conditionInput.parse({
        ...costs, baseRent: "875", effectiveFrom: "2000-12-15",
      }))).rejects.toThrow("nach der letzten Mietkondition");
      await expect(updateLease(fixture.id, lease, 1, leaseDetails.parse({ ...details, endsOn: "2000-12-31" }))).rejects.toThrow("letzten Mietkondition");
      await updateLease(fixture.id, lease, 1, leaseDetails.parse({ ...details, endsOn: "2001-01-31" }));
      const saved = await leaseDetail(lease);
      expect(saved?.terms.map((term) => [term.effectiveFrom.toISOString().slice(0, 10), term.baseRent.toFixed(2)])).toEqual([
        ["2001-01-01", "850.25"], ["2000-12-01", "800.00"],
      ]);
      expect(saved?.tenants.map(({ tenantId }) => tenantId)).toEqual(expect.arrayContaining([tenant, secondTenant]));
      await setUnitArchived(fixture.id, unit, 0, true);
      await setTenantArchived(fixture.id, tenant, 0, true);
      await setPropertyArchived(fixture.id, property, 0, true);
      expect(await tenantDetail(tenant)).toMatchObject({ leases: [{ leaseId: lease }] });
      expect(await leaseDetail(lease)).not.toBeNull();
    } finally {
      await fixture.dispose();
    }
  });

  it("lässt bei konkurrierenden Verträgen nur eine Buchung je Einheit und Zeitraum zu", async () => {
    const fixture = await masterDataFixture();
    try {
      const { unit, tenant } = await inventory(fixture.id, fixture.prefix);
      const first = randomUUID();
      const second = randomUUID();
      const input = leaseInput.parse({ ...costs, ...details, startsOn: "2100-01-01", endsOn: "2100-01-31", tenantIds: [tenant] });
      const results = await Promise.allSettled([
        createLease(fixture.id, unit, first, input), createLease(fixture.id, unit, second, input),
      ]);
      expect(results.filter(({ status }) => status === "fulfilled")).toHaveLength(1);
      const declined = results.find((result) => result.status === "rejected");
      expect(declined?.reason).toMatchObject({ message: expect.stringContaining("besteht bereits ein Mietvertrag") });
      const winner = await db.lease.findFirstOrThrow({ where: { unitId: unit }, include: { tenants: true, terms: true } });
      expect(winner.tenants).toHaveLength(1);
      expect(winner.terms).toHaveLength(1);
      const next = randomUUID();
      await createLease(fixture.id, unit, next, { ...input, startsOn: new Date("2100-02-01"), endsOn: null });
      await expect(updateLease(fixture.id, winner.id, 0, { ...details, rentModel: "FIXED", endsOn: new Date("2100-02-01"), dueDay: 3 })).rejects.toThrow("gewählten Zeitraum");
      await expect(db.$transaction(async (tx) => {
        await tx.lease.create({ data: { unitId: unit, startsOn: new Date("2100-01-31"), dueDay: 3, deposit: "0", rentModel: "FIXED" } });
        throw new Error("Die Datenbank hat die Überschneidung nicht abgefangen.");
      })).rejects.toThrow(/Lease_unit_date_no_overlap|exclusion constraint/i);
      expect(await db.lease.count({ where: { unitId: unit } })).toBe(2);
    } finally {
      await fixture.dispose();
    }
  });
});
