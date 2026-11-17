import { getDb } from "@/lib/db";
import { requireAccess } from "@/modules/authentication/access";
import { financeSelection } from "@/modules/finance/presentation";
import { reportTypes } from "@/modules/reports/content";
import { choices, displayDate } from "@/modules/stammdaten/presentation";
import { MasterForm } from "@/components/stammdaten/form";
import { PageTitle, Section } from "@/components/stammdaten/views";
import { PeriodFilter } from "@/components/finance/overview";
import { RefreshReportJobs } from "@/components/reports/refresh";
import { queueReportAction } from "./actions";
import type { Search } from "../routing";

const statuses = { QUEUED: "In Warteschlange", RUNNING: "Wird erstellt", READY: "Bereit", FAILED: "Fehlgeschlagen" } as const;

export default async function ReportsPage({ searchParams }: { searchParams: Search }) {
  const [session, params] = await Promise.all([requireAccess(), searchParams]);
  const selection = financeSelection(params);
  const [properties, jobs] = await Promise.all([
    getDb().property.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    getDb().reportJob.findMany({ where: { userId: session.user.id, type: { not: "BANK_PACKAGE" } }, include: { property: { select: { name: true } } },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50 }),
  ]);
  return <>
    <PageTitle title="Berichte" description="Druckfertige DIN-A4-Berichte aus den Bestands- und Finanzdaten." />
    <PeriodFilter href="/berichte" selection={selection} properties={properties} />
    <Section title="PDF erstellen">
      {params.auftrag === "1" && <p role="status" className="text-primary">Bericht beauftragt.</p>}
      <MasterForm action={queueReportAction} hidden={{ id: crypto.randomUUID(), period: selection.selected, propertyId: selection.propertyId ?? "", scope: selection.scope }}
        fields={[{ name: "type", label: "Berichtstyp", type: "select", options: choices(reportTypes).filter((item) => item.value !== "BANK_PACKAGE"), required: true }]} submit="PDF erstellen" />
    </Section>
    <Section title="Meine Berichtsaufträge">
      {!jobs.length && <p className="text-sm text-muted-foreground">Es wurden noch keine Berichte beauftragt.</p>}
      {jobs.some((item) => item.status === "QUEUED" || item.status === "RUNNING") && <RefreshReportJobs />}
      {jobs.map((job) => <article key={job.id} className="grid gap-2 rounded-md border border-border p-4">
        <h3 className="font-medium">{reportTypes[job.type]}</h3>
        <p className="text-sm text-muted-foreground">{job.property?.name ?? "Gesamter Bestand"} · {job.period.toISOString().slice(0, job.months === 12 ? 4 : 7)} · Erstellt {displayDate(job.createdAt)}</p>
        <p className="text-sm">{statuses[job.status]}{job.failure ? " · " + job.failure : ""}</p>
        {job.status === "READY" && <div className="flex flex-wrap gap-4 text-sm text-primary">
          <a href={`/api/berichte/${job.id}`} download className="underline">PDF herunterladen</a>
          <a href={`/api/berichte/${job.id}?druck=1`} target="_blank" rel="noreferrer" className="underline">PDF zum Drucken öffnen</a>
        </div>}
      </article>)}
    </Section>
  </>;
}
