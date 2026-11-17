import { Prisma } from "@/generated/prisma/client";
import { privateFileExists } from "@/lib/private-storage";
import { getDb } from "@/lib/db";
import { berlinToday, activeLeaseOn } from "@/modules/stammdaten/calendar";
import { MasterDataError, audit, writeMasterData } from "@/modules/stammdaten/mutations";
import { checkQueueCapacity, existingReport } from "@/modules/reports/queue";
import { createBankPayload, type BankPayload, type RentRow } from "./snapshot";
import type { BankInput } from "./validation";

export const bankFormatVersion = 1;

export function bankPayload(snapshot: { formatVersion: number; payload: Prisma.JsonValue }): BankPayload {
  if (snapshot.formatVersion !== 1) throw new Error("Unbekanntes Bankmappenformat.");
  return snapshot.payload as unknown as BankPayload;
}

export function bankDocuments(tx: Prisma.TransactionClient, projectId: string, propertyId: string | null) {
  return tx.document.findMany({
    where: { OR: [{ acquisitionProjectId: projectId }, ...(propertyId ? [{ propertyId }] : [])] },
    select: { id: true, filename: true, type: true, sha256: true, size: true, mime: true, createdAt: true, description: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
}

async function existingRents(tx: Prisma.TransactionClient, propertyId: string, today: Date): Promise<RentRow[]> {
  const units = await tx.rentalUnit.findMany({
    where: { propertyId, status: { not: "ARCHIVED" } },
    select: { label: true, status: true, leases: {
      where: activeLeaseOn(today), orderBy: { startsOn: "desc" }, take: 1, select: { terms: {
        where: { effectiveFrom: { lte: today } }, orderBy: { effectiveFrom: "desc" }, take: 1,
        select: { baseRent: true, effectiveFrom: true },
      } },
    } },
    orderBy: [{ label: "asc" }, { id: "asc" }],
  });
  return units.map(({ label, status, leases }) => {
    const term = leases[0]?.terms[0];
    return { unit: label, status: leases.length ? "vermietet" : status === "VACANT" ? "leer" : "keine aktive Vertragsmiete",
      monthly: term?.baseRent.toFixed(2) ?? (leases.length ? null : "0"), effectiveFrom: term?.effectiveFrom.toISOString(), source: "entered" };
  });
}

export async function enqueueBankPackage(userId: string, projectId: string, input: BankInput) {
  const today = berlinToday();
  const period = new Date(today);
  period.setUTCDate(1);
  for (let attempt = 0; ; attempt++) {
    try {
      return await writeMasterData(async (tx) => {
        if (await existingReport(tx, input.id, userId, "BANK_PACKAGE")) {
          const snapshot = await tx.bankSnapshot.findUnique({ where: { jobId: input.id } });
          if (snapshot?.projectId !== projectId) throw new MasterDataError("Ungültiger Berichtsauftrag.");
          return snapshot;
        }
        await checkQueueCapacity(tx, userId);
        const project = await tx.acquisitionProject.findUnique({ where: { id: projectId } });
        if (!project) throw new MasterDataError("Das Kaufprojekt wurde nicht gefunden.");
        const scenarios = await tx.acquisitionScenario.findMany({ where: { projectId }, include: { loans: {
          where: { archivedAt: null }, orderBy: [{ startsMonth: "asc" }, { id: "asc" }],
          include: { extraPayments: { orderBy: { month: "asc" } } },
        } } });
        if (scenarios.reduce((sum, item) => sum + item.loans.reduce((months, loan) => months + loan.fixedMonths, 0), 0) > 8000) {
          throw new MasterDataError("Die gespeicherten Darlehen überschreiten 8.000 Tilgungsmonate für eine Bankmappe.");
        }
        const documents = await bankDocuments(tx, projectId, project.acquiredPropertyId);
        const files = await Promise.all(documents.map(async (file) => ({ ...file, available: await privateFileExists("documents", file.id, file.size) })));
        if (Object.values(input.evidence).some((id) => id && !files.some((file) => file.id === id))) {
          throw new MasterDataError("Ein Nachweis gehört nicht zu diesem Kaufprojekt oder seiner Bestandsimmobilie.");
        }
        const selectedFiles = files.filter((file) => input.appendices.includes(file.id) && file.available);
        if (selectedFiles.length !== input.appendices.length) throw new MasterDataError("Mindestens eine ausgewählte Anlage fehlt oder gehört nicht zum Kaufprojekt.");
        if (selectedFiles.reduce((sum, file) => sum + file.size, 0) > 25 * 1024 * 1024) {
          throw new MasterDataError("Die ausgewählten Anlagen dürfen zusammen höchstens 25 MiB groß sein.");
        }
        const rents = input.rentRows.length ? input.rentRows : project.acquiredPropertyId ? await existingRents(tx, project.acquiredPropertyId, today) : [];
        const previous = await tx.bankSnapshot.findFirst({ where: { projectId }, orderBy: { version: "desc" }, select: { version: true } });
        const version = (previous?.version ?? 0) + 1;
        const payload = createBankPayload(project, scenarios, files, rents, input, today);
        await tx.reportJob.create({ data: { id: input.id, userId, propertyId: project.acquiredPropertyId, type: "BANK_PACKAGE", period, months: 1 } });
        const snapshot = await tx.bankSnapshot.create({ data: { jobId: input.id, projectId, version, formatVersion: bankFormatVersion, payload } });
        await audit(tx, userId, "bank_package.queued", "BankSnapshot", snapshot.jobId);
        return snapshot;
      });
    } catch (error) {
      if (attempt === 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
    }
  }
}

export function ownedBankVersion(id: string, projectId: string, userId: string) {
  return getDb().bankSnapshot.findFirst({ where: { jobId: id, projectId, job: { userId } }, include: { job: true } });
}
