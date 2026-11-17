import { expect, it, afterAll } from "vitest";
import { getDb } from "../../src/lib/db";
import { berlinToday } from "../../src/modules/stammdaten/calendar";
import { addRentCondition } from "../../src/modules/leases/service";
import { conditionInput } from "../../src/modules/leases/validation";
import { assignPayment, correctReceivable, generateReceivables, recordExpense, recordPayment, reverseEntry } from "../../src/modules/finance/service";
import { balance, periodBounds, sumAmounts } from "../../src/modules/finance/calculation";
import { financeReport } from "../../src/modules/finance/report";
import { reportHtml } from "../../src/modules/reports/content";
import { dashboardData } from "../../src/modules/dashboard/service";
import { allocationInput, correctionInput, expenseInput, paymentInput } from "../../src/modules/finance/validation";
import { masterDataFixture } from "../support/master-data-fixture";
import { financeFixture } from "../support/finance-fixture";

const db = getDb();
afterAll(() => db.$disconnect());

it("erzeugt Monatsforderungen einmalig und bewahrt den Dezemberbetrag", async () => {
  const user = await masterDataFixture();
  try {
    const { propertyId, leaseId } = await financeFixture(user.id, user.prefix);
    const december = new Date("2026-12-01");
    const january = new Date("2027-01-01");
    const counts = await Promise.all([generateReceivables(user.id, december, propertyId), generateReceivables(user.id, december, propertyId)]);
    expect(counts.sort()).toEqual([0, 1]);
    await addRentCondition(user.id, leaseId, 0, conditionInput.parse({ effectiveFrom: "2027-01-01", baseRent: "850", operatingCosts: "100", operatingMode: "ADVANCE", heatingCosts: "0", heatingMode: "NONE" }));
    expect(await generateReceivables(user.id, january, propertyId)).toBe(1);
    expect(await generateReceivables(user.id, december, propertyId)).toBe(0);
    const rows = await db.rentReceivable.findMany({ where: { leaseId }, orderBy: { period: "asc" } });
    expect(rows.map((row) => row.baseRent.toFixed(2))).toEqual(["800.00", "850.00"]);
    await correctReceivable(user.id, correctionInput.parse({ id: rows[1].id, reason: "Synthetische Korrektur", baseRent: "851", operating: "100", heating: "0" }));
    expect(await generateReceivables(user.id, january, propertyId)).toBe(0);
    expect(await db.rentReceivable.count({ where: { leaseId, voidedOn: null } })).toBe(2);
  } finally { await user.dispose(); }
});

it("ordnet Teilzahlungen und Überzahlungen atomar zu und rollt fehlerhafte Mehrfachzuordnungen zurück", async () => {
  const user = await masterDataFixture();
  try {
    const now = berlinToday();
    const current = periodBounds(now).start;
    const day = now.toISOString().slice(0, 10);
    const { propertyId, leaseId, unitId } = await financeFixture(user.id, user.prefix, "2000-01-01");
    await generateReceivables(user.id, current, propertyId);
    await generateReceivables(user.id, new Date("2000-01-01"), propertyId);
    const [old, due] = await db.rentReceivable.findMany({ where: { leaseId }, orderBy: { period: "asc" } });
    const payment = { id: crypto.randomUUID(), propertyId, receivedOn: day, amount: "1000", note: "" };
    await expect(recordPayment(user.id, paymentInput.parse({ ...payment, allocations: [
      { receivableId: due.id, amount: "500" }, { receivableId: old.id, amount: "501" },
    ] }))).rejects.toThrow("Zahlungsbetrag");
    expect(await db.payment.findUnique({ where: { id: payment.id } })).toBeNull();
    expect(await db.allocation.count({ where: { paymentId: payment.id } })).toBe(0);
    const entry = paymentInput.parse({ ...payment, allocations: [{ receivableId: due.id, amount: "500" }, { receivableId: old.id, amount: "200" }] });
    await recordPayment(user.id, entry);
    await recordPayment(user.id, entry);
    const stored = await db.payment.findUniqueOrThrow({ where: { id: payment.id }, include: { allocations: true } });
    expect(stored.allocations).toHaveLength(2);
    expect(stored.amount.minus(sumAmounts(stored.allocations)).toFixed(2)).toBe("300.00");
    expect(balance(due, sumAmounts(stored.allocations.filter((row) => row.receivableId === due.id))).toFixed(2)).toBe("400.00");
    const assignments = await Promise.allSettled([1, 2].map(() => assignPayment(user.id, payment.id, crypto.randomUUID(),
      allocationInput.parse({ receivableId: due.id, amount: "200" }))));
    expect(assignments.filter((row) => row.status === "fulfilled")).toHaveLength(1);
    await recordExpense(user.id, expenseInput.parse({ id: crypto.randomUUID(), propertyId, unitId, paidOn: day, amount: "80,10",
      category: "MAINTENANCE", description: "Synthetische Ausgabe", vendor: "" }));
    expect((await financeReport(current, 1, propertyId)).cashflow.toFixed(2)).toBe("919.90");
    await reverseEntry(user.id, "payment", payment.id, "Synthetischer Storno");
    expect(await db.allocation.count({ where: { paymentId: payment.id, voidedOn: null } })).toBe(0);
    expect((await financeReport(current, 1, propertyId)).cashflow.toFixed(2)).toBe("-80.10");
  } finally { await user.dispose(); }
});

it("merkt automatische Läufe persistent und idempotent pro Berliner Kalendertag", async () => {
  const user = await masterDataFixture();
  const day = berlinToday();
  try {
    const { propertyId } = await financeFixture(user.id, user.prefix, "2000-01-01");
    expect(await generateReceivables(null, day, propertyId, true)).toBe(1);
    expect(await generateReceivables(null, day, propertyId, true)).toBe(0);
    expect(await db.rentGenerationRun.findUnique({ where: { day } })).toMatchObject({ createdCount: 1 });
  } finally {
    await db.rentGenerationRun.deleteMany({ where: { day } });
    await user.dispose();
  }
});

it("zeigt im historischen Mietbericht den Status vor einem späteren Storno", async () => {
  const user = await masterDataFixture();
  try {
    const { propertyId, leaseId } = await financeFixture(user.id, user.prefix, "2000-01-01");
    const period = new Date("2000-01-01");
    await generateReceivables(user.id, period, propertyId);
    const due = await db.rentReceivable.findFirstOrThrow({ where: { leaseId, period } });
    const backfilled = await financeReport(period, 1, propertyId);
    expect(backfilled.scheduled.toFixed(2)).toBe("900.00");
    expect(backfilled.dues[0].open.toFixed(2)).toBe("0.00");
    expect(backfilled.dues[0].status).toBe("Nach dem Stichtag gebucht");
    await db.rentReceivable.update({ where: { id: due.id }, data: { bookedOn: period } });
    await reverseEntry(user.id, "receivable", due.id, "Synthetischer Storno im späteren Zeitraum");

    const report = await financeReport(period, 1, propertyId);
    expect(report.open.toFixed(2)).toBe("900.00");
    expect(report.dues[0].status).toBe("Überfällig");
    const job = await db.reportJob.create({ data: { id: crypto.randomUUID(), userId: user.id, propertyId, type: "RENT", period, months: 1 } });
    const html = await reportHtml(job);
    expect(html).toContain("<td>Überfällig</td>");
    expect(html).not.toContain("<td>Storniert</td>");
    expect(await reportHtml({ ...job, type: "ARREARS" })).toContain("<td>Test Person</td>");
  } finally { await user.dispose(); }
});

it("berücksichtigt Archivierungen am Berliner Stichtag bereits im Dashboard", async () => {
  const user = await masterDataFixture();
  try {
    const { propertyId } = await financeFixture(user.id, user.prefix);
    // Am Archivierungsort ist es bereits 1. Juli, obwohl UTC noch den 30. Juni zeigt.
    await db.property.update({ where: { id: propertyId }, data: { archivedAt: new Date("2000-06-30T22:30:00Z") } });
    expect((await dashboardData(new Date("2000-06-01"), 1, propertyId)).inventory).toHaveLength(1);
    expect((await dashboardData(new Date("2000-07-01"), 1, propertyId)).inventory).toHaveLength(0);
    await db.property.update({ where: { id: propertyId }, data: { archivedAt: new Date("2000-06-30T12:00:00Z") } });
    expect((await dashboardData(new Date("2000-06-01"), 1, propertyId)).inventory).toHaveLength(0);
  } finally { await user.dispose(); }
});

it("zeigt Eingang und späteren Storno in getrennten Monaten derselben Übersicht", async () => {
  const user = await masterDataFixture();
  try {
    const { propertyId } = await financeFixture(user.id, user.prefix);
    const previousMonth = periodBounds(berlinToday()).start;
    previousMonth.setUTCMonth(previousMonth.getUTCMonth() - 1);
    const id = crypto.randomUUID();
    await recordPayment(user.id, paymentInput.parse({
      id, propertyId, receivedOn: previousMonth.toISOString().slice(0, 10), amount: "1000", note: "", allocations: [],
    }));
    await reverseEntry(user.id, "payment", id, "Synthetischer Storno im Folgemonat");

    const report = await financeReport(previousMonth, 12, propertyId);
    expect(report.received.toFixed(2)).toBe("0.00");
    expect(report.cashflow.toFixed(2)).toBe("0.00");
    expect(report.monthly).toHaveLength(12);
    expect(report.monthly.slice(0, 2).map((row) => row.cashflow.toFixed(2))).toEqual(["1000.00", "-1000.00"]);
  } finally { await user.dispose(); }
});
