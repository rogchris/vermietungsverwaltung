import Link from "next/link";
import { SecurityForms } from "@/components/auth/forms";
import { Panel } from "@/components/auth/panel";
import { requireAccess } from "@/modules/authentication/access";

export default async function SecurityPage() {
  await requireAccess();
  return <Panel title="Kontosicherheit">
    <Link href="/" className="text-sm text-primary underline">Zurück zum Arbeitsbereich</Link>
    <SecurityForms />
  </Panel>;
}
