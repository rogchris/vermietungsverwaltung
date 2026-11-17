import { expect, test, type Page } from "@playwright/test";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { getDb } from "../../src/lib/db";
import { processNextReport } from "../../src/modules/reports/jobs";
import { renderPdf } from "../../src/modules/reports/pdf";
import { berlinToday } from "../../src/modules/stammdaten/calendar";
import { masterDataFixture } from "../support/master-data-fixture";

const db = getDb();
type Fixture = Awaited<ReturnType<typeof masterDataFixture>>;

async function signIn(page: Page, fixture: Fixture) {
  await page.goto("/immobilien");
  await expect(page).toHaveURL(/\/anmelden$/);
  await page.getByLabel("E-Mail-Adresse").fill(fixture.email);
  await page.getByLabel("Passwort", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Zwei-Faktor-Schutz einrichten" })).toBeVisible();
  await page.getByLabel("Passwort", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "Schlüssel erstellen" }).click();
  const secret = await page.getByTestId("totp-secret").innerText();
  await page.getByRole("checkbox").check();
  await page.getByLabel("Code aus der Authenticator-App").fill(await createOTP(base32.decode(secret)).totp());
  await page.getByRole("button", { name: "MFA aktivieren" }).click();
  await expect(page.getByRole("heading", { name: "Arbeitsbereich" })).toBeVisible();
}

async function address(page: Page) {
  await page.getByLabel("Straße").fill("Testweg");
  await page.getByLabel("Hausnummer").fill("1");
  await page.getByLabel("Postleitzahl").fill("00000");
  await page.getByRole("textbox", { name: /^Ort/ }).fill("Testort");
}

async function save(page: Page, notice = "Änderung gespeichert.") {
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(page.getByRole("status")).toHaveText(notice);
}

async function createTenant(page: Page, firstName: string, lastName: string) {
  await page.goto("/mieter/neu");
  await page.getByLabel("Vorname").fill(firstName);
  await page.getByLabel("Nachname").fill(lastName);
  await address(page);
  await save(page);
  return new URL(page.url()).pathname;
}

test("verwaltet Bestand, Vertrag und Mietkonditionen mit einem temporären Konto", async ({ page }) => {
  test.setTimeout(95_000);
  const fixture = await masterDataFixture(true);
  try {
    await signIn(page, fixture);
    await page.getByRole("link", { name: "Immobilien", exact: true }).click();
    await page.getByRole("link", { name: "Immobilie anlegen" }).click();
    await page.getByLabel("Objektbezeichnung").fill(fixture.prefix);
    await address(page);
    await page.getByLabel("Bundesland").selectOption("HE");
    await page.getByLabel("Wohnfläche (m²)").fill("-20");
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("markierten Angaben");
    await expect(page.getByLabel("Objektbezeichnung")).toHaveValue(fixture.prefix);
    await page.getByLabel("Wohnfläche (m²)").fill("90,25");

    const stay = page.waitForEvent("dialog").then((dialog) => dialog.dismiss());
    await page.getByRole("link", { name: "Abbrechen" }).click();
    await stay;
    await expect(page.getByLabel("Wohnfläche (m²)")).toHaveValue("90,25");
    await save(page);
    const propertyPath = new URL(page.url()).pathname;
    await expect(page.getByRole("heading", { name: fixture.prefix })).toBeVisible();

    await page.getByRole("link", { name: "Immobilie bearbeiten" }).click();
    await page.getByLabel("Baujahr").fill("1990");
    await save(page);
    await expect(page.getByText("1990", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Einheit anlegen" }).click();
    await page.getByLabel("Einheitsbezeichnung").fill("WE 01");
    await page.getByLabel("Wohnfläche (m²)").fill("75,50");
    await page.getByLabel("Zimmeranzahl").fill("2,5");
    await save(page);
    const unitPath = new URL(page.url()).pathname;
    await page.getByRole("link", { name: "Einheit bearbeiten" }).click();
    await page.getByLabel("Etage").fill("EG");
    await save(page);
    await expect(page.getByText("EG", { exact: true })).toBeVisible();

    const firstTenant = await createTenant(page, "Synthetisch", fixture.prefix);
    await page.getByRole("link", { name: "Mieter bearbeiten" }).click();
    await page.getByLabel("Telefon").fill("000 000000");
    await save(page);
    await expect(page.getByText("000 000000", { exact: true })).toBeVisible();
    await createTenant(page, "Zweitpartei", fixture.prefix);

    await page.goto(unitPath);
    await page.getByRole("link", { name: "Mietvertrag anlegen" }).click();
    await page.getByRole("checkbox", { name: "Synthetisch " + fixture.prefix }).check();
    await page.getByRole("checkbox", { name: "Zweitpartei " + fixture.prefix }).check();
    await page.getByLabel("Vertragsbeginn").fill("2000-12-01");
    await page.getByLabel("Nettokaltmiete (EUR)").fill("800");
    await page.getByLabel("Betriebskostenart").selectOption("ADVANCE");
    await page.getByLabel("Betriebskosten (EUR)").fill("100");
    await save(page);
    const leasePath = new URL(page.url()).pathname;
    await expect(page.getByRole("link", { name: "Synthetisch " + fixture.prefix })).toBeVisible();
    await expect(page.getByRole("link", { name: "Zweitpartei " + fixture.prefix })).toBeVisible();

    await page.getByRole("link", { name: "Mietänderung erfassen" }).click();
    await page.getByLabel("Gültig ab").fill("2001-01-01");
    await page.getByLabel("Nettokaltmiete (EUR)").fill("850,25");
    await save(page, "Neue Mietkondition gespeichert.");
    const history = page.getByRole("list", { name: "Historische Mietkonditionen" });
    await expect(history.getByRole("listitem")).toHaveCount(2);
    await expect(history.getByText("800,00 €", { exact: true })).toBeVisible();
    await expect(history.getByText("950,25 €", { exact: true })).toBeVisible();

    await page.getByRole("link", { name: "Vertrag bearbeiten" }).click();
    await page.getByLabel("Vertragsende").fill("2001-01-31");
    await save(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => window.innerWidth));

    await page.goto(firstTenant);
    await expect(page.getByRole("link", { name: fixture.prefix + " · WE 01" })).toBeVisible();

    await page.goto(propertyPath + "?bearbeiten=1");
    await page.getByLabel("Baujahr").fill("2000");
    await db.user.update({ where: { id: fixture.id }, data: { role: "VIEWER" } });
    await page.getByRole("button", { name: "Speichern", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("Administratorkonto");
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("link", { name: "Abbrechen" }).click();
    await expect(page.getByText("1990", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Immobilie bearbeiten" })).toHaveCount(0);
    await db.user.update({ where: { id: fixture.id }, data: { role: "ADMIN" } });

    await page.reload();
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Immobilie archivieren" }).click();
    await expect(page.getByRole("status")).toHaveText("Datensatz archiviert.");
    await page.goto("/immobilien");
    await page.getByLabel("Suche").fill(fixture.prefix.toLowerCase());
    await page.getByLabel("Status").selectOption("archiviert");
    await page.getByLabel("Immobilientyp").selectOption("MULTI_FAMILY");
    await page.getByRole("button", { name: "Anwenden" }).click();
    await expect(page.getByRole("link", { name: new RegExp(fixture.prefix) })).toBeVisible();

    const response = await page.goto(leasePath);
    await expect(history.getByRole("listitem")).toHaveCount(2);
    expect(response?.headers()["cache-control"]).toContain("no-store");
    await expect(page.getByRole("link", { name: "Vertrag bearbeiten" })).toHaveCount(0);
  } finally {
    await fixture.dispose();
  }
});

test("führt einen Vermietungsfall bis zum archivierten Objekt und Stichtags-PDF aus", async ({ page, request }) => {
  test.setTimeout(120_000);
  page.setDefaultTimeout(10_000);
  const fixture = await masterDataFixture(true);
  const propertyName = "Pilot-Mietshaus " + fixture.prefix.slice(5, 13);
  const today = berlinToday();
  const lastMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - 1, 1));
  const lastDay = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 0));
  const iso = (date: Date) => date.toISOString().slice(0, 10);
  const month = iso(lastMonth).slice(0, 7);
  const current = iso(today).slice(0, 7);
  const checkWidth = async () => {
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(await page.evaluate(() => innerWidth));
  };
  try {
    await signIn(page, fixture);
    await page.getByRole("link", { name: "Immobilien", exact: true }).click();
    await page.getByRole("link", { name: "Immobilie anlegen" }).click();
    await page.getByLabel("Objektbezeichnung").fill(propertyName);
    await address(page);
    await page.getByLabel("Bundesland").selectOption("HE");
    await page.getByLabel("Wohnfläche (m²)").fill("125");
    await save(page);
    const propertyPath = new URL(page.url()).pathname;
    const propertyId = propertyPath.split("/").at(-1)!;
    const leases = [];
    for (const unit of [
      { label: "WE 01", area: "70", tenant: "Testmieterin", base: "750", costs: "150" },
      { label: "WE 02", area: "55", tenant: "Testmieter", base: "550", costs: "150" },
    ]) {
      await page.goto(propertyPath);
      await page.getByRole("link", { name: "Einheit anlegen" }).click();
      await page.getByLabel("Einheitsbezeichnung").fill(unit.label);
      await page.getByLabel("Wohnfläche (m²)").fill(unit.area);
      await save(page);
      const unitPath = new URL(page.url()).pathname;
      await createTenant(page, unit.tenant, propertyName);
      await page.goto(unitPath);
      await page.getByRole("link", { name: "Mietvertrag anlegen" }).click();
      await page.getByRole("checkbox", { name: unit.tenant + " " + propertyName + " · Testort", exact: true }).check();
      await page.getByLabel("Vertragsbeginn").fill(iso(lastMonth));
      await page.getByLabel("Vertragsende").fill(iso(lastDay));
      await page.getByLabel("Nettokaltmiete (EUR)").fill(unit.base);
      await page.getByLabel("Betriebskostenart").selectOption("ADVANCE");
      await page.getByLabel("Betriebskosten (EUR)").fill(unit.costs);
      await save(page);
      leases.push(new URL(page.url()).pathname.split("/").at(-1)!);
    }

    await page.goto("/finanzen?monat=" + month + "&objekt=" + propertyId);
    await page.getByRole("button", { name: "Mietforderungen erzeugen" }).click();
    await expect(page.getByRole("status")).toHaveText("2 neue Mietforderungen erzeugt.");
    // The browser test runs in one day. Model last month's original booking date only in the guarded test DB.
    const booked = await db.rentReceivable.updateMany({ where: { leaseId: { in: leases }, period: lastMonth }, data: { bookedOn: lastMonth } });
    expect(booked.count).toBe(2);
    await page.goto("/finanzen?monat=" + current + "&objekt=" + propertyId);
    await page.getByText("Zahlung erfassen", { exact: true }).click();
    const payment = page.locator("details[open]").filter({ hasText: "Zahlung erfassen" });
    await payment.getByLabel("Betrag (EUR)").fill("500");
    await payment.getByLabel("Verwendungszweck").fill("Teilzahlung WE 01");
    await page.getByRole("button", { name: "Zahlung speichern" }).click();
    await expect(page.getByRole("status")).toHaveText("Änderung gespeichert.");
    await page.getByText("Zahlung bearbeiten", { exact: true }).click();
    const assignment = page.locator("details[open]").filter({ hasText: "Zahlung bearbeiten" });
    await assignment.getByLabel("Forderung").selectOption({ label: "WE 01 · " + month + " · 900,00 €" });
    await assignment.getByLabel("Betrag (EUR)").fill("501");
    await page.getByRole("button", { name: "Betrag zuordnen" }).click();
    await expect(assignment.getByRole("alert")).toContainText("Zahlungsbetrag reicht nicht aus");
    await assignment.getByLabel("Betrag (EUR)").fill("500");
    await page.getByRole("button", { name: "Betrag zuordnen" }).click();
    await expect(page.getByRole("status")).toHaveText("Änderung gespeichert.");
    const arrears = page.locator("section").filter({ has: page.getByRole("heading", { name: "Rückstände", exact: true }) });
    await expect(arrears.getByText("400,00 €")).toBeVisible();
    await expect(arrears.getByText("700,00 €")).toBeVisible();

    await page.getByText("Ausgabe erfassen", { exact: true }).click();
    const expense = page.locator("details[open]").filter({ hasText: "Ausgabe erfassen" });
    await expense.getByLabel("Betrag (EUR)").fill("125,50");
    await expense.getByLabel("Kostenkategorie").selectOption("OPERATING");
    await expense.getByLabel("Beschreibung").fill("Synthetischer Hausstrom");
    await page.getByRole("button", { name: "Ausgabe speichern" }).click();
    await expect(page.getByRole("status")).toHaveText("Änderung gespeichert.");
    await expect(page.getByText("374,50 €", { exact: true })).toBeVisible();
    await checkWidth();
    await page.getByRole("link", { name: "Belege zur Ausgabe" }).click();
    const proof = await renderPdf("<h1>Synthetischer Hausstrombeleg</h1>");
    await page.getByLabel("Datei").setInputFiles({ name: "hausstrom-test.pdf", mimeType: "application/pdf", buffer: Buffer.from(proof) });
    await page.getByRole("button", { name: "Dokument hochladen" }).click();
    const attachment = page.getByRole("link", { name: "hausstrom-test.pdf" });
    await expect(attachment).toBeVisible();
    const attachmentUrl = (await attachment.getAttribute("href"))!;
    expect((await request.get(attachmentUrl)).status()).toBe(401);
    expect(await (await page.request.get(attachmentUrl)).body()).toEqual(Buffer.from(proof));
    await checkWidth();

    await page.goto(propertyPath);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Immobilie archivieren" }).click();
    await expect(page.getByRole("status")).toHaveText("Datensatz archiviert.");
    await page.goto("/berichte?monat=" + month + "&objekt=" + propertyId);
    await page.getByLabel("Berichtstyp").selectOption("ARREARS");
    await page.getByRole("button", { name: "PDF erstellen" }).click();
    await expect(page.getByText("Bericht beauftragt.")).toBeVisible();
    expect(await processNextReport(async (html) => {
      expect(html).toContain("<td>900,00 €</td>");
      expect(html).toContain("<td>700,00 €</td>");
      expect(html).toContain("<td>1.600,00 €</td>");
      expect(html).not.toContain("<td>400,00 €</td>");
      expect(html).toContain("Rückstände zum ");
      return renderPdf(html);
    })).toBe(true);
    const download = page.getByRole("link", { name: "PDF herunterladen" });
    await expect(download).toBeVisible();
    const response = await page.request.get((await download.getAttribute("href"))!);
    expect(response.ok()).toBe(true);
    expect(response.headers()["content-type"]).toContain("application/pdf");
    expect((await response.body()).subarray(0, 5).toString()).toBe("%PDF-");
    await checkWidth();
  } finally {
    await fixture.dispose();
  }
});

test.afterAll(() => db.$disconnect());
