import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const processState = globalThis as typeof globalThis & { rentalPrisma?: PrismaClient };

export function getDb() {
  if (!processState.rentalPrisma) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error("DATABASE_URL fehlt.");
    const adapter = new PrismaPg({ connectionString, connectionTimeoutMillis: 5_000 });
    processState.rentalPrisma = new PrismaClient({ adapter });
  }
  return processState.rentalPrisma;
}
