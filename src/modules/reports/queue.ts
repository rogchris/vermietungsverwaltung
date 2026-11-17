import type { Prisma, ReportType } from "@/generated/prisma/client";
import { MasterDataError } from "@/modules/stammdaten/mutations";

export async function existingReport(tx: Prisma.TransactionClient, id: string, userId: string, type: ReportType) {
  const job = await tx.reportJob.findUnique({ where: { id } });
  if (job && (job.userId !== userId || job.type !== type)) throw new MasterDataError("Ungültiger Berichtsauftrag.");
  return job;
}

export async function checkQueueCapacity(tx: Prisma.TransactionClient, userId: string) {
  if (await tx.reportJob.count({ where: { userId, status: { in: ["QUEUED", "RUNNING"] } } }) >= 5) {
    throw new MasterDataError("Es warten bereits fünf Berichte auf die Verarbeitung.");
  }
}
