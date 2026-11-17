# Tests

Nach `npm ci` und `npm run db:generate` sind `npm run db:validate`, `npm run lint`, `npm run typecheck` und `npm test` lokal ausführbar. `npm audit` prüft den vollständigen Paketbaum und `npm audit --omit=dev` die Laufzeitabhängigkeiten.

## PostgreSQL- und Browsertests

1. Eine getrennte lokale Datenbank `vermietung_test` erstellen, etwa mit `docker compose exec postgres createdb -U vermietung vermietung_test`.
2. `.env.test` mit `TEST_DATABASE_URL=postgresql://vermietung:PASSWORT@127.0.0.1:5432/vermietung_test` und einem separaten zufälligen `BETTER_AUTH_SECRET` anlegen.
3. Die Migration auf die Testdatenbank anwenden. Unter PowerShell zuerst `$env:DATABASE_URL = '<URL der Testdatenbank>'` setzen, `npm run db:deploy` ausführen und danach mit `Remove-Item Env:DATABASE_URL` die Variable wieder entfernen.
4. `npm run test:integration` ausführen.
5. `npx playwright install chromium`, `npm run build` und `npm run test:e2e` ausführen.

Die Browsertests starten den Produktionsbuild auf Port 3100. Sie prüfen den Kontofluss auf 375, 768 und 1440 Pixeln. Testdaten bleiben synthetisch. Die Stammdaten-Browsertests prüfen denselben Ablauf zusätzlich für Immobilien, Einheiten, zwei Vertragsparteien und historische Mietkonditionen. Die Finanz- und Dokumentenszenarien prüfen Teilzahlungen, Zugriffsschutz, Upload, PDF-Erzeugung und den administrativen Datenexport.

Die Phase-2-Fixtures kontrollieren vor dem Anlegen eines temporären Kontos den Datenbanknamen auch direkt in PostgreSQL. Sie erzeugen synthetische Daten in vermietung_test und räumen die zugehörigen Datensätze und Konten nach dem Test auf. Der persönliche Administratoreinrichtungsbefehl wird dafür nicht aufgerufen.

Die Tests für PDF-Erstellung benötigen Chromium aus dem gepinnten Playwright. Beim separaten Restore-Drill entstehen nur synthetische Daten und eine eigens dafür angelegte Restore-Datenbank. Hinweise stehen in BACKUP_RESTORE.md.
