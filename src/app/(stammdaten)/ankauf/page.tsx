import { requireAccess } from "@/modules/authentication/access";
import { projects } from "@/modules/acquisition/service";
import { ActionLink, PageTitle, RecordList, Section } from "@/components/stammdaten/views";
import { MasterForm } from "@/components/stammdaten/form";
import { projectFields } from "@/components/acquisition/fields";
import { euro } from "@/components/finance/overview";
import type { Search } from "../routing";
import { createProjectAction } from "./actions";

export default async function AcquisitionPage({ searchParams }: { searchParams: Search }) {
  const [session, params] = await Promise.all([requireAccess(), searchParams]);
  const creating = params.neu === "1" && session.user.role === "ADMIN";
  const rows = creating ? [] : await projects();
  return <>
    <PageTitle title={creating ? "Kaufobjekt anlegen" : "Ankauf"} description="Kaufobjekte, Szenarien und Finanzierungen vergleichen."
      action={!creating && session.user.role === "ADMIN" && <ActionLink href="/ankauf?neu=1">Kaufobjekt anlegen</ActionLink>} />
    {creating ? <Section title="Kaufobjektdaten"><MasterForm action={createProjectAction} fields={projectFields()}
      hidden={{ id: crypto.randomUUID() }} cancel="/ankauf" /></Section> :
      <RecordList empty="Noch keine Kaufobjekte vorhanden." records={rows.map((row) => ({
        href: `/ankauf/${row.id}`, title: row.name, subtitle: row.city + " · " + euro(row.purchasePrice),
        status: row.convertedAt ? "Übernommen · archiviert" : "In Prüfung",
      }))} />}
  </>;
}
