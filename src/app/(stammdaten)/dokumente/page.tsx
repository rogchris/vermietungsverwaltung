import { requireAccess } from "@/modules/authentication/access";
import { getDb } from "@/lib/db";
import { displayDate } from "@/modules/stammdaten/presentation";
import { idSchema } from "@/modules/stammdaten/validation";
import { documentList, documentTargets, documentTypes } from "@/modules/documents/service";
import { Details, PageTitle, Section } from "@/components/stammdaten/views";
import { UploadForm } from "@/components/documents/upload";
import { Filters } from "@/components/stammdaten/filters";
import { queryValue, type Search } from "../routing";

export default async function DocumentsPage({ searchParams }: { searchParams: Search }) {
  const [session, params] = await Promise.all([requireAccess(), searchParams]);
  const result = idSchema.safeParse(params.objekt);
  const propertyId = result.success ? result.data : null;
  const query = queryValue(params.q);
  const [properties, documents, targets] = await Promise.all([
    getDb().property.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    documentList(propertyId, query), propertyId && session.user.role === "ADMIN" ? documentTargets(propertyId) : null,
  ]);
  const valid = (value: unknown) => { const result = idSchema.safeParse(value); return result.success ? result.data : undefined; };

  return <>
    <PageTitle title="Dokumente" description="Geschütztes Archiv für Objektunterlagen und Belege." />
    <Filters action="/dokumente" query={query} placeholder="Dateiname, Beschreibung oder Immobilie" selectors={[
      { name: "objekt", label: "Immobilie", value: propertyId ?? "", choices: [{ value: "", label: "Alle Immobilien" }, ...properties.map((item) => ({ value: item.id, label: item.name }))] },
    ]} />
    {params.hochgeladen === "1" && <p role="status" className="text-primary">Dokument gespeichert.</p>}
    {session.user.role === "ADMIN" && <Section title="Upload">
      {targets && propertyId ? <UploadForm propertyId={propertyId} choices={Object.entries(documentTypes).map(([id, name]) => ({ id, name }))}
        defaults={{ unit: valid(params.einheit), lease: valid(params.vertrag), expense: valid(params.ausgabe) }}
        targets={{ units: targets.units.map((item) => ({ id: item.id, name: item.label })),
          leases: targets.units.flatMap((unit) => unit.leases.map((item) => ({ id: item.id, name: unit.label + " · " + displayDate(item.startsOn) }))),
          expenses: targets.expenses.map((item) => ({ id: item.id, name: displayDate(item.paidOn) + " · " + item.description })) }} /> :
        <p className="text-sm text-muted-foreground">Wähle eine Immobilie im Filter, um ein Dokument hochzuladen.</p>}
    </Section>}
    <Section title="Dateien">
      {!documents.length && <p className="text-sm text-muted-foreground">Keine passenden Dokumente vorhanden.</p>}
      {documents.map((file) => <article key={file.id} className="grid gap-3 rounded-md border border-border p-4">
        <a href={`/api/dokumente/${file.id}`} className="break-all font-medium text-primary underline" download>{file.filename}</a>
        <Details entries={[
          ["Objekt", file.property?.name], ["Dokumenttyp", documentTypes[file.type]], ["Hochgeladen", displayDate(file.createdAt)],
          ["Zuordnung", file.unit?.label ?? (file.lease ? file.lease.unit.label + " · Vertrag vom " + displayDate(file.lease.startsOn) : file.expense?.description)],
          ["Beschreibung", file.description || null],
        ]} />
      </article>)}
    </Section>
  </>;
}
