import { expect, it, afterAll } from "vitest";
import { getDb } from "../../src/lib/db";
import { readPrivate } from "../../src/lib/private-storage";
import { storeDocument } from "../../src/modules/documents/service";
import { artifactName, enqueueReport, processNextReport } from "../../src/modules/reports/jobs";
import { reportTypes } from "../../src/modules/reports/content";
import { ReportType } from "../../src/generated/prisma/enums";
import { renderPdf } from "../../src/modules/reports/pdf";
import { masterDataFixture } from "../support/master-data-fixture";
import { financeFixture } from "../support/finance-fixture";

const db = getDb();
afterAll(() => db.$disconnect());
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/uikAAAAASUVORK5CYII=", "base64");

it("speichert Dateien privat, validiert Signatur und verhindert Objektfremdzuordnungen", async () => {
  const user = await masterDataFixture();
  try {
    const { propertyId, leaseId } = await financeFixture(user.id, user.prefix);
    const form = new FormData();
    form.set("propertyId", propertyId); form.set("leaseId", leaseId);
    form.set("type", "PHOTO"); form.set("description", "Synthetisch");
    form.set("file", new File(["<script>synthetisch</script>"], "falsch.png", { type: "image/png" }));
    await expect(storeDocument(user.id, form)).rejects.toThrow("PDF, JPEG oder PNG");
    form.set("file", new File([new Uint8Array(png)], "../../testbild.png", { type: "image/png" }));
    form.set("leaseId", crypto.randomUUID());
    await expect(storeDocument(user.id, form)).rejects.toThrow("Zuordnung");
    form.set("leaseId", leaseId);
    const id = await storeDocument(user.id, form);
    expect(await db.document.findUnique({ where: { id } })).toMatchObject({ filename: "testbild.png", leaseId });
    expect(await readPrivate("documents", id)).toEqual(png);
    expect(() => readPrivate("documents", "../x")).toThrow("Speichername");
  } finally { await user.dispose(); }
});

it("rendert alle sieben Berichtstypen und speichert PDF-Artefakte zu persistenten Aufträgen", async () => {
  const user = await masterDataFixture();
  try {
    await db.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
    const { propertyId } = await financeFixture(user.id, user.prefix + "<script>");
    const period = new Date("2026-12-01");
    for (const type of Object.values(ReportType).filter((type) => type !== "BANK_PACKAGE")) {
      const id = crypto.randomUUID();
      await enqueueReport(user.id, id, propertyId, type, period, 1);
      expect(await processNextReport(async (html) => {
        expect(html).toContain(reportTypes[type]);
        expect(html).toContain("&lt;script&gt;");
        return renderPdf(html);
      })).toBe(true);
      const job = await db.reportJob.findUniqueOrThrow({ where: { id } });
      expect(job.status).toBe("READY");
      const pdf = await readPrivate("reports", artifactName(id, job.attempts));
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    }
  } finally { await user.dispose(); }
}, 90_000);

it("begrenzt fehlgeschlagene Aufträge auf drei Versuche", async () => {
  const user = await masterDataFixture();
  try {
    await db.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
    const id = crypto.randomUUID();
    await enqueueReport(user.id, id, null, "CASHFLOW", new Date("2026-12-01"), 1);
    for (let attempt = 1; attempt <= 3; attempt++) {
      await db.reportJob.update({ where: { id }, data: { availableAt: new Date(0) } });
      expect(await processNextReport(async () => { throw new Error("Synthetischer Rendererfehler"); })).toBe(true);
      expect(await db.reportJob.findUnique({ where: { id } })).toMatchObject({ attempts: attempt, status: attempt === 3 ? "FAILED" : "QUEUED" });
    }
  } finally { await user.dispose(); }
});
