import type { z } from "zod";
import { getDb } from "@/lib/db";
import { requireActiveProperty } from "../properties/service";
import { berlinToday, unexpiredLeaseOn } from "../stammdaten/calendar";
import { audit, ensureVersion, MasterDataError, writeMasterData } from "../stammdaten/mutations";
import type { unitInput } from "./validation";

type UnitInput = z.output<typeof unitInput>;

export function unitDetail(id: string) {
  return getDb().rentalUnit.findUnique({
    where: { id },
    include: {
      property: { select: { id: true, name: true, archivedAt: true } },
      leases: {
        orderBy: { startsOn: "desc" },
        include: { tenants: { include: { tenant: { select: { firstName: true, lastName: true } } } } },
      },
    },
  });
}

export function saveUnit(actor: string, propertyId: string, id: string, data: UnitInput, version?: number) {
  return writeMasterData(async (tx) => {
    await requireActiveProperty(tx, propertyId);
    if (version === undefined) {
      await tx.rentalUnit.create({ data: { id, propertyId, ...data } });
    } else {
      ensureVersion(await tx.rentalUnit.updateMany({
        where: { id, propertyId, version, status: { not: "ARCHIVED" } },
        data: { ...data, version: { increment: 1 } },
      }));
    }
    await audit(tx, actor, version === undefined ? "unit.created" : "unit.updated", "RentalUnit", id);
  });
}

export function setUnitArchived(actor: string, id: string, version: number, archived: boolean) {
  const today = berlinToday();
  return writeMasterData(async (tx) => {
    const unit = await tx.rentalUnit.findUnique({ where: { id }, select: { propertyId: true } });
    if (!unit) throw new MasterDataError("Die Einheit ist nicht verfügbar.");
    await requireActiveProperty(tx, unit.propertyId);
    if (archived && await tx.lease.findFirst({ where: { unitId: id, ...unexpiredLeaseOn(today) }, select: { id: true } })) {
      throw new MasterDataError("Die Einheit hat laufende oder zukünftige Mietverträge.");
    }
    ensureVersion(await tx.rentalUnit.updateMany({
      where: { id, version, status: archived ? { not: "ARCHIVED" } : "ARCHIVED" },
      data: { status: archived ? "ARCHIVED" : "VACANT", version: { increment: 1 } },
    }));
    await audit(tx, actor, archived ? "unit.archived" : "unit.restored", "RentalUnit", id);
  });
}
