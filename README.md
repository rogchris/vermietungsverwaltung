# Vermietungsverwaltung

Privater Arbeitsbereich für eine Immobilienverwaltung in deutscher Sprache. Die Anwendung verwaltet Immobilien, Einheiten, Mieterkontakte und Mietverträge mit historisierten Mietkonditionen. Der Zugang ist durch Passwort und zweiten Faktor geschützt. Mietforderungen, Zahlungen, Ausgaben, geschützte Dokumente und PDF-Berichte sind angebunden.

## Lokal starten

Voraussetzungen sind Node.js aus `.node-version`, npm 11 und PostgreSQL 17. Docker Compose kann die lokale Datenbank starten. Eine native PostgreSQL-Instanz mit eigener Datenbank und Zugangsdaten funktioniert ebenfalls.

1. `.env.example` nach `.env` kopieren. Einen zufälligen `POSTGRES_PASSWORD` und einen separaten `BETTER_AUTH_SECRET` mit mindestens 32 Zeichen eintragen. Ein geeigneter Generator ist `node -e "console.log(require('node:crypto').randomBytes(48).toString('hex'))"`.
2. `DATABASE_URL` als `postgresql://vermietung:PASSWORT@127.0.0.1:5432/vermietung` setzen. Bei Sonderzeichen im Passwort URL-Kodierung verwenden.
3. `docker compose up -d --wait postgres` ausführen oder eine bestehende lokale PostgreSQL-Instanz bereitstellen.
4. `npm ci`, `npm run db:generate` und `npm run db:deploy` ausführen.
5. `npm run admin:create` im Terminal ausführen und die eigenen Kontodaten eingeben.
6. `npm run dev -- --hostname 127.0.0.1` starten und `http://localhost:3000` öffnen. Beim ersten Login den Authenticator einrichten und die Wiederherstellungscodes sicher ablegen.

`/api/health` prüft die Datenbankverbindung und meldet HTTP 503, wenn PostgreSQL nicht erreichbar ist.

[Prüfungen](docs/TESTING.md) · [Architektur](docs/ARCHITECTURE.md)

## Stammdaten

Im Arbeitsbereich findest du **Immobilien**, **Mieter** und **Mietverträge**. Einheiten legst du in der jeweiligen Immobilie an und Verträge in der jeweiligen Einheit. Ein Vertrag kann mehrere Mieter enthalten. Über **Mietänderung erfassen** ergänzt du eine Kondition mit Wirksamkeitsdatum.

Automatisierte Prüfungen nutzen eigene Konten und synthetische Stammdaten in der separaten Testdatenbank. Dein persönliches Administratorkonto ist nur für die eigene Nutzung erforderlich.

## Finanzverwaltung und PDF-Worker

Über **Finanzen** können Monatsforderungen erzeugt und Zahlungen oder Ausgaben verbucht werden. Dokumente und Berichte sind unter **Mehr** erreichbar. Starte für die PDF-Erstellung in einem zweiten Terminal npm run worker. Der Worker verarbeitet die Warteschlange und ergänzt einmal pro Berliner Kalendertag die Forderungen des aktuellen Monats.

Private Dateien liegen lokal standardmäßig in .private-data. APP_DATA_DIR überschreibt diesen Pfad. Der optionale lokale Virenscanner wird über CLAMAV_HOST angebunden. Die Produktionskonfiguration verlangt einen erreichbaren Scanner und sichere HTTPS-Cookies.

[Finanzregeln](docs/FINANCE.md) · [Deployment](docs/DEPLOYMENT.md) · [Backup und Restore](docs/BACKUP_RESTORE.md)
