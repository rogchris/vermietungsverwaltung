import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { config } from "dotenv";

config({ path: ".env.test", quiet: true });
const connection = process.env.TEST_DATABASE_URL;
if (!connection) throw new Error("TEST_DATABASE_URL für die separate Testdatenbank fehlt.");
const url = new URL(connection);
if (url.protocol !== "postgresql:" || !["localhost", "127.0.0.1", "[::1]"].includes(url.hostname) ||
    url.pathname !== "/vermietung_test") {
  throw new Error("Tests benötigen die lokale Datenbank vermietung_test.");
}
process.env.DATABASE_URL = connection;
process.env.BETTER_AUTH_URL = "http://localhost:3100";
if (!process.env.BETTER_AUTH_SECRET || process.env.BETTER_AUTH_SECRET.length < 32) {
  throw new Error("BETTER_AUTH_SECRET für Tests fehlt.");
}
delete process.env.AUTH_CLIENT_IP_HEADER;

if (!process.env.VERMIETUNG_TEST_DATA_DIR) process.env.VERMIETUNG_TEST_DATA_DIR = mkdtempSync(join(tmpdir(), "vermietung-test-"));
process.env.APP_DATA_DIR = process.env.VERMIETUNG_TEST_DATA_DIR;
delete process.env.CLAMAV_HOST;
delete process.env.REQUIRE_MALWARE_SCAN;
