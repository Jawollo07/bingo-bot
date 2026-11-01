# 🎱 Bingo Bot

Der Bingo Bot öffnet einen lokalen Browser mit deinem LOTTO-Niedersachsen-Konto, liest genau vier BINGO-Spielscheine aus, erzeugt daraus eine zweiseitige A4-Querformat-PDF und kann sie an einen ausgewählten Drucker senden.

**Neu in 1.4.0:** direkter PDF-Aufruf im Dashboard, stabilerer Login-Ablauf, zusätzliche Absicherung der lokalen API, sichere Einstellungs- und PDF-Pfadbehandlung sowie erweiterte automatisierte Tests.

## Starten

### Windows-Installer
1. Öffne die [GitHub Actions](https://github.com/Jawollo07/bingo-bot/actions) und lade aus einem erfolgreichen Lauf **Windows installer** das Artefakt **Bingo-Bot-Setup** herunter.
2. Starte `Bingo-Bot-Setup.exe`.
3. Öffne Bingo Bot über das Startmenü oder die Desktop-Verknüpfung.
4. Chrome öffnet sich beim ersten Start. Melde dich bei LOTTO Niedersachsen an.
5. Die lokale Oberfläche öffnet sich unter http://127.0.0.1:4173. Klicke dort auf **Bingo jetzt erstellen**.

Der Installer enthält Node.js und alle npm-Abhängigkeiten. Google Chrome muss separat installiert sein.

### Linux
1. Lade aus einem erfolgreichen Lauf **Linux packages** das Artefakt **Bingo-Bot-Linux** herunter.
2. Auf CachyOS/Arch und anderen x64-Distributionen: Archiv entpacken und `./start-linux-installed.sh` ausführen.
3. Auf Ubuntu/Debian: `sudo apt install ./Bingo-Bot-1.4.0-amd64.deb`, anschließend **Bingo Bot** im Anwendungsmenü starten.
4. Melde dich im geöffneten Chrome/Chromium an und nutze die Oberfläche unter http://127.0.0.1:4173.

Node.js und npm sind im Paket enthalten. Chrome/Chromium, `curl`, `lpstat` und CUPS müssen vom Betriebssystem bereitgestellt werden. Die Pakete sind für x86-64.

### Aus dem Quellcode
Voraussetzungen: Node.js 20 oder neuer, npm, Chrome/Chromium und ein Drucksystem.

```sh
npm ci
npm start
```

Der Starter öffnet den Browser, prüft den lokalen Debug-Endpunkt und startet die Oberfläche. Auf Linux muss `curl` vorhanden sein. Mit `BINGO_BROWSER=/pfad/zum/browser` kannst du einen abweichenden Browserpfad festlegen.

## Oberfläche

Die Oberfläche läuft ausschließlich auf `127.0.0.1` und bietet:

- **Übersicht:** Bot starten und abbrechen, Status, letzter Lauf, Live-Protokoll und die zuletzt erzeugte PDF direkt öffnen.
- **Einstellungen:** installierte Drucker erkennen, Drucker auswählen oder den Standarddrucker verwenden.
- **Protokoll:** Laufmeldungen ansehen und kopieren.

Die Einstellungen werden lokal im Benutzerprofil gespeichert. Die Oberfläche benötigt keine Cloud, keinen Account und keinen externen Webserver. Die Anmeldung bei LOTTO erfolgt weiterhin manuell im Browser.

## Ablauf und Ausgabe

Der Bot erwartet **genau vier unterschiedliche Spielscheine** unter „Meine Spiele“. Bei fehlender Anmeldung wartet die grafische Oberfläche bis zu fünf Minuten auf die Anmeldung. Danach werden die vier Matrizen einzeln als PDF gespeichert und paarweise zu zwei A4-Querformatseiten kombiniert.

Die fertige Datei liegt im lokalen Datenordner unter `downloads/TT-MM-JJJJ/bingo-alle.pdf`. Bei einem Druckfehler bleibt die PDF erhalten und der Dateipfad wird im Protokoll ausgegeben.

## Einstellungen per Umgebungsvariable

| Variable | Zweck |
|---|---|
| `BINGO_BROWSER` | Pfad zu Chrome/Chromium |
| `BINGO_PRINTER` | Druckername; leer bedeutet Standarddrucker |
| `BINGO_CDP_ENDPOINT` | lokaler CDP-Endpunkt; nur localhost ist erlaubt |
| `BINGO_UI_PORT` | Port der Oberfläche, Standard 4173 |
| `BINGO_DATA_HOME` | Speicherort für Einstellungen und Daten |
| `BINGO_NO_OPEN=1` | Dashboard nicht automatisch im Browser öffnen |

## Tests

```sh
npm test
```

Die automatisierten Tests prüfen die PDF-Erstellung, das Seitenlayout und die lokale Dashboard-API einschließlich Host-/Origin-Schutz ohne LOTTO-Konto oder Drucker. Der Live-Ablauf hängt von der aktuellen Website, deiner Sitzung und dem Betriebssystem-Drucksystem ab.

## Sicherheit und Datenschutz

- Das Dashboard bindet ausschließlich an `127.0.0.1`; es wird nicht im LAN oder Internet veröffentlicht.
- Remote-Debugging ist ausschließlich auf localhost zulässig.
- Browserprofil und Login-Sitzung bleiben lokal. Teile den Profilordner nicht und committe ihn niemals.
- Der Bot speichert keine LOTTO-Zugangsdaten.
- Spielschein- und Matrixnavigation wird auf die offizielle LOTTO-Niedersachsen-Domain beschränkt.
- PDF-Ausgaben und Einstellungen werden lokal gespeichert. Du kannst den Datenordner jederzeit selbst sichern oder löschen.

## Entwicklung

`index.js` enthält den Browser- und PDF-Ablauf, `pdf-layout.js` erstellt das druckfertige Layout, `ui-server.js` stellt die lokale API bereit und `public/` enthält die Oberfläche. Der Bot kann weiterhin unabhängig über `npm run bot` in der Konsole gestartet werden.
