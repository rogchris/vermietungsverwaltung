import type { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { activeLeaseOn, berlinToday } from "../stammdaten/calendar";
import { audit, ensureVersion, MasterDataError, writeMasterData } from "../stammdaten/mutations";
import type { conditionInput, leaseDetails, leaseInput } from "./validation";

type LeaseInput = z.output<typeof leaseInput>;
type LeaseDetails = z.output<typeof leaseDetails>;
type ConditionInput = z.output<typeof conditionInput>;

const names = { firstName: true, lastName: true, id: true } as const;
const leaseUnit = { include: { property: { select: { id: true, name: true, archivedAt: true } } } } as const;

export function listLeases(query: string, state: string) {
  const today = berlinToday();
  const contains = { contains: query, mode: "insensitive" as const };
  const states: Record<string, Prisma.LeaseWhereInput> = {
    laufend: activeLeaseOn(today), zukuenftig: { startsOn: { gt: today } }, beendet: { endsOn: { lt: today } },
  };
  return getDb().lease.findMany({
    where: { AND: [
      states[state] ?? {},
      query ? { OR: [
        { unit: { label: contains } }, { unit: { property: { name: contains } } },
        { tenants: { some: { tenant: { OR: [{ firstName: contains }, { lastName: contains }] } } } },
      ] } : {},
    ] },
    orderBy: [{ startsOn: "desc" }, { id: "asc" }],
    include: { unit: leaseUnit, tenants: { include: { tenant: { select: names } } } },
  });
}

export function leaseDetail(id: string) {
  return getDb().lease.findUnique({
    where: { id },
    include: {
      unit: leaseUnit,
      tenants: { include: { tenant: { select: names } }, orderBy: { tenant: { lastName: "asc" } } },
      terms: { orderBy: { effectiveFrom: "desc" } },
    },
  });
}

async function rejectOverlap(tx: Prisma.TransactionClient, unitId: string, id: string, startsOn: Date, endsOn: Date | null) {
  if (await tx.lease.findFirst({
    where: {
      unitId, id: { not: id }, startsOn: endsOn ? { lte: endsOn } : undefined,
      OR: [{ endsOn: null }, { endsOn: { gte: startsOn } }],
    },
    select: { id: true },
  })) throw new MasterDataError("Für diese Einheit besteht bereits ein Mietvertrag im gewählten Zeitraum.");
}

function isOverlapConstraint(error: unknown) {
  if (!(error instanceof Prisma.PrismaClientKnownRequestError)) return false;
  return error.code === "P2039" && error.message.includes('exclusion constraint "Lease_unit_date_no_overlap"');
}

async function writeLease<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>) {
  try {
    return await writeMasterData(operation);
  } catch (error) {
    if (isOverlapConstraint(error)) {
      throw new MasterDataError("Für diese Einheit besteht bereits ein Mietvertrag im gewählten Zeitraum.");
    }
    throw error;
  }
}

export function createLease(actor: string, unitId: string, id: string, data: LeaseInput) {
  const { tenantIds, startsOn, baseRent, operatingCosts, operatingMode, heatingCosts, heatingMode, ...details } = data;
  return writeLease(async (tx) => {
    const unit = await tx.rentalUnit.findFirst({
      where: { id: unitId, status: { not: "ARCHIVED" }, property: { archivedAt: null } }, select: { id: true },
    });
    if (!unit) throw new MasterDataError("Die Einheit ist archiviert oder nicht verfügbar.");
    if (await tx.tenant.count({ where: { id: { in: tenantIds }, archivedAt: null } }) !== tenantIds.length) {
      throw new MasterDataError("Mindestens eine Vertragspartei ist archiviert oder nicht verfügbar.");
    }
    await rejectOverlap(tx, unitId, id, startsOn, details.endsOn);
    await tx.lease.create({
      data: {
        id, unitId, startsOn, ...details,
        tenants: { createMany: { data: tenantIds.map((tenantId) => ({ tenantId })) } },
        terms: { create: { effectiveFrom: startsOn, baseRent, operatingCosts, operatingMode, heatingCosts, heatingMode } },
      },
    });
    await audit(tx, actor, "lease.created", "Lease", id);
  });
}

async function writableLease(tx: Prisma.TransactionClient, id: string, version: number) {
  const lease = await tx.lease.findFirst({
    where: { id, version, unit: { status: { not: "ARCHIVED" }, property: { archivedAt: null } } },
    include: { terms: { orderBy: { effectiveFrom: "desc" }, take: 1, select: { effectiveFrom: true } } },
  });
  if (!lease) throw new MasterDataError("Der Vertrag wurde geändert oder gehört zu einem archivierten Bestand.");
  return lease;
}

export function updateLease(actor: string, id: string, version: number, data: LeaseDetails) {
  return writeLease(async (tx) => {
    const lease = await writableLease(tx, id, version);
    const latest = lease.terms[0]?.effectiveFrom ?? lease.startsOn;
    if (data.endsOn && data.endsOn < latest) {
      throw new MasterDataError("Das Vertragsende darf nicht vor Vertragsbeginn oder der letzten Mietkondition liegen.");
    }
    await rejectOverlap(tx, lease.unitId, id, lease.startsOn, data.endsOn);
    ensureVersion(await tx.lease.updateMany({
      where: { id, version }, data: { ...data, version: { increment: 1 } },
    }));
    await audit(tx, actor, "lease.updated", "Lease", id);
  });
}

export function addRentCondition(actor: string, id: string, version: number, data: ConditionInput) {
  return writeMasterData(async (tx) => {
    const lease = await writableLease(tx, id, version);
    const latest = lease.terms[0]?.effectiveFrom;
    if (data.effectiveFrom < lease.startsOn || (latest && data.effectiveFrom <= latest)) {
      throw new MasterDataError("Das Datum muss nach der letzten Mietkondition liegen.");
    }
    if (lease.endsOn && data.effectiveFrom > lease.endsOn) {
      throw new MasterDataError("Das Datum liegt nach dem Vertragsende.");
    }
    ensureVersion(await tx.lease.updateMany({ where: { id, version }, data: { version: { increment: 1 } } }));
    const condition = await tx.rentCondition.create({ data: { leaseId: id, ...data }, select: { id: true } });
    await audit(tx, actor, "lease.condition_added", "RentCondition", condition.id);
  });
}
