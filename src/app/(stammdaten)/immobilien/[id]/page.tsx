import { notFound } from "next/navigation";
import { propertyFields } from "@/components/stammdaten/fields";
import { MasterForm } from "@/components/stammdaten/form";
import { ActionLink, Details, Notice, PageTitle, RecordList, Section } from "@/components/stammdaten/views";
import { requireAccess } from "@/modules/authentication/access";
import { propertyDetail } from "@/modules/properties/service";
import { states } from "@/modules/properties/validation";
import { displayDate, displayDecimal, propertyTypes, unitStatuses } from "@/modules/stammdaten/presentation";
import { archivePropertyAction, updatePropertyAction } from "../../actions";
import { detailId, type DetailProps } from "../../routing";

export default async function PropertyPage({ params, searchParams }: DetailProps) {
  const [session, query] = await Promise.all([requireAccess(), searchParams]);
  const id = await detailId(params);
  const property = await propertyDetail(id);
  if (!property) notFound();
  const href = `/immobilien/${id}`;
  const canManage = session.user.role === "ADMIN";
  const canEdit = canManage && !property.archivedAt;
  const editing = canEdit && query.bearbeiten === "1";
  const version = { version: String(property.version) };

  return <>
    <PageTitle title={property.name} description={property.archivedAt ? "Archivierte Immobilie" : propertyTypes[property.type]}
      back={{ href: "/immobilien", label: "Immobilien" }}
      action={canEdit && !editing && <ActionLink href={href + "?bearbeiten=1"}>Immobilie bearbeiten</ActionLink>} />
    <Notice value={query.meldung} />
    <div className="flex flex-wrap gap-3"><ActionLink href={"/dokumente?objekt=" + id}>Dokumente und Objektfotos</ActionLink>
      {property.acquisitionSource && <ActionLink href={"/ankauf/" + property.acquisitionSource.id}>Kaufarchiv öffnen</ActionLink>}
    </div>
    <Section title={editing ? "Objektdaten bearbeiten" : "Objektdaten"}>
      {editing ? <MasterForm key={property.version} action={updatePropertyAction.bind(null, id)} fields={propertyFields(property)} hidden={version} cancel={href} /> :
        <Details entries={[
          ["Anschrift", `${property.street} ${property.houseNumber}\n${property.postalCode} ${property.city}`],
          ["Bundesland", states[property.state as keyof typeof states] ?? property.state],
          ["Baujahr", property.builtYear], ["Wohnfläche", displayDecimal(property.livingArea, "m²")],
          ["Grundstücksfläche", displayDecimal(property.landArea, "m²")],
          ["Kaufdatum", displayDate(property.purchaseDate)], ["Kaufpreis", displayDecimal(property.purchasePrice, "€")],
          ["Beschreibung", property.description || null],
        ]} />}
    </Section>
    <Section title="Einheiten">
      {canEdit && <div><ActionLink href={href + "/einheit-anlegen"}>Einheit anlegen</ActionLink></div>}
      <RecordList records={property.units.map((unit) => ({
        href: `/einheiten/${unit.id}`, title: unit.label, subtitle: displayDecimal(unit.livingArea, "m²"),
        status: unitStatuses[unit.leases.length ? "RENTED" : unit.status],
      }))} empty="Für diese Immobilie sind noch keine Einheiten erfasst." />
    </Section>
    {canManage && !editing && <Section title="Archiv">
      <MasterForm key={property.version} action={archivePropertyAction.bind(null, id, !property.archivedAt)} hidden={version}
        submit={property.archivedAt ? "Immobilie reaktivieren" : "Immobilie archivieren"}
        confirmation={property.archivedAt ? "Immobilie reaktivieren?" : "Immobilie archivieren? Die Historie bleibt erhalten."} />
    </Section>}
  </>;
}
