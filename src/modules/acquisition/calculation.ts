import { Prisma } from "@/generated/prisma/client";
import { zero } from "@/modules/finance/calculation";
import { amortization, rateOf, roundMoney, type LoanAssumption } from "@/modules/financing/amortization";

type Decimal = Prisma.Decimal;
export type ScenarioAssumption = {
  transferTaxRate: Decimal;
  notaryRate: Decimal;
  registryRate: Decimal;
  brokerRate: Decimal;
  renovation: Decimal;
  otherCosts: Decimal;
  reserve: Decimal;
  equity: Decimal;
  annualRent: Decimal;
  vacancyRate: Decimal;
  lossRate: Decimal;
  ownerCosts: Decimal;
  maintenance: Decimal;
};

export function acquisitionScenario(price: Decimal, input: ScenarioAssumption, loans: LoanAssumption[]) {
  const cost = (percent: Decimal) => roundMoney(rateOf(price, percent));
  const transferTax = cost(input.transferTaxRate);
  const notary = cost(input.notaryRate);
  const registry = cost(input.registryRate);
  const broker = cost(input.brokerRate);
  const ancillary = transferTax.plus(notary).plus(registry).plus(broker).plus(input.renovation).plus(input.otherCosts);
  const capitalNeeded = price.plus(ancillary).plus(input.reserve);
  const financed = loans.filter((loan) => (loan.startsMonth ?? 1) === 1).reduce((sum, loan) => sum.plus(loan.principal), zero);
  const fundingBalance = input.equity.plus(financed).minus(capitalNeeded);
  const vacancy = roundMoney(rateOf(input.annualRent, input.vacancyRate));
  const rentLoss = roundMoney(rateOf(input.annualRent.minus(vacancy), input.lossRate));
  const operatingCashflow = input.annualRent.minus(vacancy).minus(rentLoss).minus(input.ownerCosts).minus(input.maintenance);
  const schedules = loans.map((loan) => ({ label: loan.label, ...amortization(loan) }));
  const annualDebtService = schedules.reduce((sum, loan) => loan.schedule.filter((row) => row.calendarMonth <= 12).reduce((value, row) => value.plus(row.installment), sum), zero);
  const grossYield = price.gt(0) ? input.annualRent.times(100).div(price) : zero;
  const cashflow = operatingCashflow.minus(annualDebtService);
  return {
    transferTax, notary, registry, broker, ancillary, capitalNeeded, financed, fundingBalance,
    fundingNeed: Prisma.Decimal.max(zero, capitalNeeded.minus(input.equity)),
    gap: Prisma.Decimal.max(zero, fundingBalance.negated()), surplus: Prisma.Decimal.max(zero, fundingBalance),
    vacancy, rentLoss, operatingCashflow, annualDebtService, cashflow, grossYield, schedules,
    netOperatingYield: capitalNeeded.gt(0) ? operatingCashflow.times(100).div(capitalNeeded) : null,
    equityYield: input.equity.gt(0) ? cashflow.times(100).div(input.equity) : null,
  };
}
