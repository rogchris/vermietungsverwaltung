import { Prisma } from "@/generated/prisma/client";
import { zero } from "@/modules/finance/calculation";

type Decimal = Prisma.Decimal;
export const roundMoney = (value: Decimal) => value.toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
export const rateOf = (amount: Decimal, percent: Decimal) => amount.times(percent).div(100);

export type LoanAssumption = {
  label: string;
  principal: Decimal;
  annualRate: Decimal;
  initialRepayment: Decimal;
  fixedMonths: number;
  startsMonth?: number;
  extraPayments: ReadonlyArray<{ month: number; amount: Decimal }>;
};

export function amortization(loan: LoanAssumption) {
  const payment = roundMoney(rateOf(loan.principal, loan.annualRate.plus(loan.initialRepayment)).div(12));
  const extras = new Map(loan.extraPayments.map((entry) => [entry.month, entry.amount]));
  const schedule = [];
  let outstanding = loan.principal;
  for (let month = 1; month <= loan.fixedMonths && outstanding.gt(0); month++) {
    const interest = roundMoney(rateOf(outstanding, loan.annualRate).div(12));
    const scheduledPrincipal = Prisma.Decimal.min(outstanding, Prisma.Decimal.max(zero, payment.minus(interest)));
    const extra = Prisma.Decimal.min(outstanding.minus(scheduledPrincipal), extras.get(month) ?? zero);
    const principal = scheduledPrincipal.plus(extra);
    outstanding = outstanding.minus(principal);
    schedule.push({ month, calendarMonth: (loan.startsMonth ?? 1) + month - 1, interest, scheduledPrincipal, extra, installment: interest.plus(principal), outstanding });
  }
  return { payment, outstanding, schedule };
}
