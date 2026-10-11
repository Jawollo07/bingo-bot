# 🎱 Bingo Bot

**Ziel:** Den Starter ausführen, bei Bedarf bei LOTTO Niedersachsen anmelden, fertig. Der Starter öffnet Chrome/Chromium **mit aktiviertem Remote-Debugging auf localhost**. Playwright verbindet sich anschließend mit genau diesem Browser, erstellt aus vier BINGO-Matrizen eine zweiseitige A4-Querformat-PDF und sendet sie an den Drucker.

## Windows-Installer

Ein Windows-Installer wird über GitHub Actions gebaut. Öffne die [Actions-Seite](https://github.com/Jawollo07/bingo-bot/actions), wähle den erfolgreichen Lauf **Windows installer** und lade unter **Artifacts** das Artefakt **Bingo-Bot-Setup** herunter. Darin befindet sich `Bingo-Bot-Setup.exe`. Das Artefakt wird 30 Tage aufbewahrt.

Der Installer bringt Node.js und die npm-Abhängigkeiten mit. **Google Chrome muss separat installiert sein.** Nach der Installation kannst du den Bot über das Startmenü starten; optional wird eine Desktop-Verknüpfung erstellt. Beim ersten Start öffnet sich Chrome. Melde dich bei LOTTO Niedersachsen an und bestätige anschließend im Konsolenfenster mit Enter, falls der Bot danach fragt.

Das Browserprofil der installierten Version liegt unter `%LOCALAPPDATA%\Bingo-Bot\browser-profile`, die erzeugten PDFs liegen im Installationsordner unter `downloads`. Teile das Browserprofil nicht, da es deine Anmeldung enthalten kann.

## Linux-Pakete

Ein Linux-Build wird über [GitHub Actions](https://github.com/Jawollo07/bingo-bot/actions/workflows/linux-packages.yml) erstellt. Öffne den erfolgreichen Lauf **Linux packages** und lade unter **Artifacts** das Archiv **Bingo-Bot-Linux** herunter.

- **CachyOS, Arch Linux und andere Distributionen:** `Bingo-Bot-Linux-x64.tar.gz` entpacken und `./start-linux-installed.sh` ausführen.
- **Ubuntu/Debian:** `Bingo-Bot-1.2.0-amd64.deb` herunterladen und mit `sudo apt install ./Bingo-Bot-1.2.0-amd64.deb` installieren. Danach im Anwendungsmenü nach **Bingo Bot** suchen oder `bingo-bot` starten.

Die Linux-Pakete enthalten Node.js und die npm-Abhängigkeiten. Chrome/Chromium und `curl` müssen auf dem System installiert sein. Dein Browserprofil und die erzeugten PDFs liegen in `${XDG_DATA_HOME:-~/.local/share}/bingo-bot/`, unabhängig davon, wo das Programm installiert wurde. Das Archiv ist für x86-64-PCs gebaut.

## Voraussetzungen für den manuellen Start

1. Node.js 22 LTS oder neuer.
2. Google Chrome oder Chromium installiert.
3. Ein eingerichteter Standarddrucker.

## Manuell starten

**Windows:** Doppelklick auf `start.bat`.

**Linux:** Im Projektordner `./start.sh` ausführen (falls nötig einmal `chmod +x start.sh`).

Beim manuellen ersten Start installiert der Starter die npm-Pakete, öffnet Chrome/Chromium mit `--remote-debugging-port=9222` und navigiert zu LOTTO Niedersachsen. Melde dich im Browser an und bestätige die Eingabe im Terminal. Das Browserprofil wird in `.browser-profile/` gespeichert. Bei späteren Starts wird dasselbe Profil verwendet.

Der Debug-Port ist ausdrücklich auf `127.0.0.1` beschränkt und wird nicht im Netzwerk freigegeben. **Starte den Browser möglichst immer über den Starter**: Ein bereits normal gestarteter Chrome kann das Debugging nicht nachträglich aktivieren und kann außerdem das Profil sperren.

### Linux: Browser nicht automatisch gefunden?

Du kannst den Pfad explizit angeben:

```sh
BINGO_BROWSER=/usr/bin/chromium ./start.sh
```

### Windows: Chrome an anderem Ort installiert?

Setze `BINGO_BROWSER` auf den vollständigen Pfad zu `chrome.exe`, bevor du `start.bat` ausführst, oder passe den Starter an.

## Ausgabe

Der Bot erwartet vier Spielschein-Links unter „Meine Spiele“. Er erstellt `downloads/TT-MM-JJJJ/bingo-alle.pdf` und sendet diese an den Standarddrucker. Falls Drucken nicht funktioniert, bleibt die PDF gespeichert und der vollständige Dateipfad wird angezeigt.

Optional kannst du `BINGO_PRINTER` auf den Namen eines bestimmten Druckers setzen. `BINGO_CDP_ENDPOINT` überschreibt bei Bedarf den Standard-Endpunkt `http://127.0.0.1:9222`.

## Tests

```sh
npm test
```

Die Tests prüfen die PDF-Erstellung ohne echtes LOTTO-Konto. Der vollständige Website- und Druckablauf hängt von der aktuellen Website, der Kontositzung und dem eingerichteten Drucker ab.

## Datenschutz und Sicherheit

- Der Login erfolgt manuell im lokalen Browser; der Bot speichert keine Zugangsdaten.
- Das Browserprofil enthält deine Anmeldung und sollte privat bleiben. Teile es nicht und committe es nicht.
- Remote-Debugging kann Zugriff auf die Browser-Sitzung ermöglichen. Deshalb bindet der Starter den Debug-Port nur an `127.0.0.1`.
- Der Bot druckt automatisch, sobald die PDF erfolgreich erstellt wurde. Prüfe bei Bedarf die Druckerauswahl vor dem Start.
