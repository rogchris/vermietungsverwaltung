"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { currentSession } from "@/modules/authentication/access";
import { allowsAccess } from "@/modules/authentication/policy";
import { MasterDataError } from "@/modules/stammdaten/mutations";
import type { FormState } from "@/modules/stammdaten/form-state";
import { idSchema } from "@/modules/stammdaten/validation";
import { allocationInput, correctionInput, expenseInput, generationInput, paymentInput, requestId, voidInput } from "@/modules/finance/validation";
import { assignPayment, correctReceivable, generateReceivables, recordExpense, recordPayment, reverseEntry, runFinanceWrite } from "@/modules/finance/service";

async function submit<T>(schema: z.ZodType<T>, form: FormData, operation: (actor: string, data: T) => Promise<unknown>, target: string) {
  const session = await currentSession();
  if (!session || !allowsAccess(session, true)) return { message: "Für Buchungen ist ein Administratorkonto mit bestätigter Anmeldung erforderlich." };
  const values = schema.safeParse({ ...Object.fromEntries(form), allocations: [] });
  if (!values.success) return { message: "Bitte prüfe die markierten Angaben.", errors: z.flattenError(values.error).fieldErrors };
  let result: unknown;
  try { result = await runFinanceWrite(() => operation(session.user.id, values.data)); } catch (cause) {
    if (cause instanceof MasterDataError) return { message: cause.message };
    console.error("Finanzvorgang fehlgeschlagen.");
    return { message: "Der Vorgang konnte nicht gespeichert werden." };
  }
  revalidatePath("/", "layout");
  redirect(target + (target.includes("?") ? "&" : "?") + (typeof result === "number" ? "erstellt=" + result : "meldung=gespeichert"));
}

function returnTo(form: FormData) {
  const candidate = form.get("returnTo");
  return typeof candidate === "string" && /^\/finanzen\?(?:monat=\d{4}-\d{2}|objekt=[\da-f-]{36})(?:&(?:objekt=[\da-f-]{36}|zeitraum=jahr))*$/.test(candidate) ? candidate : "/finanzen";
}

export async function generateAction(_: FormState, form: FormData) {
  return submit(generationInput, form, (actor, data) => generateReceivables(actor, data.period, data.propertyId), returnTo(form));
}

export async function paymentAction(_: FormState, form: FormData) {
  return submit(paymentInput, form, recordPayment, returnTo(form));
}

export async function expenseAction(_: FormState, form: FormData) {
  return submit(expenseInput, form, recordExpense, returnTo(form));
}

export async function allocationAction(paymentId: string, _: FormState, form: FormData) {
  if (!idSchema.safeParse(paymentId).success) return { message: "Ungültige Zahlung." };
  return submit(allocationInput.extend(requestId.shape), form, (actor, { id, ...data }) => assignPayment(actor, paymentId, id, data), returnTo(form));
}

export async function reverseAction(kind: "payment" | "expense" | "allocation" | "receivable", _: FormState, form: FormData) {
  if (!["payment", "expense", "allocation", "receivable"].includes(kind)) return { message: "Ungültige Buchungsart." };
  return submit(voidInput, form, (actor, { id, reason }) => reverseEntry(actor, kind, id, reason), returnTo(form));
}

export async function correctionAction(_: FormState, form: FormData) {
  return submit(correctionInput, form, correctReceivable, returnTo(form));
}
