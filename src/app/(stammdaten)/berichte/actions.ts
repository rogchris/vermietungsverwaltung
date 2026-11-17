"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { currentSession } from "@/modules/authentication/access";
import { allowsAccess } from "@/modules/authentication/policy";
import { ReportType } from "@/generated/prisma/enums";
import { enqueueReport } from "@/modules/reports/jobs";
import type { FormState } from "@/modules/stammdaten/form-state";
import { idSchema, optional } from "@/modules/stammdaten/validation";
import { MasterDataError } from "@/modules/stammdaten/mutations";
import { monthInput } from "@/modules/finance/validation";

const input = z.object({ id: idSchema, propertyId: optional(idSchema), type: z.enum(ReportType), period: monthInput, scope: z.enum(["monat", "jahr"]) });

export async function queueReportAction(_: FormState, form: FormData) {
  const session = await currentSession();
  if (!session || !allowsAccess(session)) return { message: "Bitte erneut anmelden." };
  const result = input.safeParse(Object.fromEntries(form));
  if (!result.success) return { message: "Bitte prüfe die Auswahl." };
  const { id, propertyId, type, period, scope } = result.data;
  if (scope === "jahr") period.setUTCMonth(0);
  try {
    await enqueueReport(session.user.id, id, propertyId, type, period, scope === "jahr" ? 12 : 1);
  } catch (cause) {
    if (cause instanceof MasterDataError) return { message: cause.message };
    return { message: "Der Berichtsauftrag konnte nicht gespeichert werden." };
  }
  redirect("/berichte?auftrag=1");
}
