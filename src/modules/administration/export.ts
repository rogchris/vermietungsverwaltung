import { createHash } from "node:crypto";
import { getDb } from "@/lib/db";
import { readPrivate } from "@/lib/private-storage";
import { artifactName } from "@/modules/reports/jobs";

function tarHeader(name: string, size: number) {
  if (!/^[\w./-]{1,99}$/.test(name)) throw new Error("Ungültiger Archivpfad.");
  const header = Buffer.alloc(512);
  header.write(name, 0, 100, "ascii");
  header.write("0000600\0", 100, "ascii");
  header.write("0000000\0", 108, "ascii");
  header.write("0000000\0", 116, "ascii");
  header.write(size.toString(8).padStart(11, "0") + "\0", 124, "ascii");
  header.write("00000000000\0", 136, "ascii");
  header.fill(32, 148, 156);
  header[156] = 48;
  header.write("ustar\0", 257, "ascii");
  header.write("00", 263, "ascii");
  const sum = header.reduce((total, byte) => total + byte, 0);
  header.write(sum.toString(8).padStart(6, "0") + "\0 ", 148, "ascii");
  return header;
}

function* archiveEntry(name: string, data: Buffer) {
  yield tarHeader(name, data.length);
  yield data;
  const padding = (512 - data.length % 512) % 512;
  if (padding) yield Buffer.alloc(padding);
}

export async function exportSnapshot() {
  return getDb().$transaction(async (tx) => ({
    formatVersion: 1,
    exportedAt: new Date(),
    users: await tx.user.findMany({ select: { id: true, name: true, email: true, role: true, createdAt: true } }),
    properties: await tx.property.findMany(),
    units: await tx.rentalUnit.findMany(),
    tenants: await tx.tenant.findMany(),
    leases: await tx.lease.findMany(),
    leaseTenants: await tx.leaseTenant.findMany(),
    rentConditions: await tx.rentCondition.findMany(),
    receivables: await tx.rentReceivable.findMany(),
    payments: await tx.payment.findMany(),
    allocations: await tx.allocation.findMany(),
    acquisitionProjects: await tx.acquisitionProject.findMany(),
    acquisitionScenarios: await tx.acquisitionScenario.findMany(),
    acquisitionLoans: await tx.acquisitionLoan.findMany(),
    loanExtraPayments: await tx.loanExtraPayment.findMany(),
    rentGenerationRuns: await tx.rentGenerationRun.findMany(),
    expenses: await tx.expense.findMany(),
    documents: (await tx.document.findMany()).map((row) => ({ ...row, archivePath: "dokumente/" + row.id })),
    bankSnapshots: await tx.bankSnapshot.findMany(),
    reports: (await tx.reportJob.findMany()).map((row) => ({ ...row, archivePath: row.status === "READY" ? "berichte/" + artifactName(row.id, row.attempts) : null })),
    audit: await tx.auditEvent.findMany(),
  }), { isolationLevel: "RepeatableRead", timeout: 30_000 });
}

export async function* exportArchive(data: Awaited<ReturnType<typeof exportSnapshot>>) {
  yield* archiveEntry("daten.json", Buffer.from(JSON.stringify(data, null, 2), "utf8"));
  for (const row of data.documents) {
    const file = await readPrivate("documents", row.id);
    if (file.length !== row.size || createHash("sha256").update(file).digest("hex") !== row.sha256) throw new Error("Dokumentintegrität fehlgeschlagen.");
    yield* archiveEntry(row.archivePath, file);
  }
  for (const row of data.reports) {
    if (row.archivePath) yield* archiveEntry(row.archivePath, await readPrivate("reports", artifactName(row.id, row.attempts)));
  }
  yield Buffer.alloc(1024);
}
