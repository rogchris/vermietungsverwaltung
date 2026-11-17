import type { z } from "zod";
import type { Prisma, PropertyType } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { activeLeaseOn, berlinToday, unexpiredLeaseOn } from "../stammdaten/calendar";
import { audit, ensureVersion, MasterDataError, writeMasterData } from "../stammdaten/mutations";
import type { propertyInput } from "./validation";

type PropertyInput = z.output<typeof propertyInput>;

export function listProperties(query: string, state: string, type?: PropertyType) {
  const contains = { contains: query, mode: "insensitive" as const };
  return getDb().property.findMany({
    where: {
      type,
      archivedAt: state === "archiviert" ? { not: null } : state === "alle" ? undefined : null,
      OR: query ? [{ name: contains }, { street: contains }, { city: contains }, { postalCode: contains }] : undefined,
    },
    include: { _count: { select: { units: { where: { status: { not: "ARCHIVED" } } } } } },
    orderBy: [{ name: "asc" }, { id: "asc" }],
  });
}

export function propertyDetail(id: string) {
  return getDb().property.findUnique({
    where: { id },
    include: {
      acquisitionSource: { select: { id: true } },
      units: {
        orderBy: { label: "asc" },
        include: { leases: { where: activeLeaseOn(berlinToday()), select: { id: true }, take: 1 } },
      },
    },
  });
}

export async function requireActiveProperty(tx: Prisma.TransactionClient, id: string) {
  if (!await tx.property.findFirst({ where: { id, archivedAt: null }, select: { id: true } })) {
    throw new MasterDataError("Die Immobilie ist archiviert oder nicht verfügbar.");
  }
}

export function saveProperty(actor: string, id: string, data: PropertyInput, version?: number) {
  return writeMasterData(async (tx) => {
    if (version === undefined) {
      await tx.property.create({ data: { id, ...data } });
    } else {
      ensureVersion(await tx.property.updateMany({
        where: { id, version, archivedAt: null }, data: { ...data, version: { increment: 1 } },
      }));
    }
    await audit(tx, actor, version === undefined ? "property.created" : "property.updated", "Property", id);
  });
}

export function setPropertyArchived(actor: string, id: string, version: number, archived: boolean) {
  const today = berlinToday();
  return writeMasterData(async (tx) => {
    if (archived && await tx.lease.findFirst({
      where: { ...unexpiredLeaseOn(today), unit: { propertyId: id } }, select: { id: true },
    })) {
      throw new MasterDataError("Die Immobilie hat laufende oder zukünftige Mietverträge.");
    }
    ensureVersion(await tx.property.updateMany({
      where: { id, version, archivedAt: archived ? null : { not: null } },
      data: { archivedAt: archived ? new Date() : null, version: { increment: 1 } },
    }));
    await audit(tx, actor, archived ? "property.archived" : "property.restored", "Property", id);
  });
}
