import { notFound } from "next/navigation";
import Link from "next/link";
import { requireAccess } from "@/modules/authentication/access";
import { acquisitionScenario } from "@/modules/acquisition/calculation";
import { projectDetail } from "@/modules/acquisition/service";
import { berlinToday } from "@/modules/stammdaten/calendar";
import { dateInput, displayDate, displayDecimal, propertyTypes } from "@/modules/stammdaten/presentation";
import { documentTypes } from "@/modules/documents/service";
import { projectFields, scenarioFields, scenarios, loanFields } from "@/components/acquisition/fields";
import { UploadForm } from "@/components/documents/upload";
import { euro } from "@/components/finance/overview";
import { MasterForm } from "@/components/stammdaten/form";
import { ActionLink, Details, Notice, PageTitle, Section } from "@/components/stammdaten/views";
import { archiveLoanAction, convertAction, saveLoanAction, saveScenarioAction, updateProjectAction } from "../actions";
import { detailId, queryOption, type DetailProps } from "../../routing";

export default async function AcquisitionDetail({ params, searchParams }: DetailProps) {
  const [session, query] = await Promise.all([requireAccess(), searchParams]);
  const id = await detailId(params);
  const project = await projectDetail(id);
  if (!project) notFound();
  const href = "/ankauf/" + id;
  const canEdit = session.user.role === "ADMIN" && !project.convertedAt;
  const editing = canEdit && query.bearbeiten === "1";
  const selected = queryOption(query.szenario, ["CONSERVATIVE", "BASE", "OPTIMISTIC"], "BASE");
  const scenario = project.scenarios.find((item) => item.kind === selected);
  const version = { version: String(project.version) };
  const results = project.scenarios.map((item) => ({ kind: item.kind, summary: acquisitionScenario(project.purchasePrice, item, item.loans) }));
  const chosen = results.find((item) => item.kind === selected)?.summary;

  return <>
    <PageTitle title={project.name} description={project.convertedAt ? "Übernommenes Kaufprojekt · archiviert" : "Kaufprojekt in Prüfung"}
      back={{ href: "/ankauf", label: "Ankauf" }} action={canEdit && !editing && <ActionLink href={href + "?bearbeiten=1"}>Kaufobjekt bearbeiten</ActionLink>} />
    <Notice value={query.meldung} />
    <div><ActionLink href={href + "/bankmappe"}>Bankmappe öffnen</ActionLink></div>
    {query.hochgeladen === "1" && <p role="status" className="text-primary">Dokument gespeichert.</p>}
    {project.acquiredPropertyId && <div><ActionLink href={"/immobilien/" + project.acquiredPropertyId}>Bestandsimmobilie öffnen</ActionLink></div>}
    <Section title="Kaufobjekt">
      {editing ? <MasterForm key={project.version} action={updateProjectAction.bind(null, id)} hidden={version} fields={projectFields(project)} cancel={href} /> :
        <Details entries={[
          ["Anschrift", project.street + " " + project.houseNumber + ", " + project.postalCode + " " + project.city],
          ["Typ", propertyTypes[project.type]], ["Baujahr", project.builtYear],
          ["Wohnfläche", displayDecimal(project.livingArea, "m²")], ["Grundstück", displayDecimal(project.landArea, "m²")],
          ["Kaufpreis", euro(project.purchasePrice)], ["Kaufdatum", displayDate(project.purchaseDate)],
          ["Erwartete Jahresnettokaltmiete", euro(project.expectedAnnualRent)], ["Leerstand", displayDecimal(project.vacancyRate, "%")],
          ["Zustand", project.condition || null], ["Sanierungsbedarf", project.renovationNotes || null], ["Beschreibung", project.description || null],
        ]} />}
    </Section>
    <Section title="Szenarien vergleichen">
      <div className="grid gap-3 lg:grid-cols-3">
        {Object.entries(scenarios).map(([kind, label]) => {
          const result = results.find((item) => item.kind === kind)?.summary;
          return <div key={kind} className="grid gap-2 rounded-md border border-border p-3 text-sm">
            <Link href={href + "?szenario=" + kind} className="font-semibold text-primary underline" aria-current={kind === selected ? "page" : undefined}>{label}</Link>
            {result ? <><span>Kapitalbedarf {euro(result.capitalNeeded)}</span><span>Finanzierungslücke {euro(result.gap)}</span><span>Jahres-Cashflow {euro(result.cashflow)}</span></> :
              <span className="text-muted-foreground">Noch keine Annahmen gespeichert.</span>}
          </div>;
        })}
      </div>
    </Section>
    <Section title={"Szenario · " + scenarios[selected]}>
      {chosen && scenario && <Details entries={[
        ["Annahmenstand", displayDate(scenario.assumptionsOn)], ["Quelle", scenario.source || null],
        ["Grunderwerbsteuer", euro(chosen.transferTax)], ["Notar", euro(chosen.notary)], ["Grundbuch", euro(chosen.registry)], ["Makler", euro(chosen.broker)],
        ["Sanierung", euro(scenario.renovation)], ["Sonstige Erwerbskosten", euro(scenario.otherCosts)], ["Erwerbsnebenkosten", euro(chosen.ancillary)],
        ["Liquiditätsreserve", euro(scenario.reserve)], ["Kapitalbedarf", euro(chosen.capitalNeeded)], ["Eigenkapital", euro(scenario.equity)],
        ["Erstdarlehen", euro(chosen.financed)], ["Finanzierungslücke", euro(chosen.gap)], ["Finanzierungsüberschuss", euro(chosen.surplus)],
        ["Jahresnettokaltmiete", euro(scenario.annualRent)], ["Bruttomietrendite", displayDecimal(chosen.grossYield, "%")],
        ["Leerstand", euro(chosen.vacancy)], ["Mietausfall", euro(chosen.rentLoss)], ["Eigentümerkosten", euro(scenario.ownerCosts)],
        ["Instandhaltungsbudget", euro(scenario.maintenance)], ["Operativer Jahres-Cashflow", euro(chosen.operatingCashflow)],
        ["Kapitaldienst im ersten Jahr", euro(chosen.annualDebtService)], ["Jahres-Cashflow nach Finanzierung", euro(chosen.cashflow)],
      ]} />}
      {canEdit && <details open={!scenario}><summary className="cursor-pointer font-medium">Annahmen erfassen oder bearbeiten</summary>
        <div className="mt-4"><MasterForm key={selected + project.version} action={saveScenarioAction.bind(null, id)}
          hidden={{ ...version, kind: selected }} fields={scenarioFields(project, scenario)} submit="Szenario speichern" /></div>
      </details>}
    </Section>
    {scenario && chosen && <Section title="Darlehen und Tilgungspläne">
      {!scenario.loans.length && <p className="text-sm text-muted-foreground">Für dieses Szenario sind noch keine Darlehen erfasst.</p>}
      {scenario.loans.map((loan, index) => {
        const plan = chosen.schedules[index];
        return <article key={loan.id} className="grid gap-3 rounded-md border border-border p-4">
          <h3 className="font-semibold">{loan.label}</h3>
          <Details entries={[
            ["Darlehensbetrag", euro(loan.principal)], ["Beginn im Finanzierungsmonat", loan.startsMonth],
            ["Monatsrate ohne Sondertilgung", euro(plan.payment)], ["Restschuld nach Zinsbindung", euro(plan.outstanding)],
          ]} />
          <details><summary className="cursor-pointer text-primary">Tilgungsplan öffnen</summary>
            <div className="mt-3 overflow-x-auto" tabIndex={0}>
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead><tr className="border-b border-border">{["Monat", "Rate", "Zins", "Regeltilgung", "Sondertilgung", "Restschuld"].map((label) => <th scope="col" className="p-2" key={label}>{label}</th>)}</tr></thead>
                <tbody>{plan.schedule.map((row) => <tr className="border-b border-border" key={row.month}>
                  {[row.calendarMonth, euro(row.installment), euro(row.interest), euro(row.scheduledPrincipal), euro(row.extra), euro(row.outstanding)].map((cell, column) => <td className="whitespace-nowrap p-2" key={column}>{cell}</td>)}
                </tr>)}</tbody>
              </table>
            </div>
          </details>
          {canEdit && !loan.refinancedBy && <details><summary className="cursor-pointer text-primary">Darlehen bearbeiten</summary>
            <div className="mt-3"><MasterForm action={saveLoanAction.bind(null, id, scenario.id)} hidden={{ ...version, id: loan.id, refinancesId: loan.refinancesId ?? "" }}
              fields={loanFields([], loan)} submit="Darlehen speichern" /></div>
            {!loan.refinancesId && <div className="mt-3"><MasterForm action={archiveLoanAction.bind(null, id, loan.id)} hidden={version}
              submit="Darlehen aus Kalkulation entfernen" confirmation="Dieses Darlehen archivieren?" /></div>}
          </details>}
        </article>;
      })}
      {canEdit && <details><summary className="cursor-pointer font-medium">Darlehen oder Anschlussfinanzierung hinzufügen</summary>
        <div className="mt-4"><MasterForm action={saveLoanAction.bind(null, id, scenario.id)} hidden={{ ...version, id: crypto.randomUUID() }}
          fields={loanFields(scenario.loans.filter((loan, index) => !loan.refinancedBy && chosen.schedules[index].outstanding.gt(0)).map((loan) => ({ value: loan.id, label: loan.label })))}
          submit="Darlehen hinzufügen" /></div>
      </details>}
    </Section>}
    <Section title="Exposé und Unterlagen">
      {!project.documents.length && <p className="text-sm text-muted-foreground">Noch keine Unterlagen vorhanden.</p>}
      {project.documents.map((item) => <a key={item.id} href={"/api/dokumente/" + item.id} className="break-words text-primary underline" download>
        {documentTypes[item.type]} · {item.filename}
      </a>)}
      {canEdit && <UploadForm acquisitionId={id} choices={Object.entries(documentTypes).map(([id, name]) => ({ id, name }))} />}
    </Section>
    {canEdit && <Section title="In den Bestand übernehmen">
      <p className="text-sm text-muted-foreground">Die Stammdaten werden einmalig übernommen. Szenarien und Unterlagen bleiben im Kaufarchiv.</p>
      <MasterForm action={convertAction.bind(null, id)} hidden={version}
        fields={[{ name: "purchaseDate", label: "Tatsächliches Kaufdatum", type: "date", value: dateInput(project.purchaseDate ?? berlinToday()), required: true }]}
        submit="Als Bestandsimmobilie übernehmen" confirmation="Kaufprojekt in den Bestand übernehmen und Kalkulation archivieren?" />
    </Section>}
  </>;
}
