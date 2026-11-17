import { getDb } from "@/lib/db";
import type { ReportJob } from "@/generated/prisma/client";
import { dueAmount, periodBounds } from "@/modules/finance/calculation";
import { financeReport } from "@/modules/finance/report";
import { categories } from "@/modules/finance/presentation";
import { berlinToday } from "@/modules/stammdaten/calendar";
import { displayDate, displayDecimal, displayPeriod, propertyTypes, unitStatuses, unitUses } from "@/modules/stammdaten/presentation";

export const reportTypes = {
  BANK_PACKAGE: "Bankmappe",
  PROPERTY: "Immobilien-Stammdatenblatt", RENT: "Mietübersicht", TENANTS: "Mieterliste", PAYMENTS: "Zahlungsübersicht",
  ARREARS: "Mietrückstandsliste", CASHFLOW: "Einnahmen-Ausgaben-Bericht", ANNUAL: "Jahresübersicht je Immobilie",
} as const;

type Table = { title?: string; columns: string[]; rows: (string | number)[][] };
const money = (value: Parameters<typeof displayDecimal>[0]) => displayDecimal(value, "€");
const escape = (value: string | number) => String(value).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

async function reportTables(job: ReportJob): Promise<Table[]> {
  const db = getDb();
  const { start, end } = periodBounds(job.period, job.months);
  if (job.type === "PROPERTY") {
    const properties = await db.property.findMany({ where: { id: job.propertyId ?? undefined }, include: { units: { orderBy: { label: "asc" } } }, orderBy: { name: "asc" } });
    return properties.flatMap((p) => [
      { title: p.name, columns: ["Merkmal", "Angabe"], rows: [
        ["Anschrift", p.street + " " + p.houseNumber + ", " + p.postalCode + " " + p.city], ["Bundesland", p.state], ["Typ", propertyTypes[p.type]],
        ["Baujahr", p.builtYear ?? "–"], ["Wohnfläche", displayDecimal(p.livingArea, "m²")], ["Grundstück", displayDecimal(p.landArea, "m²")],
        ["Kaufdatum", displayDate(p.purchaseDate)], ["Kaufpreis", money(p.purchasePrice)], ["Status", p.archivedAt ? "Archiviert" : "Aktiv"],
        ["Beschreibung", p.description || "–"],
      ] },
      { title: "Einheiten", columns: ["Einheit", "Nutzung", "Wohnfläche", "Grundstatus"], rows: p.units.map((u) => [u.label, unitUses[u.use], displayDecimal(u.livingArea, "m²"), unitStatuses[u.status]]) },
    ]);
  }
  if (job.type === "TENANTS") {
    const parties = await db.leaseTenant.findMany({ where: { lease: {
      startsOn: { lt: end }, OR: [{ endsOn: null }, { endsOn: { gte: start } }], unit: { propertyId: job.propertyId ?? undefined },
    } }, include: { tenant: true, lease: { include: { unit: { include: { property: { select: { name: true } } } } } } },
    orderBy: [{ tenant: { lastName: "asc" } }, { tenant: { firstName: "asc" } }, { leaseId: "asc" }] });
    return [{ columns: ["Objekt / Einheit", "Vertragspartei", "Anschrift / Kontakt", "Vertrag"], rows: parties.map(({ tenant, lease }) => [
      lease.unit.property.name + " / " + lease.unit.label, tenant.firstName + " " + tenant.lastName,
      [tenant.street + " " + tenant.houseNumber, tenant.postalCode + " " + tenant.city + " (" + tenant.countryCode + ")", tenant.email, tenant.phone].filter(Boolean).join("\n"),
      displayPeriod(lease.startsOn, lease.endsOn),
    ]) }];
  }
  const report = await financeReport(start, job.months, job.propertyId, job.type === "ARREARS");
  const within = (day: Date) => day >= start && day < end;
  const label = (row: (typeof report.dues)[number]) => row.lease.unit.property.name + " / " + row.lease.unit.label;
  const totals: Table = { title: "Zusammenfassung", columns: ["Kennzahl", "Betrag"], rows: [
    ["Gebuchte Sollmiete", money(report.scheduled)], ["Zahlungseingänge netto", money(report.received)], ["Ausgaben netto", money(report.spent)],
    ["Offene Forderungen zum " + displayDate(report.asOf), money(report.open)], ["Überfällige Forderungen", money(report.overdue)], ["Cashflow", money(report.cashflow)],
  ] };
  if (job.type === "RENT") return [totals, { columns: ["Objekt / Einheit", "Monat", "Kalt", "Betrieb", "Heizung", "Gesamt", "Status"],
    rows: report.dues.map((row) => [label(row), row.period.toISOString().slice(0, 7), money(row.baseRent), money(row.operating), money(row.heating), money(dueAmount(row)), row.status]) }];
  if (job.type === "ARREARS") return [{ columns: ["Objekt / Einheit", "Vertragsparteien", "Fällig am", "Offen"],
    rows: report.arrears.map((row) => [label(row), row.tenants.map(({ tenant }) => tenant.firstName + " " + tenant.lastName).join(", "), displayDate(row.dueOn), money(row.open)]) },
  { columns: ["Kennzahl", "Betrag"], rows: [["Rückstände zum " + displayDate(report.asOf), money(report.overdue)]] }];
  const payments: Table = { title: "Zahlungseingänge und Stornos", columns: ["Objekt", "Datum", "Buchung", "Betrag"],
    rows: report.payments.flatMap((p) => [
      ...(within(p.receivedOn) ? [[p.property.name, displayDate(p.receivedOn), p.note || "Zahlung", money(p.amount)]] : []),
      ...(p.voidedOn && within(p.voidedOn) ? [[p.property.name, displayDate(p.voidedOn), "Storno · " + (p.voidReason ?? ""), money(p.amount.negated())]] : []),
    ]) };
  if (job.type === "PAYMENTS") return [payments, { columns: ["Kennzahl", "Betrag"], rows: [["Zahlungseingänge netto", money(report.received)]] }];
  const expenses: Table = { title: "Ausgaben und Stornos", columns: ["Objekt", "Datum", "Kategorie / Buchung", "Betrag"],
    rows: report.expenses.flatMap((p) => [
      ...(within(p.paidOn) ? [[p.property.name, displayDate(p.paidOn), categories[p.category] + " · " + p.description, money(p.amount)]] : []),
      ...(p.voidedOn && within(p.voidedOn) ? [[p.property.name, displayDate(p.voidedOn), "Storno · " + (p.voidReason ?? ""), money(p.amount.negated())]] : []),
    ]) };
  if (job.type !== "ANNUAL") return [totals, payments, expenses];
  return [totals, { title: "Monatsübersicht", columns: ["Monat", "Sollmiete", "Zahlungen netto", "Ausgaben netto", "Cashflow"],
    rows: report.monthly.map((row) => [row.start.toISOString().slice(0, 7), money(row.scheduled), money(row.received), money(row.spent), money(row.cashflow)]) }, payments, expenses];
}

export async function reportHtml(job: ReportJob) {
  const tables = await reportTables(job);
  const property = job.propertyId ? await getDb().property.findUnique({ where: { id: job.propertyId }, select: { name: true } }) : null;
  const { start, end } = periodBounds(job.period, job.months);
  if (tables.reduce((sum, table) => sum + table.rows.length, 0) > 10_000) throw new Error("REPORT_TOO_LARGE");
  const tableHtml = tables.map((table) => (table.title ? "<h2>" + escape(table.title) + "</h2>" : "") +
    "<table><thead><tr>" + table.columns.map((column) => "<th scope='col'>" + escape(column) + "</th>").join("") + "</tr></thead><tbody>" +
    (table.rows.length ? table.rows.map((row) => "<tr>" + row.map((cell) => "<td>" + escape(cell) + "</td>").join("") + "</tr>").join("") :
      "<tr><td colspan='" + table.columns.length + "'>Keine Einträge</td></tr>") + "</tbody></table>").join("");
  return `<!doctype html><html lang="de"><meta charset="UTF-8"><title>${escape(reportTypes[job.type])}</title>
  <style>@page{size:A4}body{font:10pt Arial,sans-serif;color:#181818;background:#fff}
  h1{font-size:19pt;margin:0 0 4mm}h2{font-size:12pt;margin:5mm 0 2mm;break-after:avoid}
  table{width:100%;border-collapse:collapse;margin:0 0 5mm;table-layout:fixed}
  thead{display:table-header-group}tr{break-inside:avoid}th,td{border-bottom:1px solid #aaa;padding:2mm;text-align:left;vertical-align:top;overflow-wrap:anywhere;white-space:pre-line}
  th{border-bottom:1.5px solid #333}.meta{margin-bottom:6mm;color:#333;line-height:1.5}</style>
  <h1>${escape(reportTypes[job.type])}</h1>
  <div class="meta">${escape(property?.name ?? "Gesamter Bestand")}<br>Berichtszeitraum ${escape(displayPeriod(start, new Date(+end - 86_400_000)))}<br>Berichtsdatum ${escape(displayDate(berlinToday()))}</div>
  ${tableHtml || "<p>Keine Einträge im gewählten Zeitraum.</p>"}</html>`;
}
