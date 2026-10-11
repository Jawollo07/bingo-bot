# 🎱 Bingo Bot

**Ziel:** starten, bei Bedarf einloggen, fertig. Der Bot öffnet einen eigenen Browser, speichert deine Anmeldung lokal, erstellt aus vier BINGO-Matrizen eine zweiseitige A4-Querformat-PDF und sendet sie an den Standarddrucker.

## Einmalige Einrichtung

1. Installiere [Node.js 22 LTS](https://nodejs.org/) oder neuer (mindestens Node.js 20).
2. Lade das Repository herunter und öffne den Ordner.
3. Führe im Ordner einmal aus:

   ```sh
   npm install
   npm run setup
   ```

   `npm run setup` lädt Chromium herunter. Unter Linux können abhängig von der Distribution zusätzliche Browser-Systembibliotheken nötig sein.

## Starten

Jedes weitere Mal reicht:

```sh
npm start
```

Beim ersten Start öffnet sich der Browser. Melde dich bei LOTTO Niedersachsen an und bestätige die Eingabe im Terminal. Die Anmeldung wird in `.browser-profile/` gespeichert; bei späteren Starts ist normalerweise kein erneuter Login nötig.

Der Bot erwartet vier Spielschein-Links unter „Meine Spiele“. Er erstellt `downloads/TT-MM-JJJJ/bingo-alle.pdf` und sendet diese an den Standarddrucker. Falls Drucken nicht funktioniert, bleibt die PDF gespeichert und der vollständige Dateipfad wird angezeigt.

## Optional

- `BINGO_PRINTER`: Druckername für einen bestimmten Drucker
- `BINGO_CDP_ENDPOINT`: wird nicht mehr benötigt; der Bot verwaltet seinen Browser selbst.

## Tests

```sh
npm test
```

Die Tests prüfen die PDF-Erstellung ohne echtes LOTTO-Konto. Der vollständige Website- und Druckablauf hängt von der aktuellen Website, der Kontositzung und dem eingerichteten Drucker ab.

## Datenschutz und Sicherheit

- Der Login findet manuell im lokalen Browser statt; der Bot speichert keine Zugangsdaten.
- Das Browserprofil `.browser-profile/` enthält deine Sitzung und sollte privat bleiben. Teile es nicht und committe es nicht.
- Der Bot druckt automatisch, sobald die PDF erfolgreich erstellt wurde. Prüfe bei Bedarf die Druckerauswahl vor dem Start.
