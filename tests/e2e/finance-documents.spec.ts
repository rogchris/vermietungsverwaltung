import { PDFDocument } from "pdf-lib";
import { renderBankPackageV1 } from "../../src/modules/bank-package/content";
import { bankPayload } from "../../src/modules/bank-package/service";
import { bankFixture } from "../support/bank-fixture";
import { expect, test, type Page } from "@playwright/test";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { getDb } from "../../src/lib/db";
import { berlinToday } from "../../src/modules/stammdaten/calendar";
import { processNextReport } from "../../src/modules/reports/jobs";
import { renderPdf } from "../../src/modules/reports/pdf";
import { masterDataFixture } from "../support/master-data-fixture";
import { financeFixture } from "../support/finance-fixture";

const db = getDb();
test.afterAll(() => db.$disconnect());

async function authenticate(page: Page, user: Awaited<ReturnType<typeof masterDataFixture>>) {
    await page.goto("/anmelden");
    await page.getByLabel("E-Mail-Adresse").fill(user.email);
    await page.getByLabel("Passwort", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Anmelden", exact: true }).click();
    await expect(page.getByRole("heading", { name: "Zwei-Faktor-Schutz einrichten" })).toBeVisible();
    await page.getByLabel("Passwort", { exact: true }).fill(user.password);
    await page.getByRole("button", { name: "Schlüssel erstellen" }).click();
    const secret = await page.getByTestId("totp-secret").innerText();
    await page.getByRole("checkbox").check();
    await page.getByLabel("Code aus der Authenticator-App").fill(await createOTP(base32.decode(secret)).totp());
    await page.getByRole("button", { name: "MFA aktivieren" }).click();
    await expect(page.getByRole("heading", { name: "Arbeitsbereich" })).toBeVisible();
}

test("bucht Teilzahlungen, lädt Belege hoch und lädt einen erzeugten PDF-Bericht herunter", async ({ page, request }) => {
  test.setTimeout(90_000);
  const user = await masterDataFixture(true);
  try {
    const { propertyId } = await financeFixture(user.id, user.prefix, "2000-01-01");
    const month = berlinToday().toISOString().slice(0, 7);
    await authenticate(page, user);

    await page.goto("/finanzen?monat=" + month + "&objekt=" + propertyId);
    await page.getByRole("button", { name: "Mietforderungen erzeugen" }).click();
    await expect(page.getByRole("status")).toHaveText("1 neue Mietforderungen erzeugt.");
    await page.getByText("Zahlung erfassen", { exact: true }).click();
    await page.locator("details[open]").filter({ hasText: "Zahlung erfassen" }).getByLabel("Betrag (EUR)").fill("600");
    await page.getByRole("button", { name: "Zahlung speichern" }).click();
    await expect(page.getByRole("status")).toHaveText("Änderung gespeichert.");
    await page.getByText("Zahlung bearbeiten", { exact: true }).click();
    await page.getByRole("button", { name: "Betrag zuordnen" }).locator("..").locator("..").getByLabel("Betrag (EUR)").fill("600");
    await page.getByRole("button", { name: "Betrag zuordnen" }).click();
    await expect(page.locator("section").filter({ has: page.getByRole("heading", { name: "Mietforderungen", exact: true }) }).getByText("300,00 €", { exact: true })).toBeVisible();

    await page.goto("/dokumente?objekt=" + propertyId);
    const malformed = await page.request.post("/api/dokumente", {
      headers: { origin: new URL(page.url()).origin, "content-type": "multipart/form-data; boundary=test" },
      data: "unvollständige Testanfrage",
    });
    expect(malformed.status()).toBe(400);
    expect(await malformed.json()).toEqual({ error: "INVALID_UPLOAD" });
    const oversized = await page.request.post("/api/dokumente", {
      headers: { origin: new URL(page.url()).origin },
      multipart: { propertyId, file: { name: "zu-gross.png", mimeType: "image/png", buffer: Buffer.alloc(11 * 1024 * 1024) } },
    });
    expect(oversized.status()).toBe(413);
    const input = page.getByLabel("Datei");
    await input.setInputFiles({ name: "ungültig.png", mimeType: "image/png", buffer: Buffer.from("synthetisch aber ungültig") });
    await page.getByRole("button", { name: "Dokument hochladen" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("PDF, JPEG oder PNG");
    const guide = await PDFDocument.create();
    guide.addPage().drawText("Demo-Beleg A01 - fiktiv");
    await input.setInputFiles({ name: "demo-beleg-a01.pdf", mimeType: "application/pdf", buffer: Buffer.from(await guide.save()) });
    await page.getByRole("button", { name: "Dokument hochladen" }).click();
    const link = page.getByRole("link", { name: "demo-beleg-a01.pdf" });
    await expect(link).toBeVisible();
    const href = (await link.getAttribute("href"))!;
    expect((await request.get(href)).status()).toBe(401);
    expect((await page.request.get(href)).headers()["cache-control"]).toContain("no-store");
    await db.user.update({ where: { id: user.id }, data: { role: "VIEWER" } });
    expect((await page.request.post("/api/dokumente", { multipart: { propertyId } })).status()).toBe(403);
    expect((await page.request.get("/api/verwaltung/export")).status()).toBe(403);
    await db.user.update({ where: { id: user.id }, data: { role: "ADMIN" } });

    await page.goto("/berichte?monat=" + month + "&objekt=" + propertyId);
    await page.getByLabel("Berichtstyp").selectOption("CASHFLOW");
    await page.getByRole("button", { name: "PDF erstellen" }).click();
    await expect(page.getByText("Bericht beauftragt.")).toBeVisible();
    expect(await processNextReport(renderPdf)).toBe(true);
    const download = page.getByRole("link", { name: "PDF herunterladen" });
    await expect(download).toBeVisible({ timeout: 15_000 });
    const pdf = await page.request.get((await download.getAttribute("href"))!);
    expect(pdf.status()).toBe(200);
    expect((await pdf.body()).subarray(0, 5).toString()).toBe("%PDF-");
    const archive = await page.request.get("/api/verwaltung/export");
    expect(archive.status()).toBe(200);
    expect(archive.headers()["cache-control"]).toContain("no-store");
    const bytes = await archive.body();
    expect(bytes.subarray(0, 10).toString()).toBe("daten.json");
    expect(bytes.includes(Buffer.from("demo-beleg-a01.pdf"))).toBe(true);
    expect(bytes.includes(Buffer.from(user.password))).toBe(false);
    await page.goto("/dashboard?monat=" + month + "&objekt=" + propertyId);
    await expect(page.getByRole("heading", { name: "Dashboard" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  } finally { await user.dispose(); }
});

test("legt ein Kaufobjekt an, speichert Kalkulation und Darlehen und übernimmt den Bestand", async ({ page }) => {
  test.setTimeout(80_000);
  const user = await masterDataFixture(true);
  try {
    await authenticate(page, user);
    await page.goto("/ankauf?neu=1");
    await page.getByLabel("Objektbezeichnung").fill(user.prefix);
    await page.getByLabel("Straße").fill("Testweg");
    await page.getByLabel("Hausnummer").fill("1");
    await page.getByLabel("Postleitzahl").fill("00000");
    await page.getByRole("textbox", { name: /^Ort/ }).fill("Testort");
    await page.getByLabel("Bundesland").selectOption("HE");
    await page.getByLabel("Wohnfläche (m²)").fill("90");
    await page.getByLabel("Kaufpreis (EUR)").fill("100000");
    await page.getByLabel("Erwartete Jahresnettokaltmiete (EUR)").fill("12000");
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await expect(page.getByRole("heading", { name: user.prefix })).toBeVisible();
    await page.getByLabel("Grunderwerbsteuer (%)").fill("6");
    await page.getByLabel("Notar (%)").fill("1,5");
    await page.getByLabel("Grundbuch (%)").fill("0,5");
    await page.getByLabel("Makler (%)").fill("0");
    await page.getByLabel("Eigenkapital (EUR)").fill("40000");
    await page.getByRole("button", { name: "Szenario speichern" }).click();
    await expect(page.getByText("Kapitalbedarf 108.000,00 €", { exact: true })).toBeVisible();
    await page.getByText("Darlehen oder Anschlussfinanzierung hinzufügen", { exact: true }).click();
    await page.getByLabel("Darlehensname").fill("Synthetisches Darlehen");
    await page.getByLabel("Darlehensbetrag (EUR)").fill("68000");
    await page.getByLabel("Sollzinssatz (%)").fill("3");
    await page.getByLabel("Anfangstilgung (%)").fill("2");
    await page.getByRole("button", { name: "Darlehen hinzufügen" }).click();
    await expect(page.getByRole("heading", { name: "Synthetisches Darlehen" })).toBeVisible();
    await expect(page.getByText("Finanzierungslücke 0,00 €", { exact: true })).toBeVisible();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Als Bestandsimmobilie übernehmen" }).click();
    await expect(page.getByRole("status")).toHaveText("Kaufobjekt in den Bestand übernommen.");
    await page.getByRole("link", { name: "Kaufarchiv öffnen" }).click();
    await expect(page.getByText("Übernommenes Kaufprojekt · archiviert")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Synthetisches Darlehen" })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  } finally { await user.dispose(); }
});

test("erstellt eine Bankmappe mit Nachweis und lädt die unveränderte Fassung herunter", async ({ page, request }) => {
  test.setTimeout(70_000);
  const user = await masterDataFixture(true);
  try {
    const fixture = await bankFixture(user.id, user.prefix);
    await authenticate(page, user);
    await page.goto("/ankauf/" + fixture.id);
    await page.getByRole("link", { name: "Bankmappe öffnen" }).click();
    await page.getByLabel("Exposé / Objektunterlagen").selectOption(fixture.documentId);
    await page.getByRole("checkbox", { name: "test-expose.pdf" }).check();
    await page.getByLabel("Mietpositionen").fill("EG | vermietet | 800,25 | Angabe");
    await page.getByLabel("Eigene Risikohinweise").fill("Synthetischer Prüfhinweis");
    await page.getByRole("button", { name: "Bankmappe erstellen" }).click();
    await expect(page.getByRole("heading", { name: "Bankmappe · Version 1" })).toBeVisible();
    await expect(page.getByRole("listitem").filter({ hasText: /^Eigenkapitalnachweis · Fehlt$/ })).toBeVisible();
    const jobId = new URL(page.url()).searchParams.get("version")!;
    const snapshot = await db.bankSnapshot.findUniqueOrThrow({ where: { jobId } });
    expect(renderBankPackageV1(bankPayload(snapshot), snapshot.version)).toContain("Eigenkapitalrendite");
    expect(await processNextReport(renderPdf)).toBe(true);
    expect((await db.reportJob.findUniqueOrThrow({ where: { id: jobId } })).status).toBe("READY");
    const link = page.getByRole("link", { name: "Bankmappe herunterladen" });
    await expect(link).toBeVisible({ timeout: 15_000 });
    const href = (await link.getAttribute("href"))!;
    const original = await page.request.get(href);
    expect(original.status()).toBe(200);
    expect((await request.get(href)).status()).toBe(401);
    expect(original.headers()["cache-control"]).toContain("no-store");
    expect(original.headers()["content-disposition"]).toContain("bankmappe-v1.pdf");
    const printable = await page.request.get(href + "?druck=1");
    expect(printable.headers()["content-disposition"]).toContain("inline");
    const pdf = await original.body();
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    const fileLink = page.getByRole("link", { name: "A01 · test-expose.pdf" });
    const fileUrl = (await fileLink.getAttribute("href"))!;
    expect((await request.get(fileUrl)).status()).toBe(401);
    expect(await (await page.request.get(fileUrl)).body()).toEqual(fixture.bytes);
    const combined = await PDFDocument.load(pdf);
    expect(combined.getPageCount()).toBeGreaterThan(12);
    expect((await page.request.get(fileUrl.replace(fixture.documentId, crypto.randomUUID()))).status()).toBe(404);
    await db.acquisitionProject.update({ where: { id: fixture.id }, data: { name: "Nachträglich geändert" } });
    expect(await (await page.request.get(href)).body()).toEqual(pdf);
    await page.getByRole("link", { name: /^Version 1/ }).click();
    await expect(page.getByText("Projektstand im Snapshot: " + user.prefix + ".")).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  } finally { await user.dispose(); }
});
