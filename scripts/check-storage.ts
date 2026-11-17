import "dotenv/config";
import { createHash } from "node:crypto";
import { getDb } from "../src/lib/db";
import { readPrivate } from "../src/lib/private-storage";
import { artifactName } from "../src/modules/reports/jobs";

const db = getDb();
let errors = 0;
try {
  for (const doc of await db.document.findMany({ select: { id: true, size: true, sha256: true } })) {
    const bytes = await readPrivate("documents", doc.id).catch(() => null);
    if (!bytes || bytes.length !== doc.size || createHash("sha256").update(bytes).digest("hex") !== doc.sha256) errors++;
  }
  for (const job of await db.reportJob.findMany({ where: { status: "READY" }, select: { id: true, attempts: true } })) {
    const bytes = await readPrivate("reports", artifactName(job.id, job.attempts)).catch(() => null);
    if (bytes?.subarray(0, 5).toString() !== "%PDF-") errors++;
  }
  console.log(errors ? "Fehlende oder beschädigte Dateien: " + errors : "Private Dateien erfolgreich geprüft.");
  process.exitCode = errors ? 1 : 0;
} finally { await db.$disconnect(); }
