import { redirect } from "next/navigation";
import { EnrollmentForm, SignOutButton } from "@/components/auth/forms";
import { Panel } from "@/components/auth/panel";
import { requireSession } from "@/modules/authentication/access";

export default async function EnrollmentPage() {
  const session = await requireSession();
  if (session.user.twoFactorEnabled) redirect("/");
  return <Panel title="Zwei-Faktor-Schutz einrichten" description="Richte deinen zweiten Faktor ein, bevor du den Arbeitsbereich öffnest.">
    <EnrollmentForm />
    <SignOutButton label="Einrichtung abbrechen und abmelden" />
  </Panel>;
}
