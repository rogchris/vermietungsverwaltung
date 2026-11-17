import { notFound } from "next/navigation";
import { tenantFields } from "@/components/stammdaten/fields";
import { MasterForm } from "@/components/stammdaten/form";
import { ActionLink, Details, Notice, PageTitle, RecordList, Section } from "@/components/stammdaten/views";
import { requireAccess } from "@/modules/authentication/access";
import { tenantDetail } from "@/modules/tenants/service";
import { berlinToday } from "@/modules/stammdaten/calendar";
import { displayPeriod, leaseStatus } from "@/modules/stammdaten/presentation";
import { anonymizeTenantAction, archiveTenantAction, updateTenantAction } from "../../actions";
import { detailId, type DetailProps } from "../../routing";

export default async function TenantPage({ params, searchParams }: DetailProps) {
  const [session, query] = await Promise.all([requireAccess(), searchParams]);
  const id = await detailId(params);
  const tenant = await tenantDetail(id);
  if (!tenant) notFound();
  const href = `/mieter/${id}`;
  const today = berlinToday();
  const canManage = session.user.role === "ADMIN";
  const canEdit = canManage && !tenant.archivedAt;
  const editing = canEdit && query.bearbeiten === "1";
  const version = { version: String(tenant.version) };

  return <>
    <PageTitle title={`${tenant.firstName} ${tenant.lastName}`} description={tenant.archivedAt ? "Archivierter Kontakt" : undefined}
      back={{ href: "/mieter", label: "Mieter" }}
      action={canEdit && !editing && <ActionLink href={href + "?bearbeiten=1"}>Mieter bearbeiten</ActionLink>} />
    <Notice value={query.meldung} />
    <Section title={editing ? "Kontaktdaten bearbeiten" : "Kontaktdaten"}>
      {editing ? <MasterForm key={tenant.version} action={updateTenantAction.bind(null, id)} fields={tenantFields(tenant)} hidden={version} cancel={href} /> :
        <Details entries={[
          ["Anschrift", `${tenant.street} ${tenant.houseNumber}\n${tenant.postalCode} ${tenant.city} · ${tenant.countryCode}`],
          ["Telefon", tenant.phone], ["E-Mail", tenant.email],
        ]} />}
    </Section>
    <Section title="Mietverhältnisse">
      <RecordList records={tenant.leases.map(({ lease }) => ({
        href: `/mietvertraege/${lease.id}`, title: `${lease.unit.property.name} · ${lease.unit.label}`,
        subtitle: displayPeriod(lease.startsOn, lease.endsOn), status: leaseStatus(lease.startsOn, lease.endsOn, today),
      }))} empty="Für diesen Mieter sind noch keine Mietverhältnisse erfasst." />
    </Section>
    {canManage && !editing && !tenant.anonymizedAt && <Section title="Archiv">
      <MasterForm key={tenant.version} action={archiveTenantAction.bind(null, id, !tenant.archivedAt)} hidden={version}
        submit={tenant.archivedAt ? "Mieter reaktivieren" : "Mieter archivieren"}
        confirmation={tenant.archivedAt ? "Mieter reaktivieren?" : "Mieter archivieren? Historische Verträge bleiben verknüpft."} />
      {tenant.archivedAt && <div className="border-t border-border pt-4">
        <p className="mb-3 text-sm text-muted-foreground">Nach Ablauf der Aufbewahrung kannst du Kontaktdaten dauerhaft entfernen. Prüfe auch zugehörige Dateien und Berichte.</p>
        <MasterForm action={anonymizeTenantAction.bind(null, id)} hidden={version} submit="Kontaktdaten anonymisieren"
          confirmation="Kontaktdaten dauerhaft anonymisieren? Vertrags- und Finanzreferenzen bleiben erhalten." />
      </div>}
    </Section>}
  </>;
}
