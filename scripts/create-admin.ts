import { stdin, stdout } from "node:process";
import { createInterface } from "node:readline/promises";
import { Writable } from "node:stream";
import { getDb } from "../src/lib/db";
import { bootstrapAdmin } from "../src/modules/authentication/bootstrap";
import { adminInput } from "../src/modules/authentication/validation";

async function run() {
  if (!stdin.isTTY || !stdout.isTTY) throw new Error("Ein interaktives Terminal ist erforderlich.");

  let hidden = false;
  const output = new Writable({
    write(chunk, _encoding, callback) {
      if (!hidden) stdout.write(chunk);
      callback();
    },
  });
  const prompt = createInterface({ input: stdin, output, terminal: true, historySize: 0 });
  async function password(label: string) {
    stdout.write(label);
    hidden = true;
    try {
      return await prompt.question("");
    } finally {
      hidden = false;
      stdout.write("\n");
    }
  }

  try {
    const name = await prompt.question("Name: ");
    const email = await prompt.question("E-Mail: ");
    const first = await password("Passwort (mindestens 14 Zeichen): ");
    const confirmation = await password("Passwort wiederholen: ");
    if (first !== confirmation) throw new Error("Die Passwörter stimmen nicht überein.");
    const input = adminInput.safeParse({ name, email, password: first });
    if (!input.success) throw new Error("Bitte Name, E-Mail-Adresse und Passwortlänge prüfen.");

    await bootstrapAdmin(input.data).finally(() => getDb().$disconnect());
    stdout.write("Administratorkonto erstellt. Bei der ersten Anmeldung wird MFA eingerichtet.\n");
  } finally {
    prompt.close();
  }
}

run().catch((error: unknown) => {
  const known = [
    "Ein interaktives Terminal ist erforderlich.",
    "Die Passwörter stimmen nicht überein.",
    "Bitte Name, E-Mail-Adresse und Passwortlänge prüfen.",
    "Die Administratoreinrichtung wurde bereits ausgeführt.",
  ];
  const message = error instanceof Error && known.includes(error.message)
    ? error.message : "Administratorkonto konnte nicht erstellt werden. Datenbank und Migration prüfen.";
  console.error(message);
  process.exitCode = 1;
});
