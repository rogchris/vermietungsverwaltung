import { Details, Section } from "@/components/stammdaten/views";
import { displayDecimal } from "@/modules/stammdaten/presentation";
import type { financeReport } from "@/modules/finance/report";
import type { financeSelection } from "@/modules/finance/presentation";
import { Button } from "@/components/ui/button";

export const euro = (value: Parameters<typeof displayDecimal>[0]) => displayDecimal(value, "€");

export function FinanceTotals({ report }: { report: Awaited<ReturnType<typeof financeReport>> }) {
  return <Section title="Soll, Ist und Cashflow"><Details entries={[
    ["Gebuchte Sollmiete", euro(report.scheduled)], ["Zahlungseingänge netto", euro(report.received)],
    ["Offene Forderungen zum Stichtag", euro(report.open)], ["Rückstände zum Stichtag", euro(report.overdue)],
    ["Ausgaben netto", euro(report.spent)], ["Cashflow", euro(report.cashflow)],
  ]} /></Section>;
}

export function PeriodFilter({ href, selection, properties }: {
  href: string; selection: ReturnType<typeof financeSelection>; properties: { id: string; name: string }[];
}) {
  const field = "min-h-11 min-w-0 w-full rounded-md border border-border bg-background px-3";
  return <form method="get" action={href} className="grid items-end gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 lg:grid-cols-4">
    <label className="grid gap-2 text-sm">Monat / Jahr<input className={field} name="monat" type="month" defaultValue={selection.selected} required /></label>
    <label className="grid gap-2 text-sm">Zeitraum<select className={field} name="zeitraum" defaultValue={selection.scope}><option value="monat">Monat</option><option value="jahr">Jahr</option></select></label>
    <label className="grid gap-2 text-sm">Immobilie<select className={field} name="objekt" defaultValue={selection.propertyId ?? ""}><option value="">Alle Immobilien</option>{properties.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label>
    <Button type="submit">Anwenden</Button>
  </form>;
}
