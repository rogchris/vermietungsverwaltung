import { randomUUID } from "node:crypto";
import { notFound, redirect } from "next/navigation";
import { unitFields } from "@/components/stammdaten/fields";
import { MasterForm } from "@/components/stammdaten/form";
import { PageTitle, Section } from "@/components/stammdaten/views";
import { requireAccess } from "@/modules/authentication/access";
import { propertyDetail } from "@/modules/properties/service";
import { createUnitAction } from "../../../actions";
import { detailId, type DetailProps } from "../../../routing";

export default async function NewUnitPage({ params }: Pick<DetailProps, "params">) {
  const session = await requireAccess();
  const id = await detailId(params);
  const href = `/immobilien/${id}`;
  if (session.user.role !== "ADMIN") redirect(href);
  const property = await propertyDetail(id);
  if (!property) notFound();
  if (property.archivedAt) redirect(href);
  return <>
    <PageTitle title="Einheit anlegen" description={property.name} back={{ href, label: "Immobilie" }} />
    <Section title="Daten der Einheit">
      <MasterForm action={createUnitAction.bind(null, id)} fields={unitFields()} hidden={{ requestId: randomUUID() }} cancel={href} />
    </Section>
  </>;
}
