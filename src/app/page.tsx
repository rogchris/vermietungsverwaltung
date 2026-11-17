import Link from "next/link";
import { Building2, FileText, KeyRound, LayoutDashboard, ShieldCheck, Users, Wallet } from "lucide-react";
import { SignOutButton } from "@/components/auth/forms";
import { Panel } from "@/components/auth/panel";
import { requireAccess } from "@/modules/authentication/access";

export default async function Home() {
  const { user } = await requireAccess();
  return <Panel title="Arbeitsbereich" description={`Angemeldet als ${user.name}.`}>
    <nav aria-label="Arbeitsbereiche" className="grid gap-2">
      <Link href="/dashboard" className="flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline"><LayoutDashboard aria-hidden="true" className="size-5" /> Dashboard</Link>
      <Link href="/immobilien" className="flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline"><Building2 aria-hidden="true" className="size-5" /> Immobilien</Link>
      <Link href="/mieter" className="flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline"><Users aria-hidden="true" className="size-5" /> Mieter</Link>
      <Link href="/mietvertraege" className="flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline"><FileText aria-hidden="true" className="size-5" /> Mietverträge</Link>
      <Link href="/finanzen" className="flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline"><Wallet aria-hidden="true" className="size-5" /> Finanzen</Link>
      <Link href="/ankauf" className="flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline"><KeyRound aria-hidden="true" className="size-5" /> Ankauf</Link>
    </nav>
    <Link href="/sicherheit" className="flex min-h-11 items-center gap-2 text-sm font-medium text-primary underline">
      <ShieldCheck aria-hidden="true" className="size-5" /> Kontosicherheit
    </Link>
    <SignOutButton />
  </Panel>;
}
