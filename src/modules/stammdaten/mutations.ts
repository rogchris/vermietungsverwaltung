import { Prisma } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";

export class MasterDataError extends Error {}

export async function writeMasterData<T>(operation: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await getDb().$transaction(operation, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error;
      if (attempt === 2) throw new MasterDataError("Gleichzeitige Änderung. Bitte erneut versuchen.");
    }
  }
}

export function ensureVersion(updated: { count: number }) {
  if (!updated.count) throw new MasterDataError("Der Datensatz wurde inzwischen geändert. Bitte öffne ihn erneut.");
}

export async function audit(tx: Prisma.TransactionClient, actorId: string, action: string, targetType: string, targetId: string) {
  await tx.auditEvent.create({ data: { actorId, action, targetType, targetId } });
}
