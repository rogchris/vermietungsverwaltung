import type { z } from "zod";
import { getDb } from "@/lib/db";
import { berlinToday, unexpiredLeaseOn } from "../stammdaten/calendar";
import { audit, ensureVersion, MasterDataError, writeMasterData } from "../stammdaten/mutations";
import type { tenantInput } from "./validation";

type TenantInput = z.output<typeof tenantInput>;

export function listTenants(query: string, state = "aktiv") {
  const words = query ? query.split(/\s+/) : [];
  return getDb().tenant.findMany({
    where: {
      archivedAt: state === "archiviert" ? { not: null } : state === "alle" ? undefined : null,
      AND: words.map((word) => {
        const match = { contains: word, mode: "insensitive" as const };
        return { OR: [{ firstName: match }, { lastName: match }, { email: match }] };
      }),
    },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
  });
}

export function tenantDetail(id: string) {
  return getDb().tenant.findUnique({
    where: { id },
    include: {
      leases: {
        orderBy: { lease: { startsOn: "desc" } },
        include: { lease: { include: { unit: { include: { property: { select: { name: true } } } } } } },
      },
    },
  });
}

export function tenantOptions() {
  return getDb().tenant.findMany({
    where: { archivedAt: null },
    select: { id: true, firstName: true, lastName: true, city: true },
    orderBy: [{ lastName: "asc" }, { firstName: "asc" }, { id: "asc" }],
  });
}

export function saveTenant(actor: string, id: string, data: TenantInput, version?: number) {
  return writeMasterData(async (tx) => {
    if (version === undefined) {
      await tx.tenant.create({ data: { id, ...data } });
    } else {
      ensureVersion(await tx.tenant.updateMany({
        where: { id, version, archivedAt: null }, data: { ...data, version: { increment: 1 } },
      }));
    }
    await audit(tx, actor, version === undefined ? "tenant.created" : "tenant.updated", "Tenant", id);
  });
}

export function setTenantArchived(actor: string, id: string, version: number, archived: boolean) {
  const today = berlinToday();
  return writeMasterData(async (tx) => {
    if (archived && await tx.leaseTenant.findFirst({
      where: { tenantId: id, lease: unexpiredLeaseOn(today) }, select: { tenantId: true },
    })) {
      throw new MasterDataError("Für diese Person gibt es laufende oder zukünftige Mietverträge.");
    }
    ensureVersion(await tx.tenant.updateMany({
      where: { id, version, archivedAt: archived ? null : { not: null }, anonymizedAt: null },
      data: { archivedAt: archived ? new Date() : null, version: { increment: 1 } },
    }));
    await audit(tx, actor, archived ? "tenant.archived" : "tenant.restored", "Tenant", id);
  });
}

export function anonymizeArchivedTenant(actor: string, id: string, version: number) {
  return writeMasterData(async (tx) => {
    ensureVersion(await tx.tenant.updateMany({
      where: { id, version, archivedAt: { not: null }, anonymizedAt: null },
      data: { firstName: "Anonymisiert", lastName: id.slice(0, 8), street: "", houseNumber: "", postalCode: "",
        city: "", phone: null, email: null, anonymizedAt: new Date(), version: { increment: 1 } },
    }));
    await audit(tx, actor, "tenant.anonymized", "Tenant", id);
  });
}
