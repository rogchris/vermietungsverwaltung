import type { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { audit, MasterDataError, writeMasterData } from "@/modules/stammdaten/mutations";
import { berlinToday } from "@/modules/stammdaten/calendar";
import { balance, monthlyRent, periodBounds, sumAmounts } from "./calculation";
import type { allocationInput, correctionInput, expenseInput, paymentInput } from "./validation";

const error = (message: string) => new MasterDataError(message);

export function generateReceivables(actor: string | null, period: Date, propertyId: string | null, scheduled = false) {
  const today = berlinToday();
  const { start, end } = periodBounds(period);
  return writeMasterData(async (tx) => {
    if (scheduled) {
      const claimed = await tx.rentGenerationRun.createMany({ data: { day: today, period: start }, skipDuplicates: true });
      if (!claimed.count) return 0;
    }
    const leases = await tx.lease.findMany({
      where: { startsOn: { lt: end }, OR: [{ endsOn: null }, { endsOn: { gte: start } }], unit: propertyId ? { propertyId } : undefined },
      include: { terms: { where: { effectiveFrom: { lt: end } } } },
    });
    const amounts = leases.map((lease) => {
      const snapshot = monthlyRent(lease, start);
      if (!snapshot) throw error("Mindestens einem Vertrag fehlt eine gültige Mietkondition für diesen Monat.");
      return { id: crypto.randomUUID(), leaseId: lease.id, period: start, bookedOn: today, ...snapshot };
    });
    if (!amounts.length) return 0;
    const rows = await tx.rentReceivable.createManyAndReturn({ data: amounts, skipDuplicates: true, select: { id: true } });
    await tx.auditEvent.createMany({ data: rows.map(({ id }) => ({ actorId: actor, action: "receivable.created", targetType: "RentReceivable", targetId: id })) });
    if (scheduled) await tx.rentGenerationRun.update({ where: { day: today }, data: { createdCount: rows.length } });
    return rows.length;
  });
}

type AllocationInput = z.output<typeof allocationInput>;

async function allocate(tx: Prisma.TransactionClient, actor: string, paymentId: string, id: string, data: AllocationInput) {
  const existing = await tx.allocation.findUnique({ where: { id } });
  if (existing) {
    if (existing.paymentId === paymentId && existing.receivableId === data.receivableId && existing.amount.eq(data.amount)) return;
    throw error("Diese Vorgangsnummer wurde bereits verwendet.");
  }
  const payment = await tx.payment.findUnique({
    where: { id: paymentId }, include: { allocations: { where: { voidedOn: null }, select: { amount: true } } },
  });
  if (!payment || payment.voidedOn) throw error("Die Zahlung ist nicht verfügbar.");
  const due = await tx.rentReceivable.findUnique({
    where: { id: data.receivableId },
    include: { lease: { select: { unit: { select: { propertyId: true } } } }, allocations: { where: { voidedOn: null }, select: { amount: true } } },
  });
  if (!due || due.voidedOn || due.lease.unit.propertyId !== payment.propertyId) throw error("Die Forderung gehört nicht zum Objekt der Zahlung oder wurde storniert.");
  if (!data.amount.gt(0) || payment.amount.minus(sumAmounts(payment.allocations)).lt(data.amount)) throw error("Der verfügbare Zahlungsbetrag reicht nicht aus.");
  if (balance(due, sumAmounts(due.allocations)).lt(data.amount)) throw error("Die Zuordnung übersteigt die offene Forderung.");
  await tx.allocation.create({ data: { id, paymentId, receivableId: due.id, amount: data.amount, allocatedOn: berlinToday() } });
  await audit(tx, actor, "payment.allocated", "Allocation", id);
}

export function recordPayment(actor: string, data: z.output<typeof paymentInput>) {
  const { allocations, ...entry } = data;
  if (entry.receivedOn > berlinToday()) throw error("Das Zahlungsdatum liegt in der Zukunft.");
  return writeMasterData(async (tx) => {
    const previous = await tx.payment.findUnique({ where: { id: entry.id } });
    if (previous) {
      if (previous.propertyId !== entry.propertyId || !previous.amount.eq(entry.amount) ||
          +previous.receivedOn !== +entry.receivedOn || previous.note !== entry.note) throw error("Diese Vorgangsnummer wurde bereits verwendet.");
      return;
    }
    await tx.payment.create({ data: entry });
    await audit(tx, actor, "payment.created", "Payment", entry.id);
    for (const allocation of allocations) await allocate(tx, actor, entry.id, crypto.randomUUID(), allocation);
  });
}

export function assignPayment(actor: string, paymentId: string, id: string, data: AllocationInput) {
  return writeMasterData((tx) => allocate(tx, actor, paymentId, id, data));
}

export function recordExpense(actor: string, data: z.output<typeof expenseInput>) {
  if (data.paidOn > berlinToday()) throw error("Das Ausgabedatum liegt in der Zukunft.");
  return writeMasterData(async (tx) => {
    if (data.unitId && !await tx.rentalUnit.findFirst({ where: { id: data.unitId, propertyId: data.propertyId }, select: { id: true } })) {
      throw error("Die Einheit gehört nicht zum gewählten Objekt.");
    }
    await tx.expense.create({ data });
    await audit(tx, actor, "expense.created", "Expense", data.id);
  });
}

export function reverseEntry(actor: string, kind: "payment" | "allocation" | "expense" | "receivable", id: string, reason: string) {
  const data = { voidedOn: berlinToday(), voidReason: reason };
  return writeMasterData(async (tx) => {
    const where = { id, voidedOn: null };
    let changed;
    if (kind === "payment") {
      changed = await tx.payment.updateMany({ where, data });
      await tx.allocation.updateMany({ where: { paymentId: id, voidedOn: null }, data });
    } else if (kind === "allocation") {
      changed = await tx.allocation.updateMany({ where, data });
    } else if (kind === "expense") {
      changed = await tx.expense.updateMany({ where, data });
    } else {
      if (await tx.allocation.count({ where: { receivableId: id, voidedOn: null } })) throw error("Löse zuerst die Zahlungszuordnungen dieser Forderung.");
      changed = await tx.rentReceivable.updateMany({ where, data });
    }
    if (!changed.count) throw error("Der Eintrag wurde bereits storniert oder ist nicht verfügbar.");
    await audit(tx, actor, kind + ".reversed", { payment: "Payment", allocation: "Allocation", expense: "Expense", receivable: "RentReceivable" }[kind], id);
  });
}

export function correctReceivable(actor: string, data: z.output<typeof correctionInput>) {
  return writeMasterData(async (tx) => {
    const old = await tx.rentReceivable.findUnique({ where: { id: data.id } });
    if (!old || old.voidedOn) throw error("Die Forderung ist nicht mehr aktiv.");
    if (await tx.allocation.count({ where: { receivableId: old.id, voidedOn: null } })) throw error("Löse zuerst die Zahlungszuordnungen dieser Forderung.");
    const today = berlinToday();
    await tx.rentReceivable.update({ where: { id: old.id }, data: { voidedOn: today, voidReason: data.reason } });
    const replacement = await tx.rentReceivable.create({ data: {
      leaseId: old.leaseId, period: old.period, kind: old.kind, dueOn: old.dueOn, revision: old.revision + 1, bookedOn: today,
      baseRent: data.baseRent, operating: data.operating, heating: data.heating,
    } });
    await audit(tx, actor, "receivable.corrected", "RentReceivable", old.id);
    await audit(tx, actor, "receivable.replacement_created", "RentReceivable", replacement.id);
  });
}

export async function runFinanceWrite<T>(operation: () => Promise<T>) {
  try { return await operation(); } catch (cause) {
    if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2002") throw error("Dieser Vorgang wurde bereits verarbeitet.");
    if (cause instanceof Prisma.PrismaClientKnownRequestError && cause.code === "P2003") throw error("Das gewählte Objekt ist nicht verfügbar.");
    throw cause;
  }
}
