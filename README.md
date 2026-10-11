# Bingo Bot

Erstellt aus vier BINGO-Matrizen im angemeldeten LOTTO-Niedersachsen-Konto eine zweiseitige A4-Querformat-PDF (zwei Matrizen pro Seite) und sendet sie an den Standarddrucker.

## Voraussetzungen

- Node.js 22 oder neuer und npm
- Chromium/Google Chrome mit aktiviertem Chrome DevTools Protocol (CDP)
- Eine bereits angemeldete Browser-Sitzung für LOTTO Niedersachsen
- Ein eingerichteter Standarddrucker (Linux: CUPS/LP; Windows: installierter Drucker)

## Installation

```sh
npm ci
```

Starte Chrome mit Remote-Debugging. Beispiel für Linux mit einem separaten Profil:

```sh
google-chrome --remote-debugging-port=9222 --user-data-dir="$HOME/.config/bingo-chrome"
```

Melde dich in diesem Browser manuell bei LOTTO Niedersachsen an. Die Sitzung wird nicht automatisiert angemeldet; Zugangsdaten werden nicht gespeichert.

## Ausführen

```sh
npm start
```

Die PDFs werden unter `downloads/TT-MM-JJJJ/` abgelegt. Die zusammengeführte Datei heißt `bingo-alle.pdf` und wird anschließend gedruckt.

Optionale Umgebungsvariablen:

- `BINGO_CDP_ENDPOINT`: CDP-URL; Standard `http://127.0.0.1:9222`
- `BINGO_PRINTER`: Name eines bestimmten Druckers; ohne Angabe wird der Standarddrucker verwendet

## Tests

```sh
npm test
```

Die automatisierten Tests prüfen die PDF-Zusammenführung ohne Anmeldung, Browser oder Drucker. Der vollständige Lotto-Ablauf muss lokal mit einer angemeldeten Sitzung getestet werden.

## Hinweise

- Das Skript erwartet genau vier Spielschein-Links auf „Meine Spiele“.
- Die Reihenfolge der Spielscheine wird so übernommen, wie sie auf der Website angezeigt wird.
- Der Browser muss auf dem Rechner laufen, auf dem das Skript ausgeführt wird, und CDP darf nicht ungeschützt im Netzwerk exponiert werden.
