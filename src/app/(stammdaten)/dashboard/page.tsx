import { requireAccess } from "@/modules/authentication/access";
import { getDb } from "@/lib/db";
import { financeSelection } from "@/modules/finance/presentation";
import { dashboardData } from "@/modules/dashboard/service";
import { Details, PageTitle, RecordList, Section } from "@/components/stammdaten/views";
import { FinanceTotals, PeriodFilter, euro } from "@/components/finance/overview";
import type { Search } from "../routing";

export default async function DashboardPage({ searchParams }: { searchParams: Search }) {
  const [, params] = await Promise.all([requireAccess(), searchParams]);
  const selection = financeSelection(params);
  const [data, properties] = await Promise.all([
    dashboardData(selection.start, selection.months, selection.propertyId),
    getDb().property.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  return <>
    <PageTitle title="Dashboard" description="Bestand und Finanzlage im gewählten Zeitraum." />
    <PeriodFilter href="/dashboard" selection={selection} properties={properties} />
    <Section title="Bestand"><Details entries={[
      ["Immobilien", data.inventory.length], ["Einheiten", data.totals.units], ["Vermietet", data.totals.rented], ["Leerstehend", data.totals.vacant],
    ]} /></Section>
    <FinanceTotals report={data.report} />
    <Section title="Einnahmen und Ausgaben">
      {[{ label: "Eingänge", value: data.report.received, width: data.comparison.received }, { label: "Ausgaben", value: data.report.spent, width: data.comparison.spent }].map((row) =>
        <div key={row.label} className="grid gap-1 text-sm"><span>{row.label} · {euro(row.value)}</span>
          <div aria-hidden="true" className="h-2 rounded bg-border"><div className="h-2 rounded bg-primary" style={{ width: row.width }} /></div>
        </div>)}
    </Section>
    <Section title="Objektübersicht"><RecordList records={data.inventory.map((item) => ({ href: `/immobilien/${item.id}`, title: item.name,
      subtitle: item.city + " · " + item.units + " Einheiten", status: item.rented + " vermietet" }))} empty="Für die Auswahl sind keine Immobilien vorhanden." /></Section>
  </>;
}
