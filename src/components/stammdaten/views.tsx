import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowLeft, ChevronRight } from "lucide-react";

export function PageTitle({ title, description, back, action }: {
  title: string; description?: string; back?: { href: string; label: string }; action?: ReactNode;
}) {
  return <header className="grid gap-3">
    {back && <Link href={back.href} className="flex w-fit items-center gap-2 py-1 text-sm text-primary underline">
      <ArrowLeft className="size-4" aria-hidden="true" /> {back.label}
    </Link>}
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0">
        <h1 className="break-words text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 break-words text-sm text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  </header>;
}

export function ActionLink({ href, children }: { href: string; children: ReactNode }) {
  return <Link href={href} className="inline-flex min-h-11 items-center rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/85">{children}</Link>;
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return <section className="grid min-w-0 gap-4 rounded-lg border border-border bg-card p-4 sm:p-6">
    <h2 className="text-lg font-semibold">{title}</h2>
    {children}
  </section>;
}

export function Details({ entries }: { entries: [string, ReactNode][] }) {
  return <dl className="grid gap-4 sm:grid-cols-2">
    {entries.map(([label, value]) => <div key={label} className="min-w-0">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="mt-1 whitespace-pre-wrap break-words text-sm">{value ?? "–"}</dd>
    </div>)}
  </dl>;
}

export function RecordList({ records, empty }: {
  records: { href: string; title: string; subtitle?: string; status?: string }[]; empty: string;
}) {
  if (!records.length) return <p className="rounded-lg border border-dashed border-border p-5 text-sm text-muted-foreground">{empty}</p>;
  return <ul className="divide-y divide-border rounded-lg border border-border bg-card">
    {records.map(({ href, title, subtitle, status }) => <li key={href}>
      <Link href={href} className="flex min-h-16 items-center gap-3 px-4 py-3 hover:bg-background">
        <div className="grid min-w-0 flex-1 gap-1">
          <span className="break-words font-medium">{title}</span>
          {subtitle && <span className="break-words text-sm text-muted-foreground">{subtitle}</span>}
        </div>
        {status && <span className="text-right text-xs text-primary">{status}</span>}
        <ChevronRight className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
      </Link>
    </li>)}
  </ul>;
}

const notices: Record<string, string> = {
  uebernommen: "Kaufobjekt in den Bestand übernommen.",
  anonymisiert: "Kontaktdaten anonymisiert.",
  gespeichert: "Änderung gespeichert.",
  archiviert: "Datensatz archiviert.",
  aktiviert: "Datensatz reaktiviert.",
  kondition: "Neue Mietkondition gespeichert.",
};

export function Notice({ value }: { value: string | string[] | undefined }) {
  if (typeof value !== "string" || !Object.hasOwn(notices, value)) return null;
  return <p role="status" className="rounded-md border border-primary/30 bg-card px-4 py-3 text-sm text-primary">{notices[value]}</p>;
}
