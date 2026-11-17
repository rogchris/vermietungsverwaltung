import { randomUUID } from "node:crypto";
import { saveProperty } from "../../src/modules/properties/service";
import { saveUnit } from "../../src/modules/rental-units/service";
import { saveTenant } from "../../src/modules/tenants/service";
import { createLease } from "../../src/modules/leases/service";
import { leaseInput } from "../../src/modules/leases/validation";

export async function financeFixture(actor: string, label: string, startsOn = "2026-12-01") {
  const propertyId = randomUUID(), unitId = randomUUID(), leaseId = randomUUID(), tenantId = randomUUID();
  const address = { street: "Synthetischer Weg", houseNumber: "1", postalCode: "00000", city: "Testort" };
  await saveProperty(actor, propertyId, { name: label, ...address, state: "HE", type: "OTHER", livingArea: "85",
    builtYear: null, landArea: null, purchaseDate: null, purchasePrice: null, description: "" });
  await saveUnit(actor, propertyId, unitId, { label: "Testeinheit", floor: null, livingArea: "85", rooms: null, status: "VACANT", use: "RESIDENTIAL", features: "", parkingSpaces: 0 });
  await saveTenant(actor, tenantId, { ...address, firstName: "Test", lastName: "Person", countryCode: "DE", phone: null, email: null });
  await createLease(actor, unitId, leaseId, leaseInput.parse({ tenantIds: [tenantId], startsOn, endsOn: "", rentModel: "FIXED",
    dueDay: "3", deposit: "0", depositTerms: "", baseRent: "800", operatingCosts: "100", operatingMode: "ADVANCE", heatingCosts: "0", heatingMode: "NONE" }));
  return { propertyId, unitId, leaseId, tenantId };
}
