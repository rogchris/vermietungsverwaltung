import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { hashPassword } from "better-auth/crypto";
import { base32 } from "@better-auth/utils/base32";
import { createOTP } from "@better-auth/utils/otp";
import { getDb } from "../../src/lib/db";

const password = "Synthetisches Testpasswort 2026";
const db = getDb();
let email: string;
let userId: string;

test.beforeEach(async () => {
  // Die vorige Bildschirmgröße kann den gemeinsamen Test-Limiter verwendet haben.
  await db.rateLimit.deleteMany({ where: { OR: [{ key: { startsWith: "127.0.0.1|" } }, { key: { startsWith: "no-trusted-ip|" } }] } });
  userId = randomUUID();
  email = `auth-${userId}@example.invalid`;
  const hash = await hashPassword(password);
  await db.user.create({
    data: {
      id: userId, email, role: "ADMIN", name: "Testkonto",
      accounts: { create: { id: randomUUID(), accountId: userId, providerId: "credential", password: hash } },
    },
  });
});

test.afterEach(async () => {
  await db.auditEvent.deleteMany({ where: { actorId: userId } });
  await db.user.deleteMany({ where: { id: userId } });
  // Die Tests laufen seriell in der dedizierten Testdatenbank.
  await db.rateLimit.deleteMany({ where: { OR: [{ key: { startsWith: "127.0.0.1|" } }, { key: { startsWith: "no-trusted-ip|" } }] } });
});

test.afterAll(() => db.$disconnect());

async function signIn(page: Page, value = password) {
  await page.getByLabel("E-Mail-Adresse").fill(email);
  await page.getByLabel("Passwort", { exact: true }).fill(value);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
}

test("richtet MFA ein, schützt den Bereich und verbraucht Wiederherstellungscodes einmalig", async ({ page, request, browser }) => {
  await page.goto("/");
  await expect(page).toHaveURL(/\/anmelden$/);
  expect((await request.post("/api/auth/sign-up/email", { data: { email, password, name: "Test" } })).status()).toBe(404);
  expect((await request.post("/api/auth/change-password", { data: { currentPassword: password, newPassword: password } })).status()).toBe(401);
  const second = await browser.newPage();
  try {
    await signIn(page);
    await expect(page.getByRole("heading", { name: "Zwei-Faktor-Schutz einrichten" })).toBeVisible();
    await second.goto("http://localhost:3100/anmelden");
    await signIn(second);
    await expect(second.getByRole("heading", { name: "Zwei-Faktor-Schutz einrichten" })).toBeVisible();
    await page.getByLabel("Passwort", { exact: true }).fill(password);
    let enrollments = 0;
    page.on("request", (event) => {
      if (event.url().endsWith("/api/auth/two-factor/enable")) enrollments += 1;
    });
    await page.getByRole("button", { name: "Schlüssel erstellen" }).evaluate((button) => {
      const form = (button as HTMLButtonElement).form;
      form?.requestSubmit();
      form?.requestSubmit();
    });
    const secret = await page.getByTestId("totp-secret").innerText();
    expect(enrollments).toBe(1);
    const code = await page.getByRole("list", { name: "Wiederherstellungscodes" }).getByRole("listitem").first().innerText();
    await page.getByRole("checkbox").check();
    await page.getByLabel("Code aus der Authenticator-App").fill(await createOTP(base32.decode(secret), { digits: 6, period: 30 }).totp());
    await page.getByRole("button", { name: "MFA aktivieren" }).click();
    await expect(page.getByRole("heading", { name: "Arbeitsbereich" })).toBeVisible();
    const layout = await page.evaluate(() => ({ visible: window.innerWidth, document: document.documentElement.scrollWidth }));
    expect(layout.document).toBeLessThanOrEqual(layout.visible);

    await second.goto("http://localhost:3100/");
    await expect(second).toHaveURL(/\/anmelden\?erneut=1$/);
    const headers = { origin: "http://localhost:3100" };
    expect((await second.request.post("http://localhost:3100/api/auth/change-password", {
      headers, data: { currentPassword: password, newPassword: "Ein anderes Testpasswort" },
    })).status()).toBe(403);

    await page.getByRole("link", { name: "Kontosicherheit" }).click();
    await page.getByRole("button", { name: "Andere Sitzungen widerrufen" }).click();
    await expect(page.getByRole("status")).toHaveText("Andere Sitzungen wurden widerrufen.");
    expect(await db.session.count({ where: { userId } })).toBe(1);
    await page.goto("/");
    await page.getByRole("button", { name: "Abmelden" }).click();
    await expect(page).toHaveURL(/\/anmelden$/);

    await signIn(page);
    await page.getByRole("button", { name: "Wiederherstellungscode verwenden" }).click();
    await page.getByLabel("Wiederherstellungscode").fill(code);
    await page.getByRole("button", { name: "Code bestätigen" }).click();
    await expect(page.getByRole("heading", { name: "Arbeitsbereich" })).toBeVisible();

    await db.session.updateMany({ where: { userId }, data: { expiresAt: new Date(0) } });
    const denied = await page.goto("/");
    await expect(page).toHaveURL(/\/anmelden$/);
    expect(denied?.headers()["cache-control"]).toContain("no-store");

    await signIn(page);
    await page.getByRole("button", { name: "Wiederherstellungscode verwenden" }).click();
    await page.getByLabel("Wiederherstellungscode").fill(code);
    await page.getByRole("button", { name: "Code bestätigen" }).click();
    await expect(page.getByRole("main").getByRole("alert")).toContainText("ungültig");
    await page.getByRole("button", { name: "Authenticator-Code verwenden" }).click();
    await page.getByLabel("Code aus der Authenticator-App").fill(await createOTP(base32.decode(secret)).totp());
    await page.getByRole("button", { name: "Code bestätigen" }).click();
    await page.getByRole("link", { name: "Kontosicherheit" }).click();

    const newPassword = "Synthetisches Ersatzpasswort 2026";
    await page.getByLabel("Aktuelles Passwort").fill(password);
    await page.getByLabel("Neues Passwort (mindestens 14 Zeichen)").fill(newPassword);
    await page.getByRole("button", { name: "Passwort speichern" }).click();
    await expect(page.getByRole("status")).toHaveText("Passwort gespeichert. Melde dich erneut an.");
    expect(await db.session.count({ where: { userId } })).toBe(0);
    const events = await db.auditEvent.findMany({ where: { actorId: userId }, select: { action: true } });
    expect(events.map(({ action }) => action)).toEqual(expect.arrayContaining([
      "auth.mfa_verified", "auth.sessions_revoked", "auth.signed_out", "auth.password_changed",
    ]));
    await signIn(page, newPassword);
    await expect(page.getByLabel("Code aus der Authenticator-App")).toBeVisible();
  } finally {
    await second.close();
  }
});

test("weist fremde Origins zurück und begrenzt fehlgeschlagene Anmeldungen", async ({ request }) => {
  const data = { email, password: "Falsches synthetisches Passwort" };
  const endpoint = "/api/auth/sign-in/email";
  const foreign = await request.post(endpoint, { headers: { origin: "https://example.invalid" }, data });
  expect(foreign.status()).toBe(403);

  const headers = { origin: "http://localhost:3100" };
  const statuses: number[] = [];
  for (let attempt = 0; attempt < 9; attempt++) {
    const response = await request.post(endpoint, { headers, data });
    statuses.push(response.status());
    if (response.status() === 429) break;
  }
  expect(statuses).toContain(401);
  expect(statuses.at(-1)).toBe(429);
  expect(await db.session.count({ where: { userId } })).toBe(0);
});
