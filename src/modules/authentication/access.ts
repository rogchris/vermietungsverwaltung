import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getAuth } from "./auth";
import { allowsAccess } from "./policy";

export async function currentSession() {
  const requestHeaders = await headers();
  return getAuth().api.getSession({ headers: requestHeaders });
}

export async function requireSession() {
  const session = await currentSession();
  if (!session) redirect("/anmelden");
  return session;
}

export async function requireAccess() {
  const session = await requireSession();
  if (!session.user.twoFactorEnabled) redirect("/sicherheit/einrichten");
  if (!allowsAccess(session)) redirect("/anmelden?erneut=1");
  return session;
}
