# Deployment

Zielsystem ist Ubuntu 24.04 LTS mit Docker Engine und Compose. `compose.production.yaml` hält den Proxy, die Webanwendung, PostgreSQL, den Job-Worker, ClamAV und einen einmaligen Migrationsdienst getrennt. Die Entwicklungsdatei `compose.yaml` bleibt auf lokale PostgreSQL-Nutzung ausgerichtet.

## Vorbereiten

1. Einen Linux-Benutzer für SSH einrichten, Schlüsselanmeldung prüfen und Passwort- sowie Root-Anmeldung nach der Abnahme deaktivieren. SSH über VPN oder für freigegebene Quelladressen zulassen. In Hetzner-Firewall und Host-Firewall eingehend TCP 80 und 443 freigeben. UDP 443 ermöglicht HTTP/3. PostgreSQL, Scanner und App bleiben in internen Compose-Netzen.
2. Die eigene Domain mit A- und gegebenenfalls AAAA-Record auf den Host zeigen lassen. Caddy übernimmt Zertifikate und HTTPS. Bei IPv6 sowohl DNS als auch Firewall prüfen.
3. `.env.production.example` nach `.env.production` kopieren und mit Dateimodus 0600 schützen. `APP_DOMAIN` ist die nackte Domain. Für PostgreSQL-Admin, Anwendungsrolle und `BETTER_AUTH_SECRET` unabhängige Zufallswerte verwenden.
4. `DATABASE_MIGRATION_URL` auf `postgresql://postgres:ADMINPASSWORT@postgres:5432/vermietung` und `DATABASE_URL` auf `postgresql://vermietung_app:APPPASSWORT@postgres:5432/vermietung` setzen. URI-Sonderzeichen kodieren. Das Init-Skript erstellt die eingeschränkte Rolle beim ersten Start eines leeren Datenbankvolumes. Migrationen laufen mit der separaten Adminverbindung.
5. Compose mit `docker compose --env-file .env.production -f compose.production.yaml config --quiet` validieren. Im Folgenden bezeichnet `dc` diesen Compose-Aufruf.
6. Mit `dc build` Images bauen. Mit `dc up -d` starten und `dc ps -a`, `dc logs migrate` sowie den HTTPS-Healthcheck prüfen. Der Migrationsdienst muss erfolgreich beendet sein. ClamAV lädt beim Erststart Signaturen. Bis der Scanner bereit ist, werden Uploads abgelehnt.
7. Einmaliges Administratorkonto interaktiv mit `dc run --rm --no-deps migrate node --import tsx scripts/create-admin.ts` einrichten. Anschließend im Browser anmelden und MFA samt Wiederherstellungscodes einrichten. Die Abnahmetests verwenden eigene temporäre Konten.

## Betrieb und Updates

- `infra/monitor.sh` prüft PostgreSQL über die App, den Worker-Heartbeat, Jobstatus und Speicherplatz. Den Befehl unter systemd oder einem vorhandenen Monitoring ausführen und Fehler sowie einen ausbleibenden Backup-Lauf alarmieren. Die Dienste besitzen Healthchecks beziehungsweise Neustartregeln. Die JSON-Logs rotieren pro Dienst mit 10 MiB und fünf Dateien. Caddy-Zugriffslogs sind standardmäßig aus.
- Vor Updates den verschlüsselten Backup- und Restore-Ablauf prüfen. Images mit identifizierbaren Release-Tags sichern. App und Worker vor einer inkompatiblen Migration anhalten. Den Migrationsdienst mit dem neuen Image neu erstellen und erfolgreichen Exit prüfen. Danach App und Worker neu starten und Anmeldung, Healthcheck, Upload, Worker und Bericht prüfen.
- Bei einer kompatiblen Schemaerweiterung kann das frühere Image wieder gestartet werden, wenn die Abwärtskompatibilität geprüft wurde. Bei inkompatibler Änderung das Backup in ein separates Ziel zurückspielen, prüfen und die Dienste erst dann auf die wiederhergestellten Daten umstellen. Keine angewandten Migrationen bearbeiten.
- Der Worker verarbeitet höchstens einen Chromium-Bericht gleichzeitig. Er läuft ohne Root, ohne Linux-Capabilities, mit Speicher-/Prozesslimits und ohne externen Netzwerkzugang. Das Rendering sperrt Seitenrequests und JavaScript. Der Linux-Chromium-Sandboxmodus erfordert geeignete User-Namespaces und eine geprüfte Seccomp-Konfiguration. `CHROMIUM_SANDBOX=1` erst nach erfolgreicher Startprobe setzen.

Beide Compose-Dateien wurden mit Compose config geprüft. Das Caddyfile wurde mit Caddy 2.11.9 adaptiert. Die Produktionscontainer und die TLS-Zertifikatsausstellung konnten lokal ohne Docker-Engine und eigene Domain nicht gestartet werden. Vor Freigabe stehen Compose-Start, HTTPS, ClamAV-Erreichbarkeit, Browserbetrieb im Zielcontainer, Backupziel und ein Restore im Zielsetup zur Abnahme an.
