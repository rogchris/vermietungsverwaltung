import { expect, it } from "vitest";
import { Prisma } from "../../src/generated/prisma/client";
import { acquisitionScenario } from "../../src/modules/acquisition/calculation";
import { amortization } from "../../src/modules/financing/amortization";

const d = (value: string) => new Prisma.Decimal(value);
const costs = {
  transferTaxRate: d("6"), notaryRate: d("1.5"), registryRate: d("0.5"), brokerRate: d("3.57"),
  renovation: d("10000"), otherCosts: d("100"), reserve: d("3000"), equity: d("40000"),
  annualRent: d("12000"), vacancyRate: d("5"), lossRate: d("2"), ownerCosts: d("1000"), maintenance: d("1200"),
};
const loan = { label: "Testdarlehen", principal: d("70000"), annualRate: d("3"), initialRepayment: d("2"), fixedMonths: 120, extraPayments: [] };

it("berechnet Erwerbskosten, Fehlbetrag, Rendite und Kapitaldienst exakt", () => {
  const result = acquisitionScenario(d("100000"), costs, [loan]);
  expect(result.ancillary.toFixed(2)).toBe("21670.00");
  expect(result.capitalNeeded.toFixed(2)).toBe("124670.00");
  expect(result.gap.toFixed(2)).toBe("14670.00");
  expect(result.grossYield.toFixed(2)).toBe("12.00");
  expect(result.rentLoss.toFixed(2)).toBe("228.00");
  expect(result.operatingCashflow.toFixed(2)).toBe("8972.00");
  expect(result.annualDebtService.toFixed(2)).toBe("3500.04");
  expect(result.cashflow.toFixed(2)).toBe("5471.96");
  expect(result.netOperatingYield?.toFixed(2)).toBe("7.20");
  expect(result.equityYield?.toFixed(2)).toBe("13.68");
});

it("berücksichtigt Sondertilgungen ohne negative Restschuld", () => {
  const { schedule, outstanding } = amortization({
    label: "Test", principal: d("1000"), annualRate: d("0"), initialRepayment: d("12"), fixedMonths: 12,
    extraPayments: [{ month: 2, amount: d("2000") }],
  });
  expect(schedule).toHaveLength(2);
  expect(schedule[1].extra.toFixed(2)).toBe("980.00");
  expect(schedule[1].installment.toFixed(2)).toBe("990.00");
  expect(outstanding.toFixed(2)).toBe("0.00");
});
