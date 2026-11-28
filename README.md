# Vermietungsverwaltung

[English](README.en.md)

Vermietungsverwaltung ist eine deutschsprachige Webanwendung für Mietverträge, Monatsforderungen, Zahlungen und zugehörige Dokumente. Die synthetische Demo zeigt eine Forderung von 900 €, eine Teilzahlung von 600 € und den offenen Betrag von 300 € im PDF-Bericht. [Demo-Ablauf](docs/DEMO.md)

## Funktionen

- Verwaltet Immobilien, Einheiten und Mietvertragsparteien und hält frühere Mietkonditionen fest.
- Erzeugt Monatsforderungen aus den gültigen Mietkonditionen und erfasst Teilzahlungen und Ausgaben. [Finanzregeln](docs/FINANCE.md)
- Legt hochgeladene Dokumente im privaten Dateispeicher ab. Ein separater Worker verarbeitet PDF-Berichtsaufträge.
- Berechnet Ankaufsszenarien und stellt eine Bankmappe zusammen. [Ankauf](docs/ACQUISITION.md) · [Bankmappe](docs/BANK_PACKAGE.md)

Next.js und TypeScript bilden die Oberfläche und die serverseitigen Aktionen. Prisma und PostgreSQL speichern Fachdaten und Berichtsaufträge. [Architektur](docs/ARCHITECTURE.md) · [Datenbank](docs/DATABASE.md)

## Lokal starten

Benötigt werden die Node.js-Version aus `.node-version`, npm 11 und PostgreSQL 17. Docker Compose kann die lokale Datenbank starten.

1. `.env.example` nach `.env` kopieren. Ein eigenes Datenbankpasswort, die passende `DATABASE_URL` und ein separates zufälliges `BETTER_AUTH_SECRET` mit mindestens 32 Zeichen setzen. Sonderzeichen im Datenbankpasswort für die URL kodieren.
2. `docker compose up -d --wait postgres` ausführen oder eine separate lokale PostgreSQL-Datenbank verwenden.
3. `npm ci`, `npm run db:generate` und `npm run db:deploy` ausführen.
4. Mit `npm run admin:create` ein lokales Testkonto anlegen.
5. `npm run dev -- --hostname 127.0.0.1` starten. Unter [localhost:3000](http://localhost:3000) anmelden und den zweiten Faktor einrichten.
6. Für PDF-Berichte in einem zweiten Terminal `npm run worker` starten. Die Voraussetzungen für Chromium und PDF-Exporte beschreiben die Anleitungen. [Tests](docs/TESTING.md) · [Deployment](docs/DEPLOYMENT.md)

## Tests und Betrieb

Nach der Prisma-Generierung `npm run lint`, `npm run typecheck` und `npm test` ausführen. Integrations- und Browsertests verwenden eine separate Testdatenbank und synthetische Daten. [Testanleitung](docs/TESTING.md)

Für Demos synthetische Daten und Dokumente verwenden. Der Zugang erfordert eine Sitzung mit eingerichtetem zweiten Faktor. Vor dem Einsatz mit echten Mieterdaten Zugriffsschutz, HTTPS, Zugangsdaten und Upload-Prüfung prüfen und die Wiederherstellung aus einem Backup in der vorgesehenen Umgebung testen. [Sicherheit](docs/SECURITY.md) · [Deployment](docs/DEPLOYMENT.md) · [Backup und Wiederherstellung](docs/BACKUP_RESTORE.md)

Das Repository enthält keine Projektlizenz.
