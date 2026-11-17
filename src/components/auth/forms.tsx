"use client";

import { useEffect, useRef, useState, type ComponentProps, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authClient } from "@/modules/authentication/client";

function navigateAfterAuth(path: string) {
  // Die neue Anfrage soll die aktualisierten Cookies serverseitig prüfen.
  window.location.assign(path);
}

function useAction() {
  const busy = useRef(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function run(action: () => Promise<void>) {
    if (busy.current) return;
    busy.current = true;
    setPending(true);
    setError("");
    try {
      await action();
    } catch {
      setError("Die Anfrage konnte nicht abgeschlossen werden. Bitte versuche es erneut.");
    } finally {
      busy.current = false;
      setPending(false);
    }
  }
  return { pending, error, setError, run };
}

function Field({ label, ...props }: ComponentProps<"input"> & { label: string }) {
  return <label className="grid gap-2 text-sm font-medium">
    {label}
    <Input {...props} required />
  </label>;
}

function ErrorMessage({ message }: { message: string }) {
  return message ? <p role="alert" className="text-sm text-red-300">{message}</p> : null;
}

function values(event: FormEvent<HTMLFormElement>) {
  event.preventDefault();
  return new FormData(event.currentTarget);
}

export function SignInForm({ retry }: { retry: boolean }) {
  const action = useAction();
  const [challenge, setChallenge] = useState(false);
  const [recovery, setRecovery] = useState(false);
  return <form method="post" className="grid gap-4" onSubmit={(event) => {
    const data = values(event);
    void action.run(async () => {
      if (challenge) {
        const code = String(data.get("code")).trim();
        const result = recovery
          ? await authClient.twoFactor.verifyBackupCode({ code })
          : await authClient.twoFactor.verifyTotp({ code });
        if (result.error) {
          action.setError("Der Code ist ungültig, abgelaufen oder vorübergehend gesperrt.");
          return;
        }
      } else {
        if (retry) await authClient.signOut();
        const result = await authClient.signIn.email({
          email: String(data.get("email")), password: String(data.get("password")), rememberMe: false,
        });
        if (result.error) {
          action.setError(result.error.status === 429 ? "Zu viele Versuche. Bitte warte eine Minute." : "Anmeldung fehlgeschlagen. Bitte prüfe deine Angaben.");
          return;
        }
        if (result.data && "twoFactorRedirect" in result.data && result.data.twoFactorRedirect) {
          setChallenge(true);
          return;
        }
      }
      navigateAfterAuth("/");
    });
  }}>
    {challenge ? <>
      <Field key={String(recovery)} label={recovery ? "Wiederherstellungscode" : "Code aus der Authenticator-App"}
        name="code" autoComplete="one-time-code" inputMode={recovery ? "text" : "numeric"}
        pattern={recovery ? undefined : "[0-9]{6}"} maxLength={recovery ? 64 : 6} />
      <Button className="border border-border bg-transparent text-foreground hover:bg-card" disabled={action.pending} onClick={() => {
        setRecovery(!recovery);
        action.setError("");
      }}>{recovery ? "Authenticator-Code verwenden" : "Wiederherstellungscode verwenden"}</Button>
    </> : <>
      <Field label="E-Mail-Adresse" name="email" type="email" autoComplete="username" maxLength={254} />
      <Field label="Passwort" name="password" type="password" autoComplete="current-password" maxLength={128} />
    </>}
    <ErrorMessage message={action.error} />
    <Button type="submit" disabled={action.pending}>{action.pending ? "Wird geprüft …" : challenge ? "Code bestätigen" : "Anmelden"}</Button>
    {challenge && <a href="/anmelden" className="text-sm text-primary underline">Anmeldung neu starten</a>}
  </form>;
}

function useCodeWarning(hasCodes: boolean) {
  useEffect(() => {
    if (!hasCodes) return;
    const warn = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [hasCodes]);
}

function RecoveryCodes({ codes }: { codes: string[] }) {
  return <div className="grid gap-2">
    <p className="text-sm text-muted-foreground">Bewahre die Einmalcodes getrennt vom Passwort auf. Sie werden hier einmalig angezeigt.</p>
    <ul aria-label="Wiederherstellungscodes" className="grid grid-cols-2 gap-2 rounded-md border border-border p-3 font-mono text-sm">
      {codes.map((code) => <li key={code}>{code}</li>)}
    </ul>
  </div>;
}

export function EnrollmentForm() {
  const action = useAction();
  const [enrollment, setEnrollment] = useState<{ secret: string; codes: string[] }>();
  const [saved, setSaved] = useState(false);
  useCodeWarning(Boolean(enrollment) && !saved);
  return <form method="post" className="grid gap-4" onSubmit={(event) => {
    const data = values(event);
    void action.run(async () => {
      if (enrollment) {
        const result = await authClient.twoFactor.verifyTotp({ code: String(data.get("code")) });
        if (result.error) {
          action.setError("Der Code konnte nicht bestätigt werden. Prüfe die Uhrzeit und den aktuellen Code.");
          return;
        }
        navigateAfterAuth("/");
        return;
      }
      const result = await authClient.twoFactor.enable({ password: String(data.get("password")) });
      if (!result.data || result.error) {
        action.setError("Die Einrichtung konnte nicht gestartet werden. Prüfe das Passwort.");
        return;
      }
      if (result.data.method !== "totp") throw new Error("TOTP required");
      const secret = new URL(result.data.totpURI).searchParams.get("secret");
      if (!secret) throw new Error("TOTP secret missing");
      setEnrollment({ secret, codes: result.data.backupCodes });
    });
  }}>
    {enrollment ? <>
      <p className="text-sm text-muted-foreground">Lege in deiner Authenticator-App einen zeitbasierten Eintrag an und übertrage diesen Schlüssel.</p>
      <code className="select-all break-all rounded-md bg-background p-3 text-primary" data-testid="totp-secret">{enrollment.secret}</code>
      <RecoveryCodes codes={enrollment.codes} />
      <label className="flex items-start gap-2 text-sm">
        <input required type="checkbox" checked={saved} onChange={(event) => setSaved(event.target.checked)} className="mt-1" />
        Ich habe die Wiederherstellungscodes sicher abgelegt.
      </label>
      <Field label="Code aus der Authenticator-App" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]{6}" maxLength={6} />
    </> : <Field label="Passwort" name="password" type="password" autoComplete="current-password" maxLength={128} />}
    <ErrorMessage message={action.error} />
    <Button type="submit" disabled={action.pending}>{action.pending ? "Wird geprüft …" : enrollment ? "MFA aktivieren" : "Schlüssel erstellen"}</Button>
  </form>;
}

export function SignOutButton({ label = "Abmelden" }: { label?: string }) {
  const action = useAction();
  return <div className="grid gap-2">
    <Button className="border border-border bg-transparent text-foreground hover:bg-card" disabled={action.pending} onClick={() => void action.run(async () => {
      const result = await authClient.signOut();
      if (result.error) {
        action.setError("Abmeldung fehlgeschlagen. Bitte versuche es erneut.");
        return;
      }
      navigateAfterAuth("/anmelden");
    })}>{action.pending ? "Wird abgemeldet …" : label}</Button>
    <ErrorMessage message={action.error} />
  </div>;
}

export function SecurityForms() {
  const passwordAction = useAction();
  const recoveryAction = useAction();
  const sessionAction = useAction();
  const [codes, setCodes] = useState<string[]>([]);
  const [sessionsRevoked, setSessionsRevoked] = useState(false);
  useCodeWarning(codes.length > 0);
  return <div className="grid gap-8">
    <form method="post" className="grid gap-4" onSubmit={(event) => {
      const data = values(event);
      void passwordAction.run(async () => {
        const result = await authClient.changePassword({
          currentPassword: String(data.get("current")), newPassword: String(data.get("next")), revokeOtherSessions: true,
        });
        if (result.error) {
          passwordAction.setError("Das Passwort konnte nicht geändert werden. Prüfe deine Angaben.");
          return;
        }
        await authClient.signOut();
        navigateAfterAuth("/anmelden?passwort=1");
      });
    }}>
      <h2 className="text-lg font-semibold">Passwort ändern</h2>
      <Field label="Aktuelles Passwort" name="current" type="password" autoComplete="current-password" maxLength={128} />
      <Field label="Neues Passwort (mindestens 14 Zeichen)" name="next" type="password" autoComplete="new-password" minLength={14} maxLength={128} />
      <ErrorMessage message={passwordAction.error} />
      <Button type="submit" disabled={passwordAction.pending}>{passwordAction.pending ? "Wird gespeichert …" : "Passwort speichern"}</Button>
    </form>
    <form method="post" className="grid gap-4" onSubmit={(event) => {
      const form = event.currentTarget;
      const data = values(event);
      void recoveryAction.run(async () => {
        const result = await authClient.twoFactor.generateBackupCodes({ password: String(data.get("password")) });
        if (!result.data || result.error) {
          recoveryAction.setError("Die Wiederherstellungscodes konnten nicht erstellt werden.");
          return;
        }
        form.reset();
        setCodes(result.data.backupCodes);
      });
    }}>
      <h2 className="text-lg font-semibold">Wiederherstellungscodes</h2>
      <p className="text-sm text-muted-foreground">Beim Erstellen neuer Codes werden die bisherigen ungültig.</p>
      {codes.length > 0 && <><RecoveryCodes codes={codes} /><Button onClick={() => setCodes([])}>Codes ausblenden</Button></>}
      <Field label="Passwort für neue Codes" name="password" type="password" autoComplete="current-password" maxLength={128} />
      <ErrorMessage message={recoveryAction.error} />
      <Button type="submit" disabled={recoveryAction.pending}>{recoveryAction.pending ? "Wird erstellt …" : "Neue Codes erstellen"}</Button>
    </form>
    <section className="grid gap-4">
      <h2 className="text-lg font-semibold">Aktive Sitzungen</h2>
      <Button disabled={sessionAction.pending} onClick={() => void sessionAction.run(async () => {
        const result = await authClient.revokeOtherSessions();
        if (result.error) {
          sessionAction.setError("Andere Sitzungen konnten nicht widerrufen werden.");
          return;
        }
        setSessionsRevoked(true);
      })}>{sessionAction.pending ? "Wird widerrufen …" : "Andere Sitzungen widerrufen"}</Button>
      <ErrorMessage message={sessionAction.error} />
      {sessionsRevoked && <p role="status" className="text-sm text-muted-foreground">Andere Sitzungen wurden widerrufen.</p>}
    </section>
  </div>;
}
