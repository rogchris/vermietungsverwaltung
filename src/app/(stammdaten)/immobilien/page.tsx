import { Filters } from "@/components/stammdaten/filters";
import { ActionLink, PageTitle, RecordList } from "@/components/stammdaten/views";
import { requireAccess } from "@/modules/authentication/access";
import { listProperties } from "@/modules/properties/service";
import { archiveChoices, choices, propertyTypes } from "@/modules/stammdaten/presentation";
import { queryOption, queryValue, type Search } from "../routing";

export default async function PropertiesPage({ searchParams }: { searchParams: Search }) {
  const [session, params] = await Promise.all([requireAccess(), searchParams]);
  const query = queryValue(params.q);
  const state = queryOption(params.status, ["aktiv", "archiviert", "alle"], "aktiv");
  const type = queryOption(params.typ, ["", ...Object.keys(propertyTypes) as (keyof typeof propertyTypes)[]] as const, "");
  const properties = await listProperties(query, state, type || undefined);

  return <>
    <PageTitle title="Immobilien" description="Objekte und zugehörige Einheiten verwalten."
      action={session.user.role === "ADMIN" && <ActionLink href="/immobilien/neu">Immobilie anlegen</ActionLink>} />
    <Filters action="/immobilien" query={query} placeholder="Objekt, Straße, PLZ oder Ort" selectors={[
      { name: "status", label: "Status", value: state, choices: choices(archiveChoices) },
      { name: "typ", label: "Immobilientyp", value: type, choices: [{ value: "", label: "Alle Typen" }, ...choices(propertyTypes)] },
    ]} />
    <RecordList records={properties.map((property) => ({
      href: `/immobilien/${property.id}`, title: property.name,
      subtitle: `${property.street} ${property.houseNumber}, ${property.postalCode} ${property.city} · ${property._count.units} ${property._count.units === 1 ? "Einheit" : "Einheiten"}`,
      status: property.archivedAt ? "Archiviert" : propertyTypes[property.type],
    }))} empty={query || state !== "aktiv" || type ? "Keine Immobilien für diese Auswahl." : "Noch keine aktiven Immobilien vorhanden."} />
  </>;
}
