import type { ReactNode } from "react";

export function Panel({ title, description, children }: { title: string; description?: string; children: ReactNode }) {
  return <section className="mx-auto grid w-full max-w-lg gap-5 rounded-xl border border-border bg-card p-5 sm:p-8">
    <div className="grid gap-2">
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{title}</h1>
      {description && <p className="text-sm leading-relaxed text-muted-foreground">{description}</p>}
    </div>
    {children}
  </section>;
}
