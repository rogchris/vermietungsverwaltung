# Projektregeln

- Phasenfolge und Abnahmestand in `docs/IMPLEMENTATION_STATUS.md` pflegen. Die nächste Fachphase beginnt nach Prüfung des Meilensteins.
- Next.js App Router, TypeScript Strict, Prisma 7 und PostgreSQL. Exakte direkte Paketversionen und Lockdatei. Datenbankänderungen ausschließlich über eingecheckte Migrationen.
- `src/app` orchestriert HTTP und UI. Fachlogik in `src/modules`, Infrastruktur in `src/lib`, UI-Bausteine in `src/components`. Daten und Dateien am serverseitigen Einstieg autorisieren.
- Zod validiert externe Eingaben. Geld als PostgreSQL NUMERIC und Prisma Decimal behandeln. Mietkonditionen und entstandene Forderungen historisch erhalten.
- Keine öffentliche Registrierung, keine Klartextpasswörter oder Tokens in Logs. Keine echten Mieterdaten in Tests, Seeds oder externen Diensten. Geschützte Antworten privat und ohne Cache ausliefern.
- Automatisierte Datenbank- und Browsertests verwenden temporäre Konten und synthetische Daten in vermietung_test. Sie benötigen keine persönliche Ersteinrichtung.
- Vor einem Meilenstein Prisma-Validierung, TypeScript, ESLint, Unit-, PostgreSQL-Integrations- und Playwright-Tests, Build und Abhängigkeitsprüfung ausführen. Ausfälle und nicht ausgeführte Prüfungen dokumentieren.
- Keine Produktivbereitstellung und keine destruktiven Betriebsaktionen ohne ausdrückliche Freigabe.
