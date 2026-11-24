# Demo · Von der Monatsforderung zum Bericht

Diese Demo verwendet eine frische lokale Datenbank und einen separaten Ordner für Dateien. Alle Daten sind künstlich. Sie ist für Screenshots oder eine kurze Bildschirmaufnahme mit dem Hinweis **Synthetische Demo** gedacht.

| Datensatz | Werte |
|---|---|
| Immobilie | Demo-Objekt A · Synthetischer Weg 1 · 00000 Testort · Hessen · Typ Sonstige · 85 m² |
| Einheit | Demo-A01 · 85 m² · Wohnen · bei Anlage frei · 0 Stellplätze |
| Vertragspartei | Test Person · dieselbe synthetische Adresse · ohne Telefonnummer oder E-Mail |
| Vertrag | Festmiete · Beginn am 1. des Demomonats · Fälligkeit am 3. · Kaution 0 € |
| Kondition | 800,00 € Grundmiete + 100,00 € Betriebskostenvorauszahlung · Heizkosten 0 € (keine separate Abrechnung) |
| Zahlung | 600,00 € für den ausgewählten Monat |
| Dokument | Lokal erzeugtes PDF mit dem Text „Demo-Beleg A01 · fiktiv“ |
| Erwartet | Forderung 900,00 € · bezahlt 600,00 € · offen 300,00 € |

1. Anwendung anhand des README lokal einrichten. Einen eigenen Demo-Admin mit MFA erstellen. Zugangsdaten und MFA-Einrichtung außerhalb der Aufnahme halten.
2. Objekt, Einheit, Vertragspartei und Vertrag anlegen. Den Monat im Vertrag und im Finanzfilter gleich wählen. Die Monatsforderung erzeugen, falls der Worker sie noch nicht angelegt hat.
3. Die Teilzahlung verbuchen. Forderung, Zahlung und Restbetrag prüfen.
4. Das synthetische PDF hochladen und einen Bericht anfordern. Worker starten und den erzeugten Bericht öffnen. Der Upload-Beleg und die erzeugte Berichtsdatei sind verschiedene Dateien.
5. Finanzübersicht und Bericht aufnehmen. Nur in der Demo erzeugte Artefakte übernehmen. Browserleiste, Dateimetadaten, Pfade, Kontokennungen und Benachrichtigungen vor Export prüfen.

**Abnahme.** Der Ablauf ist mit einer neuen Testdatenbank wiederholbar. Die drei Beträge stimmen, der Bericht ist lesbar und die Dateien enthalten keine realen Namen, Adressen, IDs, QR-Codes oder Infrastrukturdetails. Die Beispielwerte lehnen sich an die bestehende Finanz-Testhilfe an. Screenshots, Video und Demo-Durchlauf sind noch zu erstellen beziehungsweise abzunehmen.
