"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { currentSession } from "@/modules/authentication/access";
import { allowsAccess } from "@/modules/authentication/policy";
import type { FormState } from "@/modules/stammdaten/form-state";
import { MasterDataError } from "@/modules/stammdaten/mutations";
import { idSchema } from "@/modules/stammdaten/validation";
import { enqueueBankPackage } from "@/modules/bank-package/service";
import { bankInput } from "@/modules/bank-package/validation";
import { evidenceKeys } from "@/modules/bank-package/options";

export async function queueBankPackage(projectId: string, _: FormState, form: FormData) {
  const session = await currentSession();
  if (!session || !allowsAccess(session)) return { message: "Bitte erneut anmelden." };
  if (!idSchema.safeParse(projectId).success) return { message: "Ungültiges Kaufprojekt." };
  const result = bankInput.safeParse({
    id: form.get("id"), appendices: form.getAll("appendices"), sections: form.getAll("sections"), rentRows: form.get("rentRows"), riskNotes: form.get("riskNotes"),
    evidence: Object.fromEntries(evidenceKeys.map((key) => [key, form.get("evidence_" + key) ?? ""])),
  });
  if (!result.success) return { message: "Bitte prüfe die Angaben.", errors: z.flattenError(result.error).fieldErrors };
  try {
    await enqueueBankPackage(session.user.id, projectId, result.data);
  } catch (error) {
    if (error instanceof MasterDataError) return { message: error.message };
    console.error("Bankmappenauftrag fehlgeschlagen.");
    return { message: "Die Bankmappe konnte nicht beauftragt werden." };
  }
  redirect("/ankauf/" + projectId + "/bankmappe?version=" + result.data.id);
}
