import { redirect } from "next/navigation";
import { SignInForm } from "@/components/auth/forms";
import { Panel } from "@/components/auth/panel";
import { currentSession } from "@/modules/authentication/access";
import { allowsAccess } from "@/modules/authentication/policy";

export default async function SignInPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const [params, session] = await Promise.all([searchParams, currentSession()]);
  if (allowsAccess(session)) redirect("/");
  if (session && !session.user.twoFactorEnabled) redirect("/sicherheit/einrichten");

  return <Panel title="Anmelden" description="Melde dich am privaten Arbeitsbereich an.">
    {params.passwort === "1" && <p role="status" className="text-sm text-primary">Passwort gespeichert. Melde dich erneut an.</p>}
    {params.erneut === "1" && <p role="status" className="text-sm text-primary">Melde dich mit deinem zweiten Faktor erneut an.</p>}
    <SignInForm retry={Boolean(session)} />
  </Panel>;
}
