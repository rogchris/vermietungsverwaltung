# Vermietungsverwaltung

Eine deutschsprachige Webanwendung, die Immobilien, Mietverträge, Zahlungen und zugehörige Dokumente in einem Arbeitsbereich zusammenführt.

Aus einem Mietvertrag und seinen zeitlich gültigen Konditionen entstehen monatliche Forderungen. Zahlungen und Ausgaben werden getrennt erfasst. Geschützte Dokumente und PDF-Berichte sind über dieselbe Oberfläche erreichbar.

- **Stammdaten und Verträge** · Immobilien, Einheiten, Mieterkontakte, Vertragsparteien und historisierte Mietkonditionen.
- **Finanzen** · Monatsforderungen, Teilzahlungen und Ausgaben. Fachregeln beschreibt die [Finanzdokumentation](docs/FINANCE.md).
- **Dokumente und Berichte** · Geschützte Uploads, PDF-Erzeugung im Hintergrund und Berichte mit zugeordneten Anlagen.
- **Ankauf und Bankmappe** · Erfassung und Berechnung von Ankaufsszenarien sowie Zusammenstellung einer Bankmappe. [Ankauf](docs/ACQUISITION.md) · [Bankmappe](docs/BANK_PACKAGE.md)

## Aufbau

Next.js und TypeScript bilden Oberfläche und serverseitige Aktionen. Prisma und PostgreSQL speichern Stammdaten, Finanzvorgänge und Berichtsaufträge. Ein separater Worker verarbeitet PDF-Aufträge. Dateien liegen außerhalb des öffentlich ausgelieferten Verzeichnisses. [Architektur](docs/ARCHITECTURE.md) · [Datenbank](docs/DATABASE.md)

## Lokal starten

Voraussetzungen sind Node.js aus der Datei `.node-version`, npm 11 und PostgreSQL 17. Docker Compose kann die lokale Datenbank bereitstellen.

1. `.env.example` nach `.env` kopieren. Ein eigenes Datenbankpasswort, die dazu passende `DATABASE_URL` und ein separates zufälliges `BETTER_AUTH_SECRET` mit mindestens 32 Zeichen setzen. Sonderzeichen im Passwort innerhalb der URL kodieren.
2. PostgreSQL mit `docker compose up -d --wait postgres` starten oder eine eigene lokale Instanz mit separater Datenbank verwenden.
3. `npm ci`, `npm run db:generate` und `npm run db:deploy` ausführen.
4. `npm run admin:create` ausführen und lokale Testzugangsdaten eingeben.
5. `npm run dev -- --hostname 127.0.0.1` starten. Unter [localhost:3000](http://localhost:3000) anmelden und den zweiten Faktor einrichten.
6. Für Berichtsaufträge `npm run worker` in einem zweiten Terminal starten. Die vorgesehene Chromium-Installation und die Voraussetzungen für PDF-Exporte stehen in der Test- und Betriebsdokumentation.

Der [synthetische Demo-Ablauf](docs/DEMO.md) zeigt einen Vertrag, eine Monatsforderung, eine Teilzahlung und einen PDF-Bericht.

## Prüfungen und Betrieb

`npm run lint`, `npm run typecheck` und `npm test` prüfen den Quellstand nach der Prisma-Generierung. Integrations- und Browsertests verwenden eine separate Testdatenbank und synthetische Daten. [Tests](docs/TESTING.md)

Der Zugang erfordert eine Sitzung mit eingerichtetem zweiten Faktor. Für einen Betrieb mit echten Daten sind HTTPS, sichere Zugangsdaten, der vorgesehene Upload-Scanner und geprüfte Wiederherstellung relevant. [Sicherheit](docs/SECURITY.md) · [Deployment](docs/DEPLOYMENT.md) · [Backup und Restore](docs/BACKUP_RESTORE.md)
