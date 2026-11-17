import type { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { amortization } from "@/modules/financing/amortization";
import { berlinToday } from "@/modules/stammdaten/calendar";
import { audit, ensureVersion, MasterDataError, writeMasterData } from "@/modules/stammdaten/mutations";
import type { loanInput, projectInput, scenarioInput } from "./validation";

export function projects() {
  return getDb().acquisitionProject.findMany({
    select: { id: true, name: true, city: true, purchasePrice: true, convertedAt: true },
    orderBy: [{ convertedAt: { sort: "asc", nulls: "first" } }, { name: "asc" }],
  });
}

export function projectDetail(id: string) {
  return getDb().acquisitionProject.findUnique({
    where: { id },
    include: {
      scenarios: { include: { loans: { where: { archivedAt: null }, orderBy: [{ startsMonth: "asc" }, { label: "asc" }],
        include: { extraPayments: { orderBy: { month: "asc" } }, refinancedBy: { select: { id: true } } } } } },
      documents: { orderBy: { createdAt: "desc" } },
    },
  });
}

async function touch(tx: Prisma.TransactionClient, id: string, version: number) {
  ensureVersion(await tx.acquisitionProject.updateMany({
    where: { id, version, convertedAt: null }, data: { version: { increment: 1 } },
  }));
}

export function saveProject(actor: string, id: string, data: z.output<typeof projectInput>, version?: number) {
  return writeMasterData(async (tx) => {
    if (version === undefined) await tx.acquisitionProject.create({ data: { id, ...data } });
    else ensureVersion(await tx.acquisitionProject.updateMany({
      where: { id, version, convertedAt: null }, data: { ...data, version: { increment: 1 } },
    }));
    await audit(tx, actor, version === undefined ? "acquisition.created" : "acquisition.updated", "AcquisitionProject", id);
  });
}

export function saveScenario(actor: string, id: string, version: number, data: z.output<typeof scenarioInput>) {
  return writeMasterData(async (tx) => {
    await touch(tx, id, version);
    const scenario = await tx.acquisitionScenario.upsert({
      where: { projectId_kind: { projectId: id, kind: data.kind } }, create: { projectId: id, ...data }, update: data,
    });
    await audit(tx, actor, "acquisition.scenario_saved", "AcquisitionScenario", scenario.id);
  });
}

export function saveLoan(actor: string, projectId: string, scenarioId: string, version: number, data: z.output<typeof loanInput>) {
  return writeMasterData(async (tx) => {
    await touch(tx, projectId, version);
    const scenario = await tx.acquisitionScenario.findFirst({ where: { id: scenarioId, projectId }, select: { kind: true } });
    if (!scenario) {
      throw new MasterDataError("Das Szenario gehört nicht zum Kaufobjekt.");
    }
    const existing = await tx.acquisitionLoan.findUnique({ where: { id: data.id }, include: { refinancedBy: { select: { id: true } } } });
    if (existing && (existing.scenarioId !== scenarioId || existing.archivedAt || existing.refinancedBy ||
        existing.refinancesId !== data.refinancesId)) throw new MasterDataError("Dieses Darlehen kann nicht bearbeitet werden.");
    let principal = data.principal;
    let startsMonth = 1;
    if (data.refinancesId) {
      const previous = await tx.acquisitionLoan.findFirst({
        where: { id: data.refinancesId, scenarioId, archivedAt: null }, include: { extraPayments: true, refinancedBy: { select: { id: true } } },
      });
      if (!previous || previous.id === data.id || (previous.refinancedBy && previous.refinancedBy.id !== data.id)) {
        throw new MasterDataError("Die Anschlussfinanzierung ist für dieses Darlehen nicht verfügbar.");
      }
      principal = amortization(previous).outstanding;
      startsMonth = previous.startsMonth + previous.fixedMonths;
    }
    if (!principal?.gt(0)) throw new MasterDataError("Für das Darlehen ist ein positiver Betrag oder eine positive Restschuld erforderlich.");
    if (startsMonth + data.fixedMonths > 1201) throw new MasterDataError("Der gesamte Finanzierungszeitraum überschreitet 100 Jahre.");
    const fields = { label: data.label, principal, annualRate: data.annualRate, initialRepayment: data.initialRepayment, fixedMonths: data.fixedMonths, startsMonth };
    if (existing) {
      await tx.acquisitionLoan.update({ where: { id: data.id }, data: fields });
      await tx.loanExtraPayment.deleteMany({ where: { loanId: data.id } });
    } else {
      await tx.acquisitionLoan.create({ data: { id: data.id, scenarioId, refinancesId: data.refinancesId, ...fields } });
    }
    if (data.extras.length) await tx.loanExtraPayment.createMany({ data: data.extras.map((item) => ({ ...item, loanId: data.id })) });
    await audit(tx, actor, existing ? "acquisition.loan_updated" : "acquisition.loan_created", "AcquisitionLoan", data.id);
    return scenario.kind;
  });
}

export function convertProject(actor: string, id: string, version: number, purchaseDate: Date) {
  if (purchaseDate > berlinToday()) throw new MasterDataError("Das tatsächliche Kaufdatum liegt in der Zukunft.");
  return writeMasterData(async (tx) => {
    const project = await tx.acquisitionProject.findUnique({ where: { id } });
    if (!project) throw new MasterDataError("Kaufobjekt nicht gefunden.");
    if (project.acquiredPropertyId) return project.acquiredPropertyId;
    await touch(tx, id, version);
    const property = await tx.property.create({ data: {
      name: project.name, street: project.street, houseNumber: project.houseNumber, postalCode: project.postalCode, city: project.city,
      state: project.state, type: project.type, builtYear: project.builtYear, landArea: project.landArea, livingArea: project.livingArea,
      purchaseDate, purchasePrice: project.purchasePrice, description: project.description,
    } });
    await tx.acquisitionProject.update({ where: { id }, data: { acquiredPropertyId: property.id, convertedAt: new Date(), purchaseDate } });
    await audit(tx, actor, "property.created_from_acquisition", "Property", property.id);
    await audit(tx, actor, "acquisition.converted", "AcquisitionProject", id);
    return property.id;
  });
}

export function archiveLoan(actor: string, projectId: string, id: string, version: number) {
  return writeMasterData(async (tx) => {
    await touch(tx, projectId, version);
    const loan = await tx.acquisitionLoan.findFirst({
      where: { id, archivedAt: null, scenario: { projectId }, refinancesId: null, refinancedBy: null },
      include: { scenario: { select: { kind: true } } },
    });
    if (!loan) throw new MasterDataError("Verknüpfte Darlehen können nicht aus der Berechnung entfernt werden.");
    await tx.acquisitionLoan.update({ where: { id }, data: { archivedAt: new Date() } });
    await audit(tx, actor, "acquisition.loan_archived", "AcquisitionLoan", id);
    return loan.scenario.kind;
  });
}
