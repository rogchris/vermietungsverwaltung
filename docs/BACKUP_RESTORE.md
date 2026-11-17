# Backup und Restore

`infra/backup/backup.sh` erstellt einen konsistenten PostgreSQL-Dump und ein Archiv der privaten Dateien. Dateien veröffentlichter Datensätze sind unveränderlich. Der Dump entsteht zuerst, damit ein danach erzeugtes Dateiarchiv die bereits referenzierten Inhalte enthält. Beide Teile werden mit SHA-256 versehen und mit Restic verschlüsselt übertragen.

## Einrichten

- Restic mit Unterstützung für `--stdin-from-command` installieren. Einen eigenen externen Zielort und einen getrennt aufbewahrten Restic-Schlüssel einrichten. `RESTIC_REPOSITORY`, `RESTIC_PASSWORD_FILE` und `VERMIETUNG_PROJECT_DIR` in `/etc/vermietung/backup.env` hinterlegen. Passwortdatei und Umgebungsdatei mit Modus 0600 schützen. Bei SFTP den Hostschlüssel prüfen und im bekannten Hostspeicher hinterlegen.
- Das externe Repository nach Prüfung der Zieladresse einmalig mit `restic init` initialisieren. Den Dienst und Timer aus `infra/backup` nach `/etc/systemd/system` übernehmen, systemd neu laden und den Timer aktivieren. Er startet den Sicherungslauf viermal am Tag. Den ersten manuellen Lauf und die Sicherungskette prüfen.
- `bash infra/backup/verify.sh` prüft das Repository und listet Snapshots. Aufbewahrungsfristen und Löschung alter Snapshots nach fachlicher Freigabe festlegen. Automatisches Pruning ist nicht eingerichtet.

Das Anwendungsgeheimnis BETTER_AUTH_SECRET und der Restic-Schlüssel werden getrennt vom Repository sicher hinterlegt. Das Anwendungsgeheimnis wird für die Wiederherstellung verschlüsselter MFA-Daten benötigt.

## Wiederherstellen

1. Einen getrennten PostgreSQL-Container mit separatem Volume im Compose-Projekt `vermietung-restore` oder `vermietung-restore-NAME` starten. Eine konkrete Snapshot-ID auswählen. `VERMIETUNG_RESTORE_PROJECT=vermietung-restore bash infra/backup/restore.sh SNAPSHOT_ID vermietung_restore_NAME /absoluter/neuer/dateipfad` verwenden. Die Datenbank und das Verzeichnis müssen neu sein. Das Skript verlangt ein explizites Restore-Projekt, prüft die Archivprüfsummen und überschreibt kein bestehendes Ziel.
2. Die wiederhergestellte Datenbank und das Verzeichnis für eine isolierte Testinstanz konfigurieren. Mit `node --import tsx scripts/check-storage.ts` bei passender `DATABASE_URL` und passendem `APP_DATA_DIR` alle Dokumenthashes und fertigen PDF-Artefakte prüfen. Die wiederhergestellten Daten nur mit autorisierten Personen prüfen.
3. Healthcheck, Anmeldung, Dateiabruf, Salden und PDF-Erzeugung in der isolierten Instanz kontrollieren. Einen späteren Wechsel der laufenden App erst nach dokumentierter Abnahme und in einem Wartungsfenster durchführen.

## Lokaler Restore-Test

`node --import tsx scripts/backup-drill.ts` nutzt ausschließlich die separate lokale Testdatenbank und eine neu erzeugte Restore-Datenbank. PostgreSQL-Kommandozeilenwerkzeuge müssen im PATH liegen oder über `PG_BIN_DIR` angegeben werden. `RESTIC_DRILL_EXE` kann zusätzlich auf ein lokales Restic-Binary zeigen. Der Drill prüft Stammdaten und ein privates Dokument bytegenau. Ein erfolgreiches lokales Ergebnis ersetzt den Test mit dem tatsächlich vorgesehenen externen Sicherungsziel nicht.
