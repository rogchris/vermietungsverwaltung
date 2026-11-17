"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentSession } from "@/modules/authentication/access";
import { allowsAccess } from "@/modules/authentication/policy";
import type { FormState } from "@/modules/stammdaten/form-state";
import { idSchema, versionSchema } from "@/modules/stammdaten/validation";
import { MasterDataError } from "@/modules/stammdaten/mutations";
import { acquireInput, loanInput, projectInput, scenarioInput } from "@/modules/acquisition/validation";
import { archiveLoan, convertProject, saveLoan, saveProject, saveScenario } from "@/modules/acquisition/service";

const version = z.object({ version: versionSchema });

async function submit<T>(schema: z.ZodType<T>, form: FormData, operation: (actor: string, values: T) => Promise<string>) {
  const session = await currentSession();
  if (!session || !allowsAccess(session, true)) return { message: "Für diese Änderung ist ein Administratorkonto mit bestätigter Anmeldung erforderlich." };
  const result = schema.safeParse(Object.fromEntries(form));
  if (!result.success) return { message: "Bitte prüfe die markierten Angaben.", errors: z.flattenError(result.error).fieldErrors };
  let href: string;
  try { href = await operation(session.user.id, result.data); } catch (cause) {
    if (cause instanceof MasterDataError) return { message: cause.message };
    console.error("Ankaufsvorgang fehlgeschlagen.");
    return { message: "Der Vorgang konnte nicht gespeichert werden." };
  }
  revalidatePath("/", "layout");
  redirect(href);
}

function target(id: string) {
  if (!idSchema.safeParse(id).success) throw new MasterDataError("Ungültige Vorgangsnummer.");
  return id;
}

export async function createProjectAction(_: FormState, form: FormData) {
  return submit(projectInput.extend({ id: idSchema }), form, async (actor, { id, ...data }) => {
    await saveProject(actor, id, data);
    return `/ankauf/${id}?meldung=gespeichert`;
  });
}

export async function updateProjectAction(id: string, _: FormState, form: FormData) {
  return submit(projectInput.extend(version.shape), form, async (actor, { version, ...data }) => {
    await saveProject(actor, target(id), data, version);
    return `/ankauf/${id}?meldung=gespeichert`;
  });
}

export async function saveScenarioAction(id: string, _: FormState, form: FormData) {
  return submit(scenarioInput.extend(version.shape), form, async (actor, { version, ...data }) => {
    await saveScenario(actor, target(id), version, data);
    return `/ankauf/${id}?szenario=${data.kind}&meldung=gespeichert`;
  });
}

export async function saveLoanAction(projectId: string, scenarioId: string, _: FormState, form: FormData) {
  return submit(loanInput.safeExtend(version.shape), form, async (actor, { version, ...data }) => {
    const kind = await saveLoan(actor, target(projectId), target(scenarioId), version, data);
    return `/ankauf/${projectId}?szenario=${kind}&meldung=gespeichert`;
  });
}

export async function convertAction(id: string, _: FormState, form: FormData) {
  return submit(acquireInput, form, async (actor, { version, purchaseDate }) => {
    const property = await convertProject(actor, target(id), version, purchaseDate);
    return `/immobilien/${property}?meldung=uebernommen`;
  });
}

export async function archiveLoanAction(projectId: string, id: string, _: FormState, form: FormData) {
  return submit(version, form, async (actor, { version }) => {
    const kind = await archiveLoan(actor, target(projectId), target(id), version);
    return `/ankauf/${projectId}?szenario=${kind}&meldung=gespeichert`;
  });
}
