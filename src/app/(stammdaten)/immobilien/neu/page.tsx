import { randomUUID } from "node:crypto";
import { redirect } from "next/navigation";
import { propertyFields } from "@/components/stammdaten/fields";
import { MasterForm } from "@/components/stammdaten/form";
import { PageTitle, Section } from "@/components/stammdaten/views";
import { requireAccess } from "@/modules/authentication/access";
import { createPropertyAction } from "../../actions";

export default async function NewPropertyPage() {
  if ((await requireAccess()).user.role !== "ADMIN") redirect("/immobilien");
  return <>
    <PageTitle title="Immobilie anlegen" back={{ href: "/immobilien", label: "Immobilien" }} />
    <Section title="Objektdaten">
      <MasterForm action={createPropertyAction} fields={propertyFields()} hidden={{ requestId: randomUUID() }} cancel="/immobilien" />
    </Section>
  </>;
}
