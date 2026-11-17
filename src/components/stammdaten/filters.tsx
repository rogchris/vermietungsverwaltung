import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { Choice } from "./form";

export function Filters({ action, query, placeholder, selectors }: {
  action: string;
  query: string;
  placeholder: string;
  selectors: { name: string; label: string; value: string; choices: Choice[] }[];
}) {
  return <form action={action} method="get" className="grid items-end gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-2 xl:flex">
    <label className="grid min-w-0 flex-1 gap-2 text-sm font-medium">Suche
      <Input name="q" type="search" defaultValue={query} placeholder={placeholder} maxLength={80} />
    </label>
    {selectors.map(({ name, label, value, choices }) => <label key={name} className="grid gap-2 text-sm font-medium">{label}
      <select name={name} defaultValue={value} className="min-h-11 rounded-md border border-border bg-background px-3 text-base focus-visible:outline-primary">
        {choices.map((choice) => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
      </select>
    </label>)}
    <div className="flex min-h-11 items-center gap-4">
      <Button type="submit">Anwenden</Button>
      <Link href={action} className="text-sm text-primary underline">Zurücksetzen</Link>
    </div>
  </form>;
}
