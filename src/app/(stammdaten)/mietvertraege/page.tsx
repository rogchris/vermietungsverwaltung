import Link from "next/link";
import { Filters } from "@/components/stammdaten/filters";
import { PageTitle, RecordList } from "@/components/stammdaten/views";
import { requireAccess } from "@/modules/authentication/access";
import { listLeases } from "@/modules/leases/service";
import { berlinToday } from "@/modules/stammdaten/calendar";
import { choices, displayPeriod, leaseStates, leaseStatus } from "@/modules/stammdaten/presentation";
import { queryOption, queryValue, type Search } from "../routing";

export default async function LeasesPage({ searchParams }: { searchParams: Search }) {
  const [session, params] = await Promise.all([requireAccess(), searchParams]);
  const query = queryValue(params.q);
  const state = queryOption(params.status, ["alle", "laufend", "zukuenftig", "beendet"], "alle");
  const leases = await listLeases(query, state);
  const today = berlinToday();

  return <>
    <PageTitle title="Mietverträge" description="Laufende, zukünftige und beendete Mietverhältnisse." />
    {session.user.role === "ADMIN" && <p className="text-sm text-muted-foreground">
      Neue Verträge legst du über die jeweilige Einheit an. <Link href="/immobilien" className="text-primary underline">Immobilien öffnen</Link>
    </p>}
    <Filters action="/mietvertraege" query={query} placeholder="Immobilie, Einheit oder Name" selectors={[
      { name: "status", label: "Status", value: state, choices: choices(leaseStates) },
    ]} />
    <RecordList records={leases.map((lease) => ({
      href: `/mietvertraege/${lease.id}`, title: `${lease.unit.property.name} · ${lease.unit.label}`,
      subtitle: [
        lease.tenants.map(({ tenant }) => `${tenant.firstName} ${tenant.lastName}`).join(", "),
        displayPeriod(lease.startsOn, lease.endsOn),
      ].filter(Boolean).join(" · "),
      status: leaseStatus(lease.startsOn, lease.endsOn, today),
    }))} empty={query || state !== "alle" ? "Keine Mietverträge für diese Auswahl." : "Noch keine Mietverträge vorhanden."} />
  </>;
}
