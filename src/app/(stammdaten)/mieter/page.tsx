import { Filters } from "@/components/stammdaten/filters";
import { ActionLink, PageTitle, RecordList } from "@/components/stammdaten/views";
import { requireAccess } from "@/modules/authentication/access";
import { listTenants } from "@/modules/tenants/service";
import { archiveChoices, choices } from "@/modules/stammdaten/presentation";
import { queryOption, queryValue, type Search } from "../routing";

export default async function TenantsPage({ searchParams }: { searchParams: Search }) {
  const [session, params] = await Promise.all([requireAccess(), searchParams]);
  const query = queryValue(params.q);
  const state = queryOption(params.status, ["aktiv", "archiviert", "alle"], "aktiv");
  const tenants = await listTenants(query, state);

  return <>
    <PageTitle title="Mieter" description="Kontakte und zugeordnete Mietverhältnisse."
      action={session.user.role === "ADMIN" && <ActionLink href="/mieter/neu">Mieter anlegen</ActionLink>} />
    <Filters action="/mieter" query={query} placeholder="Name oder E-Mail" selectors={[
      { name: "status", label: "Status", value: state, choices: choices(archiveChoices) },
    ]} />
    <RecordList records={tenants.map((tenant) => ({
      href: `/mieter/${tenant.id}`, title: `${tenant.firstName} ${tenant.lastName}`,
      subtitle: `${tenant.postalCode} ${tenant.city}`, status: tenant.archivedAt ? "Archiviert" : undefined,
    }))} empty={query || state !== "aktiv" ? "Keine Mieter für diese Auswahl." : "Noch keine aktiven Mieter vorhanden."} />
  </>;
}
