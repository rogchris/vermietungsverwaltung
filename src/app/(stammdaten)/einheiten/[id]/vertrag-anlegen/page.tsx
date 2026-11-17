import { randomUUID } from "node:crypto";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { leaseCreateFields } from "@/components/stammdaten/fields";
import { MasterForm } from "@/components/stammdaten/form";
import { PageTitle, Section } from "@/components/stammdaten/views";
import { requireAccess } from "@/modules/authentication/access";
import { unitDetail } from "@/modules/rental-units/service";
import { tenantOptions } from "@/modules/tenants/service";
import { createLeaseAction } from "../../../actions";
import { detailId, type DetailProps } from "../../../routing";

export default async function NewLeasePage({ params }: Pick<DetailProps, "params">) {
  const session = await requireAccess();
  const id = await detailId(params);
  const href = `/einheiten/${id}`;
  if (session.user.role !== "ADMIN") redirect(href);
  const [unit, tenants] = await Promise.all([unitDetail(id), tenantOptions()]);
  if (!unit) notFound();
  if (unit.status === "ARCHIVED" || unit.property.archivedAt) redirect(href);
  return <>
    <PageTitle title="Mietvertrag anlegen" description={`${unit.property.name} · ${unit.label}`} back={{ href, label: "Einheit" }} />
    <Section title="Vertragsdaten und erste Mietkondition">
      {tenants.length ? <MasterForm action={createLeaseAction.bind(null, id)} fields={leaseCreateFields(
        tenants.map((tenant) => ({ value: tenant.id, label: `${tenant.firstName} ${tenant.lastName} · ${tenant.city}` })),
      )} hidden={{ requestId: randomUUID() }} cancel={href} /> :
        <p className="text-sm text-muted-foreground">Lege zuerst mindestens einen Mieter an. <Link href="/mieter/neu" className="text-primary underline">Mieter anlegen</Link></p>}
    </Section>
  </>;
}
