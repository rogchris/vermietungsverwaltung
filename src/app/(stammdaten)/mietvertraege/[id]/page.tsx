import Link from "next/link";
import { notFound } from "next/navigation";
import { conditionFields, leaseDetailFields } from "@/components/stammdaten/fields";
import { MasterForm } from "@/components/stammdaten/form";
import { ActionLink, Details, Notice, PageTitle, Section } from "@/components/stammdaten/views";
import { requireAccess } from "@/modules/authentication/access";
import { leaseDetail } from "@/modules/leases/service";
import { totalRent } from "@/modules/leases/rent";
import { berlinToday } from "@/modules/stammdaten/calendar";
import { chargeModes, displayDate, displayDecimal, displayPeriod, leaseStatus, rentModels } from "@/modules/stammdaten/presentation";
import { addConditionAction, updateLeaseAction } from "../../actions";
import { detailId, type DetailProps } from "../../routing";

export default async function LeasePage({ params, searchParams }: DetailProps) {
  const [session, query] = await Promise.all([requireAccess(), searchParams]);
  const id = await detailId(params);
  const lease = await leaseDetail(id);
  if (!lease) notFound();
  const href = `/mietvertraege/${id}`;
  const today = berlinToday();
  const canEdit = session.user.role === "ADMIN" && lease.unit.status !== "ARCHIVED" && !lease.unit.property.archivedAt;
  const editing = canEdit && query.bearbeiten === "1";
  const adding = canEdit && !editing && query.kondition === "1";
  const current = lease.startsOn <= today && (!lease.endsOn || lease.endsOn >= today)
    ? lease.terms.find((term) => term.effectiveFrom <= today) : undefined;
  const version = { version: String(lease.version) };

  return <>
    <PageTitle title="Mietvertrag" description={`${lease.unit.property.name} · ${lease.unit.label} · ${leaseStatus(lease.startsOn, lease.endsOn, today)}`}
      back={{ href: `/einheiten/${lease.unitId}`, label: "Einheit" }}
      action={canEdit && !editing && !adding && <ActionLink href={href + "?bearbeiten=1"}>Vertrag bearbeiten</ActionLink>} />
    <Notice value={query.meldung} />
    <div><ActionLink href={"/dokumente?objekt=" + lease.unit.property.id + "&vertrag=" + id}>Dokumente zum Vertrag</ActionLink></div>
    <Section title={editing ? "Vertragsdaten bearbeiten" : "Vertragsdaten"}>
      {editing ? <MasterForm key={lease.version} action={updateLeaseAction.bind(null, id)} fields={leaseDetailFields(lease)} hidden={version} cancel={href} /> :
        <Details entries={[
          ["Zeitraum", displayPeriod(lease.startsOn, lease.endsOn)], ["Mietmodell", rentModels[lease.rentModel]],
          ["Fälligkeitstag", `${lease.dueDay}. Kalendertag`], ["Kaution", displayDecimal(lease.deposit, "€")],
          ["Kautionsvereinbarung", lease.depositTerms || null],
          ["Aktuelle Gesamtmiete", current ? displayDecimal(totalRent(current), "€") : null],
        ]} />}
      <div>
        <h3 className="mb-2 text-sm font-semibold">Vertragsparteien</h3>
        <ul className="grid gap-2 text-sm">
          {lease.tenants.map(({ tenant }) => <li key={tenant.id}><Link href={`/mieter/${tenant.id}`} className="break-words text-primary underline">
            {tenant.firstName} {tenant.lastName}
          </Link></li>)}
        </ul>
      </div>
    </Section>
    <Section title="Mietkonditionen">
      {adding ? <MasterForm key={lease.version} action={addConditionAction.bind(null, id)} fields={conditionFields(lease.terms[0])} hidden={version} cancel={href} /> :
        canEdit && !editing && <div><ActionLink href={href + "?kondition=1"}>Mietänderung erfassen</ActionLink></div>}
      {lease.terms.length ? <ol aria-label="Historische Mietkonditionen" className="divide-y divide-border rounded-md border border-border">
        {lease.terms.map((term) => <li key={term.id} className="grid gap-3 p-4">
          <div className="flex flex-wrap justify-between gap-2 text-sm">
            <strong>Gültig ab {displayDate(term.effectiveFrom)}</strong>
            {term.id === current?.id && <span className="text-primary">Aktuell</span>}
          </div>
          <Details entries={[
            ["Nettokaltmiete", displayDecimal(term.baseRent, "€")],
            [`Betriebskosten · ${chargeModes[term.operatingMode]}`, displayDecimal(term.operatingCosts, "€")],
            [`Heizkosten · ${chargeModes[term.heatingMode]}`, displayDecimal(term.heatingCosts, "€")],
            ["Gesamtmiete", displayDecimal(totalRent(term), "€")],
          ]} />
        </li>)}
      </ol> : <p className="text-sm text-muted-foreground">Für diesen Vertrag sind keine Mietkonditionen hinterlegt.</p>}
    </Section>
  </>;
}
