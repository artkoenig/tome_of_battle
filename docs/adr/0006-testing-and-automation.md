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
- **E2E-Smoke-Tests:** Der End-to-End-Test (`src/solver/ui.test.js`) verpackt eine eingefrorene Fixture (`src/solver/__fixtures__/whfb6/*.cat|*.gst`, Upstream-Form inkl. Whitespace, siehe deren README) zur Laufzeit via JSZip, erzeugt einmal einen **Produktions-Build (`vite build`)** und liefert ihn über **`vite preview`** aus, den er per **Puppeteer** fernsteuert (voller Import- und Klick-Durchlauf). Der vorab gebaute Bundle statt eines Dev-Servers ist bewusst gewählt: der Dev-Server transpiliert den Modulgraphen erst on-demand beim ersten Seitenaufruf, was auf kalten CI-Runnern unter Last die Import-Warteschwelle überschritt und den Test reproduzierbar riss (die App hing im „Verarbeite XML-Dateien…"-Ladezustand); der statische Build lädt deterministisch und liegt näher am echten Auslieferungszustand. Schlägt der Lauf dennoch fehl, hält der Test den UI-Zustand als `e2e-failure.png` fest (in CI als Artefakt hochgeladen). Die Fixture entkoppelt den Test bewusst von `public/catalogs/` (Issue 13/01), damit er deterministisch und netzunabhängig bleibt.
- **Test-Trennung:** E2E-Tests sind in `vitest.config.js` vom Standard-Testlauf ausgeschlossen und werden separat ausgeführt, um Unit-Tests nicht zu verlangsamen.
- **Test-Pflicht:** Bei jeder Änderung an der UI-Logik, Validierungslogik oder Importlogik muss ein entsprechender Test erstellt oder angepasst werden.
- **Zero-Tolerance bei Fehlern:** Alle Unit-Tests *müssen* vor dem Abschluss einer Aufgabe (Task/Feature) erfolgreich durchlaufen.

### 2. Lokales vs. Cloud-Debugging & Screenshots
Aufgrund technischer Einschränkungen unterscheidet sich das Vorgehen bei manuellen UI-Checks und Reviews:
- **Lokale Ausführung (macOS):** `browser_subagent` und `open_browser_url` funktionieren hier nicht. Zum interaktiven Debuggen müssen die Node.js-Skripte in `scripts/` (z. B. `node scripts/debug_ui.js` oder `node scripts/generate_screenshots.js`) über das Terminal ausgeführt werden.
- **Cloud-Ausführung (Linux):** Native Browser-Zugriffe über `/browser` und `browser_subagent` sind voll unterstützt und werden bevorzugt.
- **UI-Reviews:** Bei UI/UX Review-Anfragen wird das Skript `node scripts/generate_screenshots.js` ausgeführt, um Screenshots des aktuellen Interfaces zu erzeugen. Diese werden zur Analyse und als kreative Inspiration genutzt.

### Konsequenzen (Auswirkungen)

- **Positiv:** 
  - Extrem hohe Absicherung gegen Regressionen in der mathematischen Kernlogik.
  - Klare, plattformübergreifende Anleitung für menschliche Entwickler und KI-Assistenten.
  - Reproduzierbare UI-Zustände durch Puppeteer-Skripte.
- **Negativ:** 
  - Puppeteer-Tests benötigen einen installierten Chromium-Browser und sind in der Ausführung langsamer als reine Unit-Tests.
