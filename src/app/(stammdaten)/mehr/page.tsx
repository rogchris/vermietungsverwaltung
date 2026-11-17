import { requireAccess } from "@/modules/authentication/access";
import { PageTitle, RecordList } from "@/components/stammdaten/views";

export default async function MorePage() {
  const session = await requireAccess();
  return <>
    <PageTitle title="Mehr" description="Dokumente, Berichte und Kontoeinstellungen." />
    <RecordList empty="" records={[
      { title: "Dokumente", href: "/dokumente" }, { title: "Berichte", href: "/berichte" },
      { title: "Mieter", href: "/mieter" }, { title: "Mietverträge", href: "/mietvertraege" }, { title: "Kontosicherheit", href: "/sicherheit" },
    ]} />
    {session.user.role === "ADMIN" && <a href="/api/verwaltung/export" download className="w-fit text-sm text-primary underline">Vollständigen Datenexport herunterladen</a>}
  </>;
}
