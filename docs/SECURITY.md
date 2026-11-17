# Sicherheit

- Das erste Administratorkonto entsteht über einen einmaligen, transaktionalen Terminalbefehl mit verdeckter Passworteingabe. Better Auth erzeugt den Passwort-Hash. Die öffentliche Registrierung ist deaktiviert und die HTTP-Schnittstelle lässt nur die verwendeten Endpunkte zu.
- Der Arbeitsbereich verlangt eine gültige Datenbanksitzung, aktivierte MFA und eine Sitzung, die nach Faktorbestätigung erstellt wurde. Bereits bestehende Passwortsitzungen erhalten bei Aktivierung des zweiten Faktors keinen Zugriff.
- Better Auth prüft die Herkunft von Authentifizierungsanfragen. Authentifizierungsantworten erhalten `Cache-Control: private, no-store`. Bei HTTPS setzt Better Auth sichere Cookies. Sitzungskopien im Cookie-Cache sind deaktiviert.
- Anmelde- und MFA-Anfragen werden in PostgreSQL begrenzt. Lokal teilen Clients einen Grenzwert. Für eine spätere Proxy-Konfiguration darf die Anwendung ausschließlich eine vom vertrauenswürdigen Proxy gesetzte Client-IP verwenden.
- Wiederherstellungscodes sind verschlüsselt gespeichert und einmalig nutzbar. Neue Codes ersetzen die bisherigen. Eine Änderung des Passworts über die Oberfläche widerruft andere Sitzungen und führt zur erneuten Anmeldung.
- Die Erstinstallation, erfolgreich erzeugte MFA-Sitzungen und Änderungen der Kontosicherheit werden im Auditprotokoll erfasst. Es speichert Ereignis und Benutzerreferenz ohne Passwörter, Tokens oder Dokumenteninhalte.
- Die Produktionskonfiguration trennt Anwendungs- und Migrationsrolle. ClamAV ist dort für Uploads vorgeschrieben. Monitoring und Backup sind in der Betriebsdokumentation beschrieben.

## Stammdatenzugriff

Vor jedem Rendern einer Stammdatenseite wird die Sitzung serverseitig geprüft. Jede Stammdatenmutation erfordert zusätzlich die Administratorrolle und prüft die Eingaben neu. Das Audit speichert bei einer Mutation nur Aktion, Akteur, Typ und Referenz. Beim späteren Einrichten von Zugriffslogs dürfen Suchparameter mit Kontaktangaben nicht mitgeschrieben werden.

## Dokumente, Berichte und Aufbewahrung

Uploads begrenzen die Anfragegröße und prüfen Dateisignatur, Dateityp, Berechtigung und Zuordnung. Dateien erhalten zufällige Speichernamen. Browserdownloads erfordern eine gültige Sitzung und unterbinden Zwischenspeicherung. PDF-Aufträge sind an ihr Konto gebunden. Der vollständige TAR-Export erfordert die Administratorrolle und enthält fachliche Daten, Dokumente, PDFs und Kontoprofile ohne Zugangsdaten. Die Zugangsdaten und Sitzungsgeheimnisse sind ausschließlich im entsprechend geschützten Betriebsbackup enthalten.

Vor einer Anonymisierung prüft der Betreiber fachliche Aufbewahrung, offene Vorgänge, Verträge und verbundene Dateien. Die App entfernt nach ausdrücklicher Bestätigung die Kontaktfelder eines archivierten Mieters. Historische Verträge und Finanzreferenzen bleiben erhalten. Dokumente, erzeugte PDFs und Backups werden gesondert nach der festgelegten Aufbewahrungsregel geprüft. Die App führt keine automatische Löschung dieser Unterlagen durch.
