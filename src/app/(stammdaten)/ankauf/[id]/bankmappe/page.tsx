import Link from "next/link";
import { notFound } from "next/navigation";
import { getDb } from "@/lib/db";
import { requireAccess } from "@/modules/authentication/access";
import { bankDocuments, bankPayload, ownedBankVersion } from "@/modules/bank-package/service";
import { bankSections, evidenceKeys, evidenceTypes, sectionKeys } from "@/modules/bank-package/options";
import { idSchema } from "@/modules/stammdaten/validation";
import { displayDate } from "@/modules/stammdaten/presentation";
import { MasterForm } from "@/components/stammdaten/form";
import { PageTitle, Section } from "@/components/stammdaten/views";
import { RefreshReportJobs } from "@/components/reports/refresh";
import { detailId, type DetailProps } from "../../../routing";
import { queueBankPackage } from "./actions";

const statuses = { QUEUED: "In Warteschlange", RUNNING: "Wird erstellt", READY: "Bereit", FAILED: "Fehlgeschlagen" } as const;

export default async function BankPackagePage({ params, searchParams }: DetailProps) {
  const [session, id, query] = await Promise.all([requireAccess(), detailId(params), searchParams]);
  const db = getDb();
  const project = await db.acquisitionProject.findUnique({ where: { id }, select: { name: true, acquiredPropertyId: true } });
  if (!project) notFound();
  const selectedId = idSchema.safeParse(query.version);
  const href = "/ankauf/" + id + "/bankmappe";
  const [files, versions, selected] = await Promise.all([
    bankDocuments(db, id, project.acquiredPropertyId),
    db.bankSnapshot.findMany({ where: { projectId: id, job: { userId: session.user.id } },
      select: { jobId: true, version: true, createdAt: true, job: { select: { status: true } } }, orderBy: { version: "desc" } }),
    selectedId.success ? ownedBankVersion(selectedId.data, id, session.user.id) : null,
  ]);
  if (query.version !== undefined && !selected) notFound();
  const snapshot = selected ? bankPayload(selected) : null;
  const checked = sectionKeys.filter((key) => key !== "documents");
  return <>
    <PageTitle title="Bankmappe" description={project.name} back={{ href: "/ankauf/" + id, label: "Kaufprojekt" }} />
    {versions.some((version) => version.job.status === "QUEUED" || version.job.status === "RUNNING") && <RefreshReportJobs />}
    {selected && snapshot && <Section title={"Bankmappe · Version " + selected.version}>
      <p role="status">{statuses[selected.job.status]} · Erstellt am {displayDate(selected.createdAt)}{selected.job.failure ? " · " + selected.job.failure : ""}</p>
      <p className="text-sm text-muted-foreground">Projektstand im Snapshot: {snapshot.project.name}.</p>
      {selected.job.status === "READY" && <div className="flex flex-wrap gap-4 text-sm text-primary">
        <a href={"/api/berichte/" + selected.jobId} className="underline" download>Bankmappe herunterladen</a>
        <a href={"/api/berichte/" + selected.jobId + "?druck=1"} target="_blank" rel="noreferrer" className="underline">Bankmappe zum Drucken öffnen</a>
      </div>}
      <h3 className="font-semibold">Vollständigkeitsprüfung</h3>
      <ul className="grid gap-2 text-sm">
        {snapshot.checklist.map((item) => {
          const file = snapshot.attachments.find((entry) => entry.id === item.attachmentId);
          return <li key={item.key}>{evidenceTypes[item.key]} · {file ? "Vorhanden (" + file.reference + ")" : <strong>Fehlt</strong>}</li>;
        })}
      </ul>
      <h3 className="font-semibold">Originalanlagen</h3>
      {snapshot.attachments.length ? <ul className="grid gap-2 text-sm">
        {snapshot.attachments.map((file) => <li key={file.id} className="break-words">
          {file.available ? <a className="text-primary underline" download href={"/api/berichte/" + selected.jobId + "/anlagen/" + file.id}>
            {file.reference} · {file.filename}
          </a> : <span>{file.reference} · {file.filename} · Datei fehlt</span>}
        </li>)}
      </ul> : <p className="text-sm text-muted-foreground">Keine Originalanlagen in dieser Version.</p>}
    </Section>}
    <Section title="Berichtsversionen">
      {versions.length ? <ul className="grid gap-2">
        {versions.map((version) => <li key={version.jobId}>
          <Link href={href + "?version=" + version.jobId} className="text-primary underline">
            Version {version.version} · {displayDate(version.createdAt)} · {statuses[version.job.status]}
          </Link>
        </li>)}
      </ul> : <p className="text-sm text-muted-foreground">Noch keine Bankmappe beauftragt.</p>}
    </Section>
    <Section title="Neue Bankmappe erstellen">
      <p className="text-sm text-muted-foreground">Deckblatt, Inhaltsverzeichnis und Anlagenprüfung sind fest enthalten. Mit jeder neuen Version wird der aktuelle Stand eingefroren. Ordne Nachweise nur den Angaben zu, die sie tatsächlich belegen.</p>
      <MasterForm action={queueBankPackage.bind(null, id)} hidden={{ id: crypto.randomUUID() }} submit="Bankmappe erstellen"
        fields={[
          { name: "sections", label: "Kapitel", type: "checkboxes", checkedValues: checked, options: checked.map((key) => ({ value: key, label: bankSections[key] })) },
          ...evidenceKeys.map((key) => ({ name: "evidence_" + key, label: evidenceTypes[key], type: "select" as const,
            options: [{ value: "", label: "Fehlt / nicht zugeordnet" }, ...files.map((file) => ({ value: file.id, label: file.filename }))] })),
          ...(files.length ? [{ name: "appendices", label: "Originale als PDF-Anlagen anhängen", type: "checkboxes" as const,
            hint: "Optional. Wähle bis zu zwölf Nachweise mit insgesamt höchstens 25 MiB. Das Anlagenverzeichnis führt alle zugehörigen Dateien auf.",
            options: files.map((file) => ({ value: file.id, label: file.filename })) }] : []),
          { name: "rentRows", label: "Mietpositionen", type: "textarea", maxLength: 6000,
            hint: "Eine Position je Zeile, etwa EG links | vermietet | 800,00 | Angabe. Weitere Status: leer, geplant. Herkunft: Angabe oder Schätzung. Ohne Eingabe verwendet die Mappe, soweit vorhanden, die Bestandsmieten." },
          { name: "riskNotes", label: "Eigene Risikohinweise", type: "textarea", maxLength: 1800 },
        ]} />
    </Section>
  </>;
}
