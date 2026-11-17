import Link from "next/link";
import { requireAccess } from "@/modules/authentication/access";
import { berlinToday } from "@/modules/stammdaten/calendar";
import { categories, financeSelection } from "@/modules/finance/presentation";
import { balance, dueAmount, sumAmounts } from "@/modules/finance/calculation";
import { financeOptions, financeReport } from "@/modules/finance/report";
import { displayDate, choices } from "@/modules/stammdaten/presentation";
import { ActionLink, Details, Notice, PageTitle, Section } from "@/components/stammdaten/views";
import { MasterForm, type Field } from "@/components/stammdaten/form";
import { FinanceTotals, PeriodFilter, euro } from "@/components/finance/overview";
import type { Search } from "../routing";
import { allocationAction, correctionAction, expenseAction, generateAction, paymentAction, reverseAction } from "./actions";

const amount = (name = "amount", label = "Betrag (EUR)", value?: string): Field => ({ name, label, value, required: true, type: "decimal" });
const reason: Field = { name: "reason", label: "Begründung", maxLength: 500, required: true };
const moneyDate = (name: string, label: string): Field => ({ name, label, value: berlinToday().toISOString().slice(0, 10), type: "date", required: true });
const periodLabel = (value: Date) => value.toISOString().slice(0, 7);
const empty = (message: string) => <p className="text-sm text-muted-foreground">{message}</p>;

export default async function FinancePage({ searchParams }: { searchParams: Search }) {
  const [session, params] = await Promise.all([requireAccess(), searchParams]);
  const selection = financeSelection(params);
  const [report, options] = await Promise.all([
    financeReport(selection.start, selection.months, selection.propertyId), financeOptions(selection.propertyId),
  ]);
  const canEdit = session.user.role === "ADMIN";
  const property = options.properties.find((item) => item.id === selection.propertyId);
  const returnTo = "/finanzen" + selection.query;
  const saved = typeof params.erstellt === "string" && /^\d{1,9}$/.test(params.erstellt) ? params.erstellt : null;
  const recordHidden = () => ({ returnTo, id: crypto.randomUUID(), propertyId: property?.id ?? "" });

  return <>
    <PageTitle title="Finanzen" description="Mietforderungen, Zahlungen und Ausgaben je Immobilie." />
    <PeriodFilter href="/finanzen" selection={selection} properties={options.properties} />
    <Notice value={params.meldung} />
    {saved !== null && <p role="status" className="text-primary">{saved} neue Mietforderungen erzeugt.</p>}
    <FinanceTotals report={report} />
    {canEdit && <Section title="Buchen">
      <p className="text-sm text-muted-foreground">Forderungen werden für {selection.selected} erzeugt. Zahlungen und Ausgaben erfordern einen Objektfilter.</p>
      <MasterForm action={generateAction} hidden={{ returnTo, period: selection.selected, propertyId: selection.propertyId ?? "" }} submit="Mietforderungen erzeugen" />
      {property && <div className="grid gap-5">
        <details className="rounded-md border border-border p-4"><summary className="cursor-pointer font-medium">Zahlung erfassen</summary>
          <div className="mt-4"><MasterForm action={paymentAction} hidden={recordHidden()} fields={[
            moneyDate("receivedOn", "Zahlungseingang"), amount(), { name: "note", label: "Verwendungszweck", maxLength: 500 },
          ]} submit="Zahlung speichern" /></div>
        </details>
        <details className="rounded-md border border-border p-4"><summary className="cursor-pointer font-medium">Ausgabe erfassen</summary>
          <div className="mt-4"><MasterForm action={expenseAction} hidden={recordHidden()} fields={[
            moneyDate("paidOn", "Ausgabedatum"), amount(),
            { name: "category", label: "Kostenkategorie", required: true, type: "select", options: choices(categories) },
            { name: "unitId", label: "Einheit", type: "select", options: [{ value: "", label: "Gesamtes Objekt" }, ...property.units.map((item) => ({ value: item.id, label: item.label }))] },
            { name: "description", label: "Beschreibung", required: true, maxLength: 500 }, { name: "vendor", label: "Dienstleister", maxLength: 160 },
          ]} submit="Ausgabe speichern" /></div>
        </details>
      </div>}
    </Section>}
    <Section title="Mietforderungen">
      {!report.dues.length && empty("Für den Zeitraum wurden noch keine Forderungen erzeugt.")}
      {report.dues.map((row) => <article key={row.id} className="grid gap-3 rounded-md border border-border p-4">
        <h3 className="break-words font-semibold">{row.lease.unit.property.name} · {row.lease.unit.label} · {periodLabel(row.period)}</h3>
        <Details entries={[
          ["Status zum Stichtag", row.status], ["Fällig am", displayDate(row.dueOn)],
          ["Kaltmiete", euro(row.baseRent)], ["Betriebskosten", euro(row.operating)], ["Heizkosten", euro(row.heating)],
          ["Gesamt", euro(dueAmount(row))], ["Offen zum Stichtag", euro(row.open)], ["Korrekturgrund", row.voidReason],
        ]} />
        <Link href={`/mietvertraege/${row.leaseId}`} className="w-fit text-sm text-primary underline">Mietvertrag öffnen</Link>
        {canEdit && !row.voidedOn && <details><summary className="cursor-pointer text-sm text-primary">Forderung korrigieren oder stornieren</summary>
          <div className="mt-3 grid gap-4">
            <MasterForm action={correctionAction} hidden={{ id: row.id, returnTo }} submit="Ersatzforderung buchen" fields={[
              amount("baseRent", "Kaltmiete (EUR)", row.baseRent.toFixed(2)), amount("operating", "Betriebskosten (EUR)", row.operating.toFixed(2)),
              amount("heating", "Heizkosten (EUR)", row.heating.toFixed(2)), reason,
            ]} />
            <MasterForm action={reverseAction.bind(null, "receivable")} hidden={{ id: row.id, returnTo }} fields={[reason]} submit="Forderung stornieren" confirmation="Forderung stornieren?" />
          </div>
        </details>}
      </article>)}
    </Section>
    <Section title="Rückstände">
      {!report.arrears.length && empty("Zum Stichtag sind keine überfälligen offenen Forderungen erfasst.")}
      {report.arrears.map((row) => <div key={row.id} className="break-words text-sm">
        {row.lease.unit.property.name} · {row.lease.unit.label} · {periodLabel(row.period)} · <strong>{euro(row.open)}</strong>
      </div>)}
    </Section>
    <Section title="Zahlungen">
      {!report.payments.length && empty("Keine Zahlungen oder Stornos im gewählten Zeitraum.")}
      {report.payments.map((row) => {
        const available = row.amount.minus(sumAmounts(row.allocations.filter((item) => !item.voidedOn)));
        return <article key={row.id} className="grid gap-3 rounded-md border border-border p-4">
          <h3 className="break-words font-semibold">{row.property.name} · {displayDate(row.receivedOn)} · {euro(row.amount)}</h3>
          <Details entries={[["Verwendungszweck", row.note || null], ["Nicht zugeordnet", row.voidedOn ? "Storniert" : euro(available)], ["Storno", row.voidedOn ? displayDate(row.voidedOn) + " · " + row.voidReason : null]]} />
          {row.allocations.map((item) => <div key={item.id} className="border-t border-border pt-2 text-sm">
            {periodLabel(item.receivable.period)} · {euro(item.amount)}{item.voidedOn && " · storniert"}
            {canEdit && !item.voidedOn && <details className="mt-2"><summary className="cursor-pointer text-primary">Zuordnung lösen</summary>
              <MasterForm action={reverseAction.bind(null, "allocation")} fields={[reason]} hidden={{ id: item.id, returnTo }} submit="Zuordnung stornieren" confirmation="Zuordnung lösen?" />
            </details>}
          </div>)}
          {canEdit && !row.voidedOn && <details><summary className="cursor-pointer text-sm text-primary">Zahlung bearbeiten</summary>
            <div className="mt-3 grid gap-4">
              {property?.id !== row.propertyId ? <ActionLink href={"/finanzen?monat=" + selection.selected + "&objekt=" + row.propertyId}>Objekt zum Zuordnen auswählen</ActionLink> :
                available.gt(0) && options.openDues.length > 0 && <MasterForm action={allocationAction.bind(null, row.id)} hidden={{ id: crypto.randomUUID(), returnTo }} submit="Betrag zuordnen" fields={[
                  { name: "receivableId", label: "Forderung", required: true, type: "select", options: options.openDues.map((due) => ({ value: due.id, label: due.lease.unit.label + " · " + periodLabel(due.period) + " · " + euro(balance(due, sumAmounts(due.allocations))) })) }, amount(),
                ]} />}
              <MasterForm action={reverseAction.bind(null, "payment")} fields={[reason]} hidden={{ id: row.id, returnTo }} submit="Zahlung stornieren" confirmation="Zahlung samt Zuordnungen stornieren?" />
            </div>
          </details>}
        </article>;
      })}
    </Section>
    <Section title="Ausgaben">
      {!report.expenses.length && empty("Keine Ausgaben oder Stornos im gewählten Zeitraum.")}
      {report.expenses.map((row) => <article key={row.id} className="grid gap-3 rounded-md border border-border p-4">
        <h3 className="break-words font-semibold">{row.description} · {euro(row.amount)}</h3>
        <Details entries={[["Objekt", row.property.name], ["Einheit", row.unit?.label], ["Datum", displayDate(row.paidOn)], ["Kategorie", categories[row.category]], ["Dienstleister", row.vendor], ["Storno", row.voidedOn ? displayDate(row.voidedOn) + " · " + row.voidReason : null]]} />
        <Link href={"/dokumente?objekt=" + row.propertyId + "&ausgabe=" + row.id} className="w-fit text-sm text-primary underline">Belege zur Ausgabe</Link>
        {canEdit && !row.voidedOn && <details><summary className="cursor-pointer text-sm text-primary">Ausgabe stornieren</summary>
          <MasterForm action={reverseAction.bind(null, "expense")} fields={[reason]} hidden={{ id: row.id, returnTo }} submit="Ausgabe stornieren" confirmation="Ausgabe stornieren?" />
        </details>}
      </article>)}
    </Section>
  </>;
}
