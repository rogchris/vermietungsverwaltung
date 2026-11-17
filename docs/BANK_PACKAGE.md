# Bankmappe

Im Kaufprojekt **Bankmappe öffnen** auswählen. Deckblatt, Inhaltsverzeichnis und Anlagenprüfung sind fest enthalten. Die übrigen Kapitel lassen sich abwählen. Die Finanzkapitel im Detail zeigen das Basisszenario. Der Szenarienvergleich und die Tilgungspläne berücksichtigen alle drei gespeicherten Szenarien. Unvollständige Projekte bleiben exportierbar und werden als solche gekennzeichnet.

## Herkunft und Vollständigkeit

Ordne jedem erwarteten Nachweis gezielt eine Datei aus dem Kaufprojekt oder der übernommenen Immobilie zu. Die Mappe nennt den Anlagenverweis und markiert fehlende Zuordnungen oder beim Einfrieren fehlende Dateien. **Belegt** kennzeichnet eine ausdrückliche Zuordnung durch den Nutzer. Eine inhaltliche Prüfung des Nachweises bleibt Aufgabe des Empfängers. Weitere Angaben werden als **Vom Nutzer angegeben**, **Geschätzt** oder **Berechnet** gekennzeichnet.

Bei noch nicht übernommenen Kaufobjekten können Mietpositionen je Zeile erfasst werden, etwa `EG links | vermietet | 800,25 | Angabe`. Weitere Statuswerte sind `leer` und `geplant`. Planwerte erhalten die Herkunft `Schätzung`. Bleibt die Eingabe leer, nutzt die Mappe die am Berichtsstand gültigen Nettokaltmieten der übernommenen Immobilie, sofern vorhanden. Eine fehlende gültige Mietkondition erscheint als offen. Mieternamen und Kontaktdaten werden dafür nicht benötigt. Szenarioerträge stammen aus den gespeicherten Annahmen. Die Mietaufstellung dient zur Gegenprüfung.

Der Bericht ergänzt die Bruttomietrendite um die operative Rendite auf den Gesamtkapitalbedarf und die Eigenkapitalrendite auf Basis des ersten Jahres-Cashflows nach Finanzierung. Die vorhandene Ankaufskalkulation berechnet diese Werte mit Decimal. Ohne positives Eigenkapital ist die Eigenkapitalrendite nicht berechenbar.

## Versionen, PDF und Originale

Beim Beauftragen werden die Daten und Ergebnisse in einer PostgreSQL-Transaktion gespeichert. Die fortlaufende Versionsnummer gilt je Kaufprojekt. Jeder Auftrag speichert die Version des Snapshot-Formats. PostgreSQL blockiert Änderungen am Snapshot, und die Produktionsrolle darf ihn nicht löschen. Der PDF-Worker rendert aus diesem Snapshot. Spätere Änderungen am Kaufprojekt, den Szenarien, Mietdaten und Anlagenzuordnungen wirken sich nur auf neue Versionen aus.

Die Versionen sind im Kaufprojekt für das Konto sichtbar, das sie beauftragt hat. Eine fertige Version kann heruntergeladen oder im Browser zum Drucken geöffnet werden. Originalanlagen sind separat zur eingefrorenen Version abrufbar. Beim Download und beim Zusammenführen prüft die Anwendung Größe und SHA-256 gegen den Snapshot. Der PDF-Bericht enthält das Anlagenverzeichnis. Wenn du Dateien auswählst, fügt der Worker ihre Seiten oder Bilder am Ende der PDF-Datei hinzu. Die Ausgabe übernimmt den sichtbaren Seiteninhalt. Interaktive Formulare, Anmerkungen und Signaturen sind im Original zu prüfen. Die private Ablage muss zusammen mit der Datenbank gesichert werden.

Bei einem fehlgeschlagenen Auftrag versucht der Worker die Verarbeitung entsprechend der vorhandenen Wiederholungsregeln erneut. Nach einem endgültigen Fehler kann ein neuer Auftrag als neue Version erstellt werden. Die Berichtserstellung begrenzt die Summe der Zinsbindungen auf 8.000 Tilgungsmonate pro Mappe. Für die Zusammenführung gelten zwölf Dateien, 25 MiB und 80 Anlagenseiten. Der Zusammenführungsschritt hat ein Zeitlimit von 30 Sekunden.

Die Bankmappe ist eine Planungs- und Prüfunterlage. Die Finanzierungsentscheidung liegt beim Kreditgeber.
