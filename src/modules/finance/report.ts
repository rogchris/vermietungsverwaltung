import { getDb } from "@/lib/db";
import { berlinToday } from "@/modules/stammdaten/calendar";
import { balance, dueAmount, periodBounds, receivableStatus, sumAmounts, zero } from "./calculation";

const until = (end: Date) => new Date(+end - 86_400_000);
const unit = { select: { label: true, propertyId: true, property: { select: { name: true } } } } as const;

export async function financeReport(period: Date, months: number, propertyId: string | null, includeArrearsTenants = false) {
  const { start, end } = periodBounds(period, months);
  const today = berlinToday();
  const asOf = until(end) < today ? until(end) : today;
  const db = getDb();
  const lease = propertyId ? { unit: { propertyId } } : undefined;
  const property = propertyId ?? undefined;
  const { receivables, payments, expenses, tenantsByLease } = await db.$transaction(async (tx) => {
    const receivables = await tx.rentReceivable.findMany({ where: { period: { lt: end }, lease }, include: { lease: { select: { unit } }, allocations: { select: { amount: true, allocatedOn: true, voidedOn: true } } }, orderBy: [{ period: "asc" }, { revision: "asc" }] });
    const parties = includeArrearsTenants ? await tx.leaseTenant.findMany({
      where: { leaseId: { in: [...new Set(receivables.map((row) => row.leaseId))] } },
      select: { leaseId: true, tenant: { select: { firstName: true, lastName: true } } },
      orderBy: [{ tenant: { lastName: "asc" } }, { tenant: { firstName: "asc" } }, { tenantId: "asc" }],
    }) : [];
    const payments = await tx.payment.findMany({ where: { propertyId: property, OR: [{ receivedOn: { gte: start, lt: end } }, { voidedOn: { gte: start, lt: end } }] },
      include: { property: { select: { name: true } }, allocations: { include: { receivable: { select: { period: true } } } } }, orderBy: [{ receivedOn: "desc" }, { id: "asc" }] });
    const expenses = await tx.expense.findMany({ where: { propertyId: property, OR: [{ paidOn: { gte: start, lt: end } }, { voidedOn: { gte: start, lt: end } }] },
      include: { property: { select: { name: true } }, unit: { select: { label: true } } }, orderBy: [{ paidOn: "desc" }, { id: "asc" }] });
    return { receivables, payments, expenses, tenantsByLease: Map.groupBy(parties, (party) => party.leaseId) };
  }, { isolationLevel: "RepeatableRead" });
  const dues = receivables.filter((row) => row.bookedOn <= asOf || row.period >= start).map((row) => {
    const booked = row.bookedOn <= asOf;
    const voided = !!row.voidedOn && row.voidedOn <= asOf;
    const allocated = sumAmounts(row.allocations.filter((item) => item.allocatedOn <= asOf && (!item.voidedOn || item.voidedOn > asOf)));
    const open = booked && !voided ? balance(row, allocated) : zero;
    return { ...row, voided, allocated, open,
      status: booked ? receivableStatus(open, allocated, row.dueOn, asOf, voided) : "Nach dem Stichtag gebucht" };
  });
  const balances = dues.filter((row) => row.bookedOn <= asOf && row.period <= asOf && !row.voided);
  const open = balances.reduce((sum, row) => sum.plus(row.open), zero);
  const overdue = balances.filter((row) => row.dueOn < asOf).reduce((sum, row) => sum.plus(row.open), zero);
  const cashTotals = (from: Date, to: Date) => {
    const within = (value: Date) => value >= from && value < to;
    // Soll is the latest active revision, even when a past month was generated afterwards.
    const scheduled = receivables.filter((row) => within(row.period) && !row.voidedOn).reduce((sum, row) => sum.plus(dueAmount(row)), zero);
    const received = payments.reduce((sum, row) => sum.plus(within(row.receivedOn) ? row.amount : zero).minus(row.voidedOn && within(row.voidedOn) ? row.amount : zero), zero);
    const spent = expenses.reduce((sum, row) => sum.plus(within(row.paidOn) ? row.amount : zero).minus(row.voidedOn && within(row.voidedOn) ? row.amount : zero), zero);
    return { scheduled, received, spent, cashflow: received.minus(spent) };
  };
  const monthly = months > 1 ? Array.from({ length: months }, (_, index) => {
    const month = new Date(start);
    month.setUTCMonth(month.getUTCMonth() + index);
    return { start: month, ...cashTotals(month, periodBounds(month).end) };
  }) : [];
  const arrears = balances.filter((row) => row.dueOn < asOf && row.open.gt(0))
    .map((row) => ({ ...row, tenants: tenantsByLease.get(row.leaseId) ?? [] }));
  return { start, end, asOf, ...cashTotals(start, end), open, overdue, monthly,
    dues: dues.filter((row) => row.period >= start), arrears, payments, expenses };
}

export async function financeOptions(propertyId: string | null) {
  const db = getDb();
  const [properties, dues] = await Promise.all([
    db.property.findMany({ select: { id: true, name: true, units: { select: { id: true, label: true } } }, orderBy: { name: "asc" } }),
    propertyId ? db.rentReceivable.findMany({
      where: { voidedOn: null, lease: { unit: { propertyId } } },
      include: { lease: { select: { unit } }, allocations: { where: { voidedOn: null }, select: { amount: true } } }, orderBy: { period: "desc" },
    }) : [],
  ]);
  return { properties, openDues: dues.map((row) => ({ ...row, available: balance(row, sumAmounts(row.allocations)) })).filter((row) => row.available.gt(0)) };
}
