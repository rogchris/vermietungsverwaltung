import type { ReportType } from "@/generated/prisma/enums";
import type { ReportJob } from "@/generated/prisma/client";
import { getDb } from "@/lib/db";
import { MasterDataError, audit, writeMasterData } from "@/modules/stammdaten/mutations";
import { discardPrivate, putPrivate } from "@/lib/private-storage";
import { reportHtml } from "./content";
import { checkQueueCapacity, existingReport } from "./queue";
import { renderBankPackageV1 } from "@/modules/bank-package/content";
import { appendBankAttachments } from "@/modules/bank-package/attachments";
import type { BankPayload } from "@/modules/bank-package/snapshot";
import { bankPayload } from "@/modules/bank-package/service";

const maxAttempts = 3;
export const artifactName = (id: string, attempts: number) => id + "-" + attempts + ".pdf";

export function enqueueReport(userId: string, id: string, propertyId: string | null, type: ReportType, period: Date, months: number) {
  if (type === "BANK_PACKAGE") throw new MasterDataError("Bitte die Bankmappe aus einem Kaufprojekt erstellen.");
  if (type === "ANNUAL" && !propertyId) throw new MasterDataError("Bitte eine Immobilie für die Jahresübersicht wählen.");
  const start = new Date(period);
  if (type === "ANNUAL") { start.setUTCMonth(0); months = 12; }
  return writeMasterData(async (tx) => {
    if (await existingReport(tx, id, userId, type)) return;
    if (propertyId && !await tx.property.findUnique({ where: { id: propertyId }, select: { id: true } })) throw new MasterDataError("Die Immobilie wurde nicht gefunden.");
    await checkQueueCapacity(tx, userId);
    await tx.reportJob.create({ data: { id, userId, propertyId, type, period: start, months } });
    await audit(tx, userId, "report.queued", "ReportJob", id);
  });
}

export async function claimReport() {
  const db = getDb();
  const now = new Date();
  await db.reportJob.updateMany({
    where: { status: "RUNNING", attempts: { gte: maxAttempts }, leaseUntil: { lte: now } },
    data: { status: "FAILED", failure: "Zeitlimit überschritten.", finishedAt: now, leaseUntil: null },
  });
  const rows = await db.$queryRaw<ReportJob[]>`
    UPDATE "ReportJob"
    SET status = 'RUNNING', attempts = attempts + 1, "leaseUntil" = NOW() + INTERVAL '3 minutes'
    WHERE id = (
      SELECT id FROM "ReportJob"
      WHERE attempts < ${maxAttempts} AND ((status = 'QUEUED' AND "availableAt" <= NOW()) OR (status = 'RUNNING' AND "leaseUntil" <= NOW()))
      ORDER BY "availableAt", id FOR UPDATE SKIP LOCKED LIMIT 1
    )
    RETURNING *
  `;
  return rows[0] ?? null;
}

export async function processNextReport(render: (html: string) => Promise<Uint8Array>) {
  const job = await claimReport();
  if (!job) return false;
  const db = getDb();
  const where = { id: job.id, attempts: job.attempts, status: "RUNNING" as const };
  const name = artifactName(job.id, job.attempts);
  let stored = false;
  try {
    const user = await db.user.findUnique({ where: { id: job.userId }, select: { twoFactorEnabled: true, role: true } });
    if (!user?.twoFactorEnabled || !["ADMIN", "VIEWER"].includes(user.role)) throw new Error("REPORT_ACCESS_REVOKED");
    let html: string;
    let packageData: BankPayload | undefined;
    if (job.type === "BANK_PACKAGE") {
      const snapshot = await db.bankSnapshot.findUniqueOrThrow({ where: { jobId: job.id } });
      packageData = bankPayload(snapshot);
      html = renderBankPackageV1(packageData, snapshot.version);
    } else {
      html = await reportHtml(job);
    }
    const pdf = await render(html);
    if (pdf.byteLength > 40 * 1024 * 1024) throw new Error("REPORT_TOO_LARGE");
    const bytes = packageData ? await appendBankAttachments(pdf, packageData) : pdf;
    if (bytes.byteLength > 40 * 1024 * 1024) throw new Error("REPORT_TOO_LARGE");
    await putPrivate("reports", name, bytes);
    stored = true;
    const updated = await db.reportJob.updateMany({ where, data: { status: "READY", finishedAt: new Date(), leaseUntil: null, failure: null } });
    if (!updated.count) await discardPrivate("reports", name);
  } catch (cause) {
    const terminal = cause instanceof Error && ["REPORT_TOO_LARGE", "REPORT_ACCESS_REVOKED", "BANK_APPENDIX_INVALID", "BANK_APPENDIX_LIMIT"].includes(cause.message);
    const failures: Record<string, string> = {
      REPORT_TOO_LARGE: "Bericht zu groß. Bitte verkleinere den Umfang.",
      REPORT_ACCESS_REVOKED: "Der Zugriff auf den Bericht wurde entzogen.",
      BANK_APPENDIX_INVALID: "Eine Anlage kann nicht eingebettet werden. Erstelle eine neue Version ohne diese Anlage.",
      BANK_APPENDIX_LIMIT: "Mehr als 80 Anlagenseiten. Bitte wähle weniger Anlagen.",
      BANK_APPENDIX_UNAVAILABLE: "Eine Anlage fehlt oder ihre Prüfsumme stimmt nicht überein.",
      BANK_APPENDIX_TIMEOUT: "Zeitlimit beim Zusammenführen der Anlagen überschritten.",
    };
    const failure = cause instanceof Error && Object.hasOwn(failures, cause.message) ? failures[cause.message] : "PDF-Erstellung fehlgeschlagen.";
    const final = terminal || job.attempts >= maxAttempts;
    const updated = await db.reportJob.updateMany({ where, data: {
      status: final ? "FAILED" : "QUEUED", leaseUntil: null, failure,
      availableAt: new Date(Date.now() + job.attempts * 30_000), finishedAt: final ? new Date() : null,
    } });
    if (stored && updated.count) await discardPrivate("reports", name);
    console.error("PDF-Auftrag fehlgeschlagen.", job.id, job.attempts);
  }
  return true;
}
