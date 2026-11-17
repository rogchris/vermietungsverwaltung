import { randomUUID } from "node:crypto";
import { expect, it } from "vitest";
import { Prisma } from "../../src/generated/prisma/client";
import { totalRent } from "../../src/modules/leases/rent";
import { conditionInput, leaseInput } from "../../src/modules/leases/validation";
import { displayDecimal } from "../../src/modules/stammdaten/presentation";

const amounts = {
  baseRent: "800,25", operatingCosts: "99,75", operatingMode: "ADVANCE", heatingCosts: "0", heatingMode: "NONE",
};

it("normalisiert Dezimalwerte ohne Gleitkommaarithmetik", () => {
  const terms = conditionInput.parse({ ...amounts, effectiveFrom: "2027-01-01" });
  const sum = totalRent({
    baseRent: new Prisma.Decimal(terms.baseRent), operatingCosts: new Prisma.Decimal(terms.operatingCosts),
    heatingCosts: new Prisma.Decimal(terms.heatingCosts),
  });
  expect(sum.toFixed(2)).toBe("900.00");
  expect(displayDecimal(sum, "€")).toBe("900,00 €");
});

it.each(["-1", "1e2", "1.234", "9007199254740993"])("weist manipulierte Beträge ab (%s)", (baseRent) => {
  expect(conditionInput.safeParse({ ...amounts, baseRent, effectiveFrom: "2027-01-01" }).success).toBe(false);
});

it("prüft Vertragsparteien, Datumsreihenfolge und Kostenart", () => {
  const party = randomUUID();
  const lease = { ...amounts, startsOn: "2026-12-01", endsOn: "", rentModel: "FIXED", dueDay: "3", deposit: "0", depositTerms: "" };
  expect(leaseInput.safeParse({ ...lease, tenantIds: [party] }).success).toBe(true);
  expect(leaseInput.safeParse({ ...lease, tenantIds: [party, party] }).success).toBe(false);
  expect(leaseInput.safeParse({ ...lease, tenantIds: [] }).success).toBe(false);
  expect(leaseInput.safeParse({ ...lease, tenantIds: [party], endsOn: "2026-11-30" }).success).toBe(false);
  expect(conditionInput.safeParse({ ...amounts, effectiveFrom: "2027-02-30" }).success).toBe(false);
  expect(conditionInput.safeParse({ ...amounts, heatingCosts: "0,01", effectiveFrom: "2027-01-01" }).success).toBe(false);
});
