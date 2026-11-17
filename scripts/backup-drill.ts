import "../tests/support/load-env";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve, sep } from "node:path";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { getDb } from "../src/lib/db";
import { storeDocument } from "../src/modules/documents/service";
import { masterDataFixture } from "../tests/support/master-data-fixture";
import { financeFixture } from "../tests/support/finance-fixture";

const source = new URL(process.env.DATABASE_URL!);
const name = "vermietung_restore_drill_" + crypto.randomUUID().replaceAll("-", "").slice(0, 16);
const target = new URL(source);
target.pathname = "/" + name;
const base = resolve(tmpdir());
const stage = mkdtempSync(join(base, "vermietung-restore-"));
if (!resolve(stage).startsWith(base + sep)) throw new Error("Unerwarteter Testpfad.");
const bin = process.env.PG_BIN_DIR;
const env = { ...process.env, PGHOST: source.hostname.replace(/^\[|\]$/g, ""), PGPORT: source.port || "5432",
  PGUSER: decodeURIComponent(source.username), PGPASSWORD: decodeURIComponent(source.password) };
function run(command: string, args: string[], pg = false) {
  const executable = pg && bin ? join(bin, command + (process.platform === "win32" ? ".exe" : "")) : command;
  const result = spawnSync(executable, args, { env, stdio: ["ignore", "inherit", "inherit"] });
  if (result.status !== 0) throw new Error(command + " fehlgeschlagen.");
}

const fixture = await masterDataFixture();
let created = false;
try {
  const { propertyId } = await financeFixture(fixture.id, fixture.prefix);
  const bytes = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/uikAAAAASUVORK5CYII=", "base64");
  const form = new FormData();
  form.set("propertyId", propertyId); form.set("type", "PHOTO"); form.set("description", "Restore-Test");
  form.set("file", new File([new Uint8Array(bytes)], "restore-test.png", { type: "image/png" }));
  const id = await storeDocument(fixture.id, form);
  const dump = join(stage, "database.dump"), archive = join(stage, "files.tar"), restoredFiles = join(stage, "restored");
  run("pg_dump", ["-Fc", "-f", dump, "vermietung_test"], true);
  run("tar", ["-cf", archive, "-C", process.env.APP_DATA_DIR!, "."], false);
  const restic = process.env.RESTIC_DRILL_EXE;
  let restoreDump = dump, restoreArchive = archive;
  if (restic) {
    const password = join(stage, "restic-password");
    const repo = join(stage, "restic-repo");
    writeFileSync(password, crypto.randomUUID(), { mode: 0o600 });
    const args = ["-r", repo, "--password-file", password];
    run(restic, [...args, "init"]);
    const names = ["database.dump", "files.tar"];
    writeFileSync(join(stage, "manifest.sha256"), names.map((name) => createHash("sha256").update(readFileSync(join(stage, name))).digest("hex") + "  " + name).join("\n") + "\n");
    run(restic, [...args, "backup", "--stdin-from-command", "--stdin-filename", "vermietung-backup.tar", "--tag", "vermietung", "--",
      "tar", "-C", stage, "-cf", "-", ...names, "manifest.sha256"]);
    run(restic, [...args, "check", "--read-data"]);
    const bundle = spawnSync(restic, [...args, "dump", "latest", "/vermietung-backup.tar"], { env, maxBuffer: 64 * 1024 * 1024 });
    if (bundle.status !== 0) throw new Error("Restic-Archiv konnte nicht gelesen werden.");
    const extracted = join(stage, "restic-restore");
    mkdirSync(extracted);
    const bundled = join(stage, "bundle.tar");
    writeFileSync(bundled, bundle.stdout);
    run("tar", ["-xf", bundled, "-C", extracted]);
    for (const file of [...names, "manifest.sha256"]) {
      if (!readFileSync(join(stage, file)).equals(readFileSync(join(extracted, file)))) throw new Error("Restic-Inhalt weicht ab.");
    }
    restoreDump = join(extracted, names[0]);
    restoreArchive = join(extracted, names[1]);
  }
  run("createdb", [name], true); created = true;
  run("pg_restore", ["--exit-on-error", "--no-owner", "-d", name, restoreDump], true);
  mkdirSync(restoredFiles);
  run("tar", ["-xf", restoreArchive, "-C", restoredFiles]);
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: target.href }) });
  try {
    const file = await db.document.findUniqueOrThrow({ where: { id }, include: { property: true } });
    const restored = readFileSync(join(restoredFiles, "documents", id));
    if (file.property?.name !== fixture.prefix || !restored.equals(bytes) ||
        createHash("sha256").update(restored).digest("hex") !== file.sha256) throw new Error("Wiederhergestellte Daten stimmen nicht überein.");
    console.log("Restore-Test bestanden: PostgreSQL-Stammdaten und privates Dokument stimmen bytegenau überein.");
  } finally { await db.$disconnect(); }
} finally {
  try {
    if (created) run("dropdb", [name], true);
  } finally {
    await fixture.dispose();
    await getDb().$disconnect();
    rmSync(stage, { recursive: true, force: true });
  }
}
