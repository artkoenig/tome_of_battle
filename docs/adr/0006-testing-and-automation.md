# 0006: Testing and Automation

- **Status:** Accepted
- **Datum:** 2026-07-05
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** Keine

## Kontext und Problemstellung

Da *Tome of Battle* auf komplexen Regelberechnungen und XML-Parsing basiert, können kleine Code-Änderungen an einer Stelle unvorhergesehene Nebeneffekte (Regressionen) an anderer Stelle verursachen. Ein fehlerhafter Punkterechner oder eine falsche Validierung zerstört das Benutzererlebnis beim Erstellen von Armeelisten. Es wird ein solides Test-Setup benötigt.
Zusätzlich gibt es systembedingte Einschränkungen bei der Testautomatisierung: Auf macOS-Umgebungen lokaler Entwickler funktionieren bestimmte native Browser-Tools von Agenten (`browser_subagent`/`open_browser_url`) nicht, während sie in Cloud/Linux-Umgebungen uneingeschränkt nutzbar sind. Dies erfordert eine klare Unterscheidung der Test- und Debugging-Strategie je nach Laufzeitumgebung.

## Entscheidungsfaktoren (Drivers)

- **Zuverlässigkeit:** Vermeidung von Fehlern in der Berechnungs- und Validierungslogik.
- **Entwicklungsgeschwindigkeit:** Schnelles Feedback über Regressionen.
- **Portabilität:** Lauffähigkeit der Tests sowohl auf macOS (lokal) als auch in CI-Pipelines (Linux).
- **Testabdeckung:** Absicherung sowohl von Logik-Einheiten (Unit) als auch des gesamten Ablaufs (E2E).

## Entscheidungsergebnis

Die Test- und Automatisierungsstrategie des Projekts basiert auf folgenden Säulen:

### 1. Test-Frameworks und Ausführung
- **Unit & Component Tests:** Werden mit **Vitest** geschrieben und ausgeführt. Sie laufen schnell und ohne Browser-Overhead.
- **Gemeinsames E2E-Harness:** Der Aufbau, den jedes Puppeteer-Werkzeug braucht, liegt **genau einmal** in `scripts/lib/e2e-harness.js`: eingefrorene Fixture (`src/solver/__fixtures__/whfb6/*.cat|*.gst`, Upstream-Form inkl. Whitespace, siehe deren README) via JSZip verpacken, einmalig einen **Produktions-Build (`vite build`)** erzeugen, ihn über **`vite preview`** ausliefern, eine Puppeteer-Seite mit gesperrtem Katalog-Update-Abruf öffnen, IndexedDB zurücksetzen und das System über den normalen Upload-Weg importieren. Diese Zentralisierung ist die Lehre aus Issue 42: derselbe Ablauf existierte dreifach kopiert, und bei der Umstellung auf das externe Katalog-Fork-Repo (ADR 0014/0020) wurde nur eine Kopie nachgezogen — die beiden anderen liefen danach überhaupt nicht mehr. Das Harness bietet zusätzlich optional Konsolen-Mitschnitt, DOM-Ausgabe (`dumpElementHtml`) und einen sichtbaren Browser (`headed`); eine gezielte Debug-Frage wird als Wegwerf-Skript dagegen geschrieben, statt eine vorgefertigte Klickstrecke zu pflegen. Alle Pfade leitet es aus dem Modulstandort ab, das temporäre ZIP legt es im System-Temp-Verzeichnis an — es läuft also unabhängig vom Arbeitsverzeichnis und lässt bei Abbruch nichts im Repository zurück.
- **E2E-Smoke-Tests:** Der End-to-End-Test (`src/solver/ui.test.js`) nutzt dieses Harness und steuert darauf den vollen Import- und Klick-Durchlauf. Der vorab gebaute Bundle statt eines Dev-Servers ist bewusst gewählt: der Dev-Server transpiliert den Modulgraphen erst on-demand beim ersten Seitenaufruf, was auf kalten CI-Runnern unter Last die Import-Warteschwelle überschritt und den Test reproduzierbar riss (die App hing im „Verarbeite XML-Dateien…"-Ladezustand); der statische Build lädt deterministisch und liegt näher am echten Auslieferungszustand. Schlägt der Lauf dennoch fehl, hält der Test den UI-Zustand als `e2e-failure.png` fest (in CI als Artefakt hochgeladen). Die Fixture entkoppelt den Test bewusst von den zur Laufzeit bezogenen Katalogdaten (Issue 13/01), damit er deterministisch und netzunabhängig bleibt.
- **Test-Trennung:** E2E-Tests sind in `vitest.config.js` vom Standard-Testlauf ausgeschlossen und werden separat ausgeführt, um Unit-Tests nicht zu verlangsamen.
- **Worktree-Ausschluss:** Ebenfalls ausgeschlossen sind `**/.claude/**` und `**/.worktrees/**`. Beide enthalten vollständige Arbeitskopien des Repos (Agenten-Harness bzw. Projektkonvention) und liegen innerhalb des Repos. Ohne diesen Ausschluss sammelt ein Lauf im Hauptcheckout die Testdateien aller offenen Worktrees mit, wodurch jede gemeldete Testzahl während paralleler Arbeit unbrauchbar wird.
- **Test-Pflicht:** Bei jeder Änderung an der UI-Logik, Validierungslogik oder Importlogik muss ein entsprechender Test erstellt oder angepasst werden.
- **Zero-Tolerance bei Fehlern:** Alle Unit-Tests *müssen* vor dem Abschluss einer Aufgabe (Task/Feature) erfolgreich durchlaufen.
- **Statische Analyse:** Neben den Tests sichert eine mehrteilige Statik-Toolchain (oxlint, Knip, dependency-cruiser) den Code dateiübergreifend ab. Rollenverteilung, die bewusste Fassaden-Überlappung und die Gate-Strategie (warn-only → später blockierend) sind in **ADR 0024** beschrieben und hier nicht wiederholt.

### 2. Lokales vs. Cloud-Debugging & Screenshots
Aufgrund technischer Einschränkungen unterscheidet sich das Vorgehen bei manuellen UI-Checks und Reviews:
- **Lokale Ausführung (macOS):** `browser_subagent` und `open_browser_url` funktionieren hier nicht. Über das Terminal wird stattdessen `node scripts/generate_screenshots.js` ausgeführt; für eine gezielte Debug-Frage wird ein Wegwerf-Skript gegen `scripts/lib/e2e-harness.js` geschrieben.
- **Cloud-Ausführung (Linux):** Native Browser-Zugriffe über `/browser` und `browser_subagent` sind voll unterstützt und werden bevorzugt.
- **UI-Reviews:** Bei UI/UX Review-Anfragen wird das Skript `node scripts/generate_screenshots.js` ausgeführt, um Screenshots des aktuellen Interfaces zu erzeugen (Desktop und Mobil, jede Hauptansicht). Es läuft netzfrei aus der Fixture und braucht weder Katalogdaten im Repository noch einen laufenden Server. Die Bilder landen in `.screenshots/` (git-ignoriert); `SCREENSHOT_DIR` lenkt sie um. Bewusst **nicht** in das versionierte `screenshots/`, das die kuratierten README-Bilder trägt: weil die App ohne Netz den Katalog-Index nicht erreicht, zeigen die erzeugten Bilder den Offline-Hinweis — zur Verifikation korrekt, als Schaufenster des Projekts aber unerwünscht. Die README-Bilder werden nur bewusst und von Hand aus einem Lauf übernommen.
- **Showcase-Screenshots der Landing-Page:** `node scripts/generate_showcase_screenshots.js` erzeugt gezielt die drei kuratierten Telefon-Bilder der GitHub-Landing-Page (`docs/assets/screenshots/showcase_0{1,2,3}_*.png`): Online-Bibliothekar mit Spielsystem- und Fraktionsauswahl, ein Imperiums-Held beim Konfigurieren seiner Ausrüstung, und die Spielansicht mit mehreren Imperiums-Einheiten — alle auf Englisch, im Mobil-Format. Anders als `generate_screenshots.js` (Datei-Upload-Weg, WHFB6-Fixture) braucht der Showcase (a) englische UI, (b) echte Imperiums-Daten und (c) den Online-Bibliothekar, den nur die Katalog-Quelle rendert. Damit der Lauf trotzdem netzfrei und deterministisch bleibt, liefert das Skript die von der App abgerufenen Katalogdateien per Request-Interception aus einer eigenen eingefrorenen Fixture (`scripts/__fixtures__/showcase-empire/`, siehe deren README) unter der GitHub-Raw-URL der ersten Katalog-Quelle aus. Ausgabe wie oben nach `.screenshots/`; die drei Bilder werden bewusst von Hand in `screenshots/` und `docs/assets/screenshots/` übernommen.

### Konsequenzen (Auswirkungen)

- **Positiv:** 
  - Extrem hohe Absicherung gegen Regressionen in der mathematischen Kernlogik.
  - Klare, plattformübergreifende Anleitung für menschliche Entwickler und KI-Assistenten.
  - Reproduzierbare UI-Zustände durch Puppeteer-Skripte.
- **Negativ:** 
  - Puppeteer-Tests benötigen einen installierten Chromium-Browser und sind in der Ausführung langsamer als reine Unit-Tests.
