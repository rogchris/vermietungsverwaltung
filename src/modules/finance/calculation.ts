import { Prisma } from "@/generated/prisma/client";

export const zero = new Prisma.Decimal(0);
const day = 86_400_000;

export function periodBounds(period: Date, months = 1) {
  const start = new Date(period);
  start.setUTCDate(1);
  const end = new Date(start);
  end.setUTCMonth(end.getUTCMonth() + months);
  return { start, end };
}

type Term = { effectiveFrom: Date; baseRent: Prisma.Decimal; operatingCosts: Prisma.Decimal; heatingCosts: Prisma.Decimal };

export function monthlyRent(lease: { startsOn: Date; endsOn: Date | null; dueDay: number; terms: Term[] }, period: Date) {
  const { start, end } = periodBounds(period);
  const first = Math.max(+start, +lease.startsOn);
  const last = Math.min(+end, lease.endsOn ? +lease.endsOn + day : +end);
  if (first >= last) return null;
  const terms = [...lease.terms].sort((a, b) => +a.effectiveFrom - +b.effectiveFrom);
  if (!terms.some((term) => +term.effectiveFrom <= first)) return null;
  let base = zero, operating = zero, heating = zero;
  for (const [index, term] of terms.entries()) {
    const until = terms[index + 1]?.effectiveFrom ?? end;
    const days = (Math.min(+until, last) - Math.max(+term.effectiveFrom, first)) / day;
    if (days <= 0) continue;
    base = base.plus(term.baseRent.times(days));
    operating = operating.plus(term.operatingCosts.times(days));
    heating = heating.plus(term.heatingCosts.times(days));
  }
  const monthDays = (+end - +start) / day;
  const round = (amount: Prisma.Decimal) => amount.div(monthDays).toDecimalPlaces(2, Prisma.Decimal.ROUND_HALF_UP);
  return { baseRent: round(base), operating: round(operating), heating: round(heating),
    dueOn: new Date(Math.max(first, +start + (Math.min(lease.dueDay, monthDays) - 1) * day)) };
}

export function dueAmount(row: { baseRent: Prisma.Decimal; operating: Prisma.Decimal; heating: Prisma.Decimal }) {
  return row.baseRent.plus(row.operating).plus(row.heating);
}

export function sumAmounts(rows: { amount: Prisma.Decimal }[]) {
  return rows.reduce((sum, row) => sum.plus(row.amount), zero);
}

export function balance(row: Parameters<typeof dueAmount>[0], allocated: Prisma.Decimal) {
  return dueAmount(row).minus(allocated);
}

export function receivableStatus(open: Prisma.Decimal, allocated: Prisma.Decimal, due: Date, asOf: Date, voided: boolean) {
  if (voided) return "Storniert";
  if (open.isZero()) return "Bezahlt";
  if (due < asOf) return allocated.gt(0) ? "Teilbezahlt · überfällig" : "Überfällig";
  return allocated.gt(0) ? "Teilbezahlt" : "Offen";
}
