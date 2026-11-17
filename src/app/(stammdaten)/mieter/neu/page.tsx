import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { tenantFields } from "@/components/stammdaten/fields";
import { MasterForm } from "@/components/stammdaten/form";
import { PageTitle, Section } from "@/components/stammdaten/views";
import { requireAccess } from "@/modules/authentication/access";
import { createTenantAction } from "../../actions";

export default async function NewTenantPage() {
  if ((await requireAccess()).user.role !== "ADMIN") redirect("/mieter");
  return <>
    <PageTitle title="Mieter anlegen" back={{ href: "/mieter", label: "Mieter" }} />
    <Section title="Kontaktdaten">
      <MasterForm action={createTenantAction} fields={tenantFields()} hidden={{ requestId: randomUUID() }} cancel="/mieter" />
    </Section>
  </>;
}
