import { notFound } from "next/navigation";
import { unitFields } from "@/components/stammdaten/fields";
import { MasterForm } from "@/components/stammdaten/form";
import { ActionLink, Details, Notice, PageTitle, RecordList, Section } from "@/components/stammdaten/views";
import { requireAccess } from "@/modules/authentication/access";
import { unitDetail } from "@/modules/rental-units/service";
import { berlinToday } from "@/modules/stammdaten/calendar";
import { displayDecimal, displayPeriod, leaseStatus, unitStatuses, unitUses } from "@/modules/stammdaten/presentation";
import { archiveUnitAction, updateUnitAction } from "../../actions";
import { detailId, type DetailProps } from "../../routing";

export default async function UnitPage({ params, searchParams }: DetailProps) {
  const [session, query] = await Promise.all([requireAccess(), searchParams]);
  const id = await detailId(params);
  const unit = await unitDetail(id);
  if (!unit) notFound();
  const href = `/einheiten/${id}`;
  const today = berlinToday();
  const activeLease = unit.leases.some(({ startsOn, endsOn }) => startsOn <= today && (!endsOn || endsOn >= today));
  const canManage = session.user.role === "ADMIN" && !unit.property.archivedAt;
  const canEdit = canManage && unit.status !== "ARCHIVED";
  const editing = canEdit && query.bearbeiten === "1";
  const version = { version: String(unit.version) };

  return <>
    <PageTitle title={unit.label} description={`${unit.property.name} · ${unitStatuses[activeLease ? "RENTED" : unit.status]}`}
      back={{ href: `/immobilien/${unit.propertyId}`, label: "Immobilie" }}
      action={canEdit && !editing && <ActionLink href={href + "?bearbeiten=1"}>Einheit bearbeiten</ActionLink>} />
    <Notice value={query.meldung} />
    <div><ActionLink href={"/dokumente?objekt=" + unit.propertyId + "&einheit=" + id}>Dokumente zur Einheit</ActionLink></div>
    <Section title={editing ? "Einheit bearbeiten" : "Daten der Einheit"}>
      {editing ? <MasterForm key={unit.version} action={updateUnitAction.bind(null, unit.propertyId, id)} fields={unitFields(unit)} hidden={version} cancel={href} /> :
        <Details entries={[
          ["Nutzungsart", unitUses[unit.use]], ["Etage", unit.floor], ["Wohnfläche", displayDecimal(unit.livingArea, "m²")],
          ["Zimmeranzahl", displayDecimal(unit.rooms, "").trim()], ["Stellplätze", unit.parkingSpaces],
          ["Grundstatus", unitStatuses[unit.status]], ["Ausstattung", unit.features || null],
        ]} />}
    </Section>
    <Section title="Mietverträge">
      {canEdit && <div><ActionLink href={href + "/vertrag-anlegen"}>Mietvertrag anlegen</ActionLink></div>}
      <RecordList records={unit.leases.map((lease) => ({
        href: `/mietvertraege/${lease.id}`,
        title: lease.tenants.map(({ tenant }) => `${tenant.firstName} ${tenant.lastName}`).join(", ") || "Mietvertrag",
        subtitle: displayPeriod(lease.startsOn, lease.endsOn), status: leaseStatus(lease.startsOn, lease.endsOn, today),
      }))} empty="Für diese Einheit sind noch keine Mietverträge erfasst." />
    </Section>
    {canManage && !editing && <Section title="Archiv">
      <MasterForm key={unit.version} action={archiveUnitAction.bind(null, id, unit.status !== "ARCHIVED")} hidden={version}
        submit={unit.status === "ARCHIVED" ? "Einheit reaktivieren" : "Einheit archivieren"}
        confirmation={unit.status === "ARCHIVED" ? "Einheit als leerstehend reaktivieren?" : "Einheit archivieren? Die Historie bleibt erhalten."} />
    </Section>}
  </>;
}
