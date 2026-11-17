"use client";
import { useRef, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";

type Option = { id: string; name: string };
export function UploadForm({ propertyId, acquisitionId, choices, targets, defaults }: {
  propertyId?: string; acquisitionId?: string; choices: Option[]; targets?: { units: Option[]; leases: Option[]; expenses: Option[] };
  defaults?: { unit?: string; lease?: string; expense?: string };
}) {
  const lock = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const field = "min-h-11 w-full min-w-0 rounded-md border border-border bg-background p-2 text-base";
  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (lock.current) return;
    const data = new FormData(event.currentTarget);
    const file = data.get("file");
    if (!(file instanceof File) || !file.size || file.size > 10 * 1024 * 1024) {
      setError("Bitte wähle eine Datei bis 10 MiB."); return;
    }
    lock.current = true;
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/dokumente", { method: "POST", body: data });
      if (response.ok) {
        window.location.replace(acquisitionId ? "/ankauf/" + acquisitionId + "?hochgeladen=1" : "/dokumente?objekt=" + propertyId + "&hochgeladen=1"); return;
      }
      const body = await response.json().catch(() => null);
      setError(response.status === 422 && typeof body?.error === "string" ? body.error : "Upload fehlgeschlagen. Bitte prüfe Größe und Anmeldung.");
    } catch { setError("Die Verbindung wurde unterbrochen."); } finally {
      lock.current = false;
      setPending(false);
    }
  }
  return <form method="post" onSubmit={upload} className="grid gap-3">
    {propertyId && <input type="hidden" name="propertyId" value={propertyId} />}
    {acquisitionId && <input type="hidden" name="acquisitionProjectId" value={acquisitionId} />}
    <fieldset disabled={pending} className="grid min-w-0 gap-3 sm:grid-cols-2">
      <label className="grid min-w-0 gap-2 text-sm">Datei *<input className={field} name="file" type="file" accept=".pdf,.jpg,.jpeg,.png" required /></label>
      <label className="grid gap-2 text-sm">Dokumenttyp *<select className={field} name="type">{choices.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
      {targets && ([{ name: "unitId", title: "Einheit", options: targets.units, value: defaults?.unit }, { name: "leaseId", title: "Mietvertrag", options: targets.leases, value: defaults?.lease },
        { name: "expenseId", title: "Ausgabenbeleg", options: targets.expenses, value: defaults?.expense }]).map((target) => <label key={target.name} className="grid gap-2 text-sm">{target.title}
        <select className={field} name={target.name} defaultValue={target.value ?? ""}><option value="">Keine Zuordnung</option>{target.options.map((option) => <option key={option.id} value={option.id}>{option.name}</option>)}</select>
      </label>)}
      <label className="grid gap-2 text-sm">Beschreibung<input className={field} name="description" maxLength={500} /></label>
    </fieldset>
    <p className="text-xs text-muted-foreground">PDF, JPEG oder PNG bis 10 MiB. {targets && "Einheit, Mietvertrag oder Ausgabenbeleg können jeweils einzeln zugeordnet werden."}</p>
    {error && <p role="alert" className="text-sm text-red-300">{error}</p>}
    <Button className="w-fit" type="submit" disabled={pending}>{pending ? "Wird geprüft …" : "Dokument hochladen"}</Button>
  </form>;
}
