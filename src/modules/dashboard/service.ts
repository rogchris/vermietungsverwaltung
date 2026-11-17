import { getDb } from "@/lib/db";
import { activeLeaseOn, berlinDate } from "@/modules/stammdaten/calendar";
import { financeReport } from "@/modules/finance/report";

export async function dashboardData(start: Date, months: number, propertyId: string | null) {
  const report = await financeReport(start, months, propertyId);
  const properties = await getDb().property.findMany({
    where: { id: propertyId ?? undefined },
    include: { units: { where: { status: { not: "ARCHIVED" } }, select: {
      status: true, leases: { where: activeLeaseOn(report.asOf), select: { id: true }, take: 1 },
    } } }, orderBy: { name: "asc" },
  });
  const inventory = properties.filter(({ archivedAt }) => !archivedAt || berlinDate(archivedAt) > report.asOf).map(({ id, name, city, units }) => ({
    id, name, city, units: units.length,
    rented: units.filter((unit) => unit.leases.length || unit.status === "RENTED").length,
    vacant: units.filter((unit) => !unit.leases.length && unit.status === "VACANT").length,
  }));
  const totals = inventory.reduce((total, row) => ({ units: total.units + row.units, rented: total.rented + row.rented, vacant: total.vacant + row.vacant }), { units: 0, rented: 0, vacant: 0 });
  const maximum = report.received.abs().gt(report.spent.abs()) ? report.received.abs() : report.spent.abs();
  const bar = (value: typeof report.received) => maximum.isZero() ? "0%" : value.abs().div(maximum).times(100).toFixed(2) + "%";
  return { report, inventory, totals, comparison: { received: bar(report.received), spent: bar(report.spent) } };
}
