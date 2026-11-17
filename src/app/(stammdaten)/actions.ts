"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { currentSession } from "@/modules/authentication/access";
import { allowsAccess } from "@/modules/authentication/policy";
import { propertyInput } from "@/modules/properties/validation";
import { saveProperty, setPropertyArchived } from "@/modules/properties/service";
import { unitInput } from "@/modules/rental-units/validation";
import { saveUnit, setUnitArchived } from "@/modules/rental-units/service";
import { tenantInput } from "@/modules/tenants/validation";
import { anonymizeArchivedTenant, saveTenant, setTenantArchived } from "@/modules/tenants/service";
import { addRentCondition, createLease, updateLease } from "@/modules/leases/service";
import { conditionInput, leaseDetails, leaseInput } from "@/modules/leases/validation";
import type { FormState } from "@/modules/stammdaten/form-state";
import { MasterDataError } from "@/modules/stammdaten/mutations";
import { idSchema, versionSchema } from "@/modules/stammdaten/validation";

const request = z.object({ requestId: idSchema });
const version = z.object({ version: versionSchema });

function readFields(form: FormData) {
  return { ...Object.fromEntries(form), tenantIds: form.getAll("tenantIds") };
}

async function submit<T>(
  schema: z.ZodType<T>,
  form: FormData,
  perform: (actor: string, data: T) => Promise<string>,
): Promise<FormState> {
  const session = await currentSession();
  if (!session || !allowsAccess(session, true)) return { message: "Für diese Änderung ist ein Administratorkonto mit bestätigter Anmeldung erforderlich." };

  const result = schema.safeParse(readFields(form));
  if (!result.success) return { message: "Bitte prüfe die markierten Angaben.", errors: z.flattenError(result.error).fieldErrors };
  let path: string;
  try {
    path = await perform(session.user.id, result.data);
  } catch (error) {
    if (error instanceof MasterDataError) return { message: error.message };
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      return { message: "Der Datensatz wurde bereits gespeichert oder eine eindeutige Bezeichnung ist schon vergeben." };
    }
    console.error("Stammdaten konnten nicht gespeichert werden.");
    return { message: "Speichern fehlgeschlagen. Bitte versuche es erneut." };
  }
  revalidatePath("/", "layout");
  redirect(path);
}

function target(id: string) {
  if (!idSchema.safeParse(id).success) throw new MasterDataError("Ungültiger Datensatz.");
  return id;
}

export async function createPropertyAction(_: FormState, form: FormData) {
  return submit(propertyInput.extend(request.shape), form, async (actor, { requestId, ...data }) => {
    await saveProperty(actor, requestId, data);
    return `/immobilien/${requestId}?meldung=gespeichert`;
  });
}

export async function updatePropertyAction(id: string, _: FormState, form: FormData) {
  return submit(propertyInput.extend(version.shape), form, async (actor, { version, ...data }) => {
    await saveProperty(actor, target(id), data, version);
    return `/immobilien/${id}?meldung=gespeichert`;
  });
}

export async function archivePropertyAction(id: string, archived: boolean, _: FormState, form: FormData) {
  return submit(version, form, async (actor, data) => {
    await setPropertyArchived(actor, target(id), data.version, archived);
    return `/immobilien/${id}?meldung=${archived ? "archiviert" : "aktiviert"}`;
  });
}

export async function createUnitAction(propertyId: string, _: FormState, form: FormData) {
  return submit(unitInput.extend(request.shape), form, async (actor, { requestId, ...data }) => {
    await saveUnit(actor, target(propertyId), requestId, data);
    return `/einheiten/${requestId}?meldung=gespeichert`;
  });
}

export async function updateUnitAction(propertyId: string, id: string, _: FormState, form: FormData) {
  return submit(unitInput.extend(version.shape), form, async (actor, { version, ...data }) => {
    await saveUnit(actor, target(propertyId), target(id), data, version);
    return `/einheiten/${id}?meldung=gespeichert`;
  });
}

export async function archiveUnitAction(id: string, archived: boolean, _: FormState, form: FormData) {
  return submit(version, form, async (actor, data) => {
    await setUnitArchived(actor, target(id), data.version, archived);
    return `/einheiten/${id}?meldung=${archived ? "archiviert" : "aktiviert"}`;
  });
}

export async function createTenantAction(_: FormState, form: FormData) {
  return submit(tenantInput.extend(request.shape), form, async (actor, { requestId, ...data }) => {
    await saveTenant(actor, requestId, data);
    return `/mieter/${requestId}?meldung=gespeichert`;
  });
}

export async function updateTenantAction(id: string, _: FormState, form: FormData) {
  return submit(tenantInput.extend(version.shape), form, async (actor, { version, ...data }) => {
    await saveTenant(actor, target(id), data, version);
    return `/mieter/${id}?meldung=gespeichert`;
  });
}

export async function archiveTenantAction(id: string, archived: boolean, _: FormState, form: FormData) {
  return submit(version, form, async (actor, data) => {
    await setTenantArchived(actor, target(id), data.version, archived);
    return `/mieter/${id}?meldung=${archived ? "archiviert" : "aktiviert"}`;
  });
}

export async function createLeaseAction(unitId: string, _: FormState, form: FormData) {
  return submit(leaseInput.safeExtend(request.shape), form, async (actor, { requestId, ...data }) => {
    await createLease(actor, target(unitId), requestId, data);
    return `/mietvertraege/${requestId}?meldung=gespeichert`;
  });
}

export async function updateLeaseAction(id: string, _: FormState, form: FormData) {
  return submit(leaseDetails.extend(version.shape), form, async (actor, { version, ...data }) => {
    await updateLease(actor, target(id), version, data);
    return `/mietvertraege/${id}?meldung=gespeichert`;
  });
}

export async function addConditionAction(id: string, _: FormState, form: FormData) {
  return submit(conditionInput.safeExtend(version.shape), form, async (actor, { version, ...data }) => {
    await addRentCondition(actor, target(id), version, data);
    return `/mietvertraege/${id}?meldung=kondition`;
  });
}

export async function anonymizeTenantAction(id: string, _: FormState, form: FormData) {
  return submit(version, form, async (actor, data) => {
    await anonymizeArchivedTenant(actor, target(id), data.version);
    return `/mieter/${id}?meldung=anonymisiert`;
  });
}
