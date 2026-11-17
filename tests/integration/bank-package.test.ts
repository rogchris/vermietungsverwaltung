import { PDFDocument } from "pdf-lib";
import { writeFile } from "node:fs/promises";
import { afterAll, expect, it } from "vitest";
import { getDb } from "../../src/lib/db";
import { discardPrivate, readPrivate } from "../../src/lib/private-storage";
import { convertProject, saveProject, saveScenario } from "../../src/modules/acquisition/service";
import { saveUnit } from "../../src/modules/rental-units/service";
import { saveTenant } from "../../src/modules/tenants/service";
import { createLease } from "../../src/modules/leases/service";
import { leaseInput } from "../../src/modules/leases/validation";
import { storeDocument } from "../../src/modules/documents/service";
import { scenarioInput } from "../../src/modules/acquisition/validation";
import { artifactName, processNextReport } from "../../src/modules/reports/jobs";
import { renderPdf } from "../../src/modules/reports/pdf";
import { enqueueBankPackage, bankPayload, ownedBankVersion } from "../../src/modules/bank-package/service";
import { evidenceKeys, sectionKeys } from "../../src/modules/bank-package/options";
import { bankInput } from "../../src/modules/bank-package/validation";
import { masterDataFixture } from "../support/master-data-fixture";
import { bankFixture, syntheticAssumptions, syntheticProject } from "../support/bank-fixture";

const db = getDb();
afterAll(() => db.$disconnect());

it("friert Version, Rechenwerte, Eingaben und Anlagen ein und rendert nach einer Projektänderung aus dem Snapshot", async () => {
  const user = await masterDataFixture();
  const other = await masterDataFixture();
  try {
    await db.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
    const fixture = await bankFixture(user.id, "Alt " + user.prefix + " <script>");
    const evidence = Object.fromEntries(evidenceKeys.map((key) => [key, key === "expose" ? fixture.documentId : ""]));
    const values = { id: crypto.randomUUID(), sections: sectionKeys, evidence, appendices: [fixture.documentId],
      rentRows: "EG | vermietet | 800,25 | Angabe\nOG | geplant | 950 | Schätzung", riskNotes: "Synthetisches Prüfmerkmal" };
    const input = bankInput.parse(values);
    const first = await enqueueBankPackage(user.id, fixture.id, input);
    expect((await enqueueBankPackage(user.id, fixture.id, input)).jobId).toBe(first.jobId);
    expect(await ownedBankVersion(first.jobId, fixture.id, other.id)).toBeNull();
    expect(await ownedBankVersion(first.jobId, crypto.randomUUID(), user.id)).toBeNull();
    const before = bankPayload(first);
    expect(before.scenarios).toHaveLength(3);
    expect(before.scenarios[0].result.capitalNeeded).toBe("115000");
    expect(before.scenarios[0].result.schedules[0].schedule[11].extra).toBe("1000");
    expect(before.rentSummary).toEqual({ currentMonthly: "800.25", currentAnnual: "9603", planningAnnual: "21003" });
    expect(before.checklist.find((item) => item.key === "expose")?.attachmentId).toBe(fixture.documentId);
    expect(before.checklist.find((item) => item.key === "equity")?.attachmentId).toBeNull();
    expect(before.attachments[0].sha256).toMatch(/^[0-9a-f]{64}$/);
    await expect(db.bankSnapshot.update({ where: { jobId: first.jobId }, data: { version: 99 } })).rejects.toThrow(/immutable/);
    await expect(enqueueBankPackage(user.id, fixture.id, bankInput.parse({ ...values, id: crypto.randomUUID(),
      evidence: { ...evidence, equity: crypto.randomUUID() } }))).rejects.toThrow("gehört nicht");

    await saveProject(user.id, fixture.id, syntheticProject("Neuer Projektname"), 4);
    await saveScenario(user.id, fixture.id, 5, scenarioInput.parse({ ...syntheticAssumptions, kind: "BASE", annualRent: "20000" }));
    const [second, third] = await Promise.all([
      enqueueBankPackage(user.id, fixture.id, bankInput.parse({ ...values, id: crypto.randomUUID() })),
      enqueueBankPackage(user.id, fixture.id, bankInput.parse({ ...values, id: crypto.randomUUID() })),
    ]);
    expect([second.version, third.version].sort()).toEqual([2, 3]);
    expect(bankPayload(second).scenarios[0].assumptions.annualRent).toBe("20000");
    expect(bankPayload(await db.bankSnapshot.findUniqueOrThrow({ where: { jobId: first.jobId } }))).toEqual(before);

    let renderedPages = 0;
    for (let index = 0; index < 3; index++) {
      expect(await processNextReport(async (html) => {
        expect(html).toContain("Inhaltsverzeichnis");
        expect(html).toContain("Tilgungsplan");
        expect(html).toContain("Synthetisches Prüfmerkmal");
        if (html.includes("Version 1")) {
          expect(html).toContain("&lt;script&gt;");
          expect(html).not.toContain("Neuer Projektname");
          expect(html).toContain("12.000,00");
        }
        const rendered = await renderPdf(html);
        if (html.includes("Version 1")) renderedPages = (await PDFDocument.load(rendered)).getPageCount();
        return rendered;
      })).toBe(true);
    }
    const ready = await db.reportJob.findUniqueOrThrow({ where: { id: first.jobId } });
    expect(ready.status).toBe("READY");
    const pdf = await readPrivate("reports", artifactName(ready.id, ready.attempts));
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(renderedPages).toBeGreaterThan(2);
    expect((await PDFDocument.load(pdf)).getPageCount()).toBe(renderedPages + 1);
    if (process.env.BANK_QA_PDF) await writeFile(process.env.BANK_QA_PDF, pdf);
  } finally { await other.dispose(); await user.dispose(); }
}, 90_000);

it("übernimmt aktive Bestandsmieten und kennzeichnet fehlende Originaldateien", async () => {
  const user = await masterDataFixture();
  try {
    const projectId = crypto.randomUUID();
    await saveProject(user.id, projectId, syntheticProject(user.prefix));
    const propertyId = await convertProject(user.id, projectId, 0, new Date("2020-01-01"));
    const unitId = crypto.randomUUID(), tenantId = crypto.randomUUID();
    await saveUnit(user.id, propertyId, unitId, { label: "EG", floor: null, livingArea: "80", rooms: null,
      use: "RESIDENTIAL", status: "VACANT", features: "", parkingSpaces: 0 });
    await saveTenant(user.id, tenantId, { firstName: "Test", lastName: "Person", street: "Testweg", houseNumber: "1",
      postalCode: "00000", city: "Testort", countryCode: "DE", phone: null, email: null });
    await createLease(user.id, unitId, crypto.randomUUID(), leaseInput.parse({
      tenantIds: [tenantId], startsOn: "2020-01-01", endsOn: "", rentModel: "FIXED", dueDay: "3", deposit: "0", depositTerms: "",
      baseRent: "825,50", operatingCosts: "100", operatingMode: "ADVANCE", heatingCosts: "0", heatingMode: "NONE",
    }));
    const form = new FormData();
    form.set("propertyId", propertyId); form.set("type", "CONTRACT"); form.set("description", "");
    form.set("file", new File(["%PDF-1.4\nsynthetisch\n%%EOF\n"], "testvertrag.pdf", { type: "application/pdf" }));
    const document = await storeDocument(user.id, form);
    await discardPrivate("documents", document);
    const input = bankInput.parse({ id: crypto.randomUUID(), sections: sectionKeys, rentRows: "", riskNotes: "",
      evidence: Object.fromEntries(evidenceKeys.map((key) => [key, key === "rents" ? document : ""])) });
    const data = bankPayload(await enqueueBankPackage(user.id, projectId, input));
    expect(data.rentOrigin).toBe("portfolio");
    expect(data.rentSummary.currentAnnual).toBe("9906");
    expect(data.rents[0]).toMatchObject({ unit: "EG", monthly: "825.50", source: "entered" });
    expect(data.attachments[0]).toMatchObject({ id: document, available: false });
    expect(data.checklist.find((item) => item.key === "rents")).toMatchObject({ assignedAttachmentId: document, attachmentId: null });
    expect(JSON.stringify(data)).not.toContain(tenantId);
  } finally { await user.dispose(); }
});
