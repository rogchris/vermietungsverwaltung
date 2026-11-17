import { expect, it } from "vitest";
import { Prisma } from "../../src/generated/prisma/client";
import { balance, monthlyRent, receivableStatus } from "../../src/modules/finance/calculation";
import { paymentInput } from "../../src/modules/finance/validation";
const d = (value: string) => new Prisma.Decimal(value);
const date = (value: string) => new Date(value);

it("berechnet 400,00 EUR Rest aus 900,00 EUR und 500,00 EUR", () => {
  const open = balance({ baseRent: d("800"), operating: d("100"), heating: d("0") }, d("500"));
  expect(open.toFixed(2)).toBe("400.00");
  expect(receivableStatus(open, d("500"), date("2026-01-03"), date("2026-01-04"), false)).toBe("Teilbezahlt · überfällig");
});

it("berechnet tagesanteilige Konditionen und rundet die Bestandteile genau einmal", () => {
  const term = (from: string, rent: string) => ({ effectiveFrom: date(from), baseRent: d(rent), operatingCosts: d("1"), heatingCosts: d("0") });
  const result = monthlyRent({ startsOn: date("2028-02-15"), endsOn: date("2028-02-28"), dueDay: 31,
    terms: [term("2028-02-15", "800.01"), term("2028-02-20", "850.02")] }, date("2028-02-01"));
  expect(result?.baseRent.toFixed(2)).toBe("401.73");
  expect(result?.operating.toFixed(2)).toBe("0.48");
  expect(result?.dueOn.toISOString().slice(0, 10)).toBe("2028-02-29");
});

it.each(["0", "-1", "1.001", "10e2"])("lehnt ungültige Zahlungen ab (%s)", (amount) => {
  expect(paymentInput.safeParse({ id: crypto.randomUUID(), propertyId: crypto.randomUUID(), receivedOn: "2026-11-01", amount, note: "", allocations: [] }).success).toBe(false);
});
