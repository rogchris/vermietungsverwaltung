# Datenbank

PostgreSQL 17, Prisma ORM 7 und der PostgreSQL-Adapter von Prisma. `npm run db:generate` erzeugt den typisierten Client. Der Code erwartet `DATABASE_URL` erst beim Aufbau der Verbindung.

Die erste Migration legt Benutzer, Sitzungen, Zugangsdaten, Verifikation, MFA, Ratenbegrenzung und das Auditprotokoll an. Das Stammdatenmodell enthält Immobilien, Einheiten, Mieter, Verträge, Vertragspartner und zeitabhängige Mietkonditionen. Eine Immobilie kann mehrere Einheiten haben. Ein Vertrag kann mehrere Mieter haben. Die Anzahl der Einheiten ist aus der Beziehung ableitbar.

Geldfelder verwenden `NUMERIC(14,2)`. Flächen und Zimmeranzahl sind ebenfalls Dezimalfelder. Reine Kalenderdaten werden als PostgreSQL `date` gespeichert. Die Fachlogik für die Erzeugung von Forderungen legt die zeitliche Auswertung in Europe/Berlin in Phase 3 fest. Mietkonditionen sind je Vertrag und Wirksamkeitsdatum eindeutig. Fremdschlüssel schützen verknüpfte Stammdaten. Versionsfelder schützen Bearbeitung, Archivierung und Vertragsänderungen vor verlorenen Updates.

Neue Migrationen in einer Entwicklungsdatenbank mit `npx prisma migrate dev` erstellen und prüfen. Eingecheckte Migrationen mit `npm run db:deploy` anwenden. Bereits angewandte Migrationen bleiben unverändert.

## Vertragsregeln in Phase 2

Die Migration 20261109000300_lease_overlap benötigt PostgreSQLs Erweiterung btree_gist. Der Migrationsbenutzer muss diese im Zielsystem installieren dürfen oder die Erweiterung muss bereits existieren. Auf bestehenden Datenbeständen prüft PostgreSQL vorhandene Vertragszeiträume beim Anlegen des Constraints.

Vertragsbeginn und Vertragsende zählen zum Zeitraum. Ein fehlendes Ende bedeutet unbefristet. Einheiten können aufeinanderfolgende Verträge haben. Gleichzeitige Vertragszeiträume derselben Einheit sind durch einen Exclusion Constraint ausgeschlossen. Der erste Mietkonditionssatz gilt ab Vertragsbeginn. Neue Konditionen erhalten ein späteres Datum und müssen innerhalb des Vertrags liegen. Die Historie wird durch Anfügen weiterer Einträge gepflegt.

Der Fälligkeitstag wird als Kalendertag von 1 bis 31 gespeichert. Die konkrete Berechnung von Forderungsfälligkeiten folgt in Phase 3. Die Vertragsparteien, Einheit und der Beginn sind nach der Erstellung fest. Enddatum, Mietmodell, Fälligkeit und Kautionsvereinbarung sind bearbeitbar. Automatische Index- und Staffelanpassungen sind nicht angebunden.

Laufende oder zukünftige Verträge blockieren das Archivieren zugehöriger Immobilien, Einheiten und Mieter. Archivierte Datensätze bleiben mit früheren Verträgen verknüpft. Die Reaktivierung einer Einheit setzt ihren Grundstatus auf Leerstehend. Die angezeigte Vermietung berücksichtigt einen am Berliner Kalendertag laufenden Vertrag.

## Finanzen, Dokumente und Betrieb

Die Migrationen 20261109000400 bis 20261109000600 erweitern das Schema additiv. Forderungen speichern Mietbestandteile und Fälligkeit als Snapshot. Ein partieller eindeutiger Index erlaubt nur eine aktive Revision je Vertrag, Monat und Art. Zahlungszuordnungen und Audit schreiben in derselben serialisierbaren Transaktion. Weitere Regeln stehen in FINANCE.md.

Document speichert Typ, Zuordnung, Dateigröße und SHA-256. ReportJob speichert Auftrag, Eigentümer, Versuch, Verarbeitungslease und Status. RentGenerationRun hält die tägliche automatische Erzeugung persistent fest. Archivierte Kontakte können nach Freigabe anonymisiert werden, sodass bestehende fachliche Referenzen erhalten bleiben.
