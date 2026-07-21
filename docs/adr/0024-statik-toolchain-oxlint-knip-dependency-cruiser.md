# Statik-Toolchain: oxlint, Knip und dependency-cruiser mit getrennten Rollen

- **Status:** Accepted
- **Datum:** 2026-07-21
- **Beteiligte:** Artjom König
- **Zugehörige ADRs (falls vorhanden):** ergänzt ADR-0006 (Testing and Automation), setzt ADR-0023 (Solver-Fassade) maschinell durch

## Kontext und Problemstellung

Die Refactoring-Bündel der letzten Iterationen (Issues 39, 42, 43, 47, 49, 50)
deckten wiederholt dieselben Fehlerklassen auf, die der bestehende Linter
**oxlint** (`npm run lint`) prinzipbedingt nicht sehen kann, weil er **pro
Datei** arbeitet:

- **Toter oder ungenutzter Code über Dateigrenzen hinweg** — etwa das in Issue 50
  gefundene `shared`, das geparst, aber nie ausgewertet wurde, sowie diverse
  Aufräum-Befunde in 39/43.
- **Verletzung der Schichtung und der Solver-Fassade** — die Schichtung
  `parser → solver → components` und der ausschließliche Zugriff auf den Solver
  über `src/solver/validator.js` sind in ADR-0023 festgeschrieben, waren aber nur
  teilweise durch die dateilokale oxlint-Regel `no-restricted-imports` bewacht.
  **Import-Zyklen** erkennt oxlint gar nicht.
- **Duplizierung** — in Issue 42 lag dasselbe E2E-Harness dreifach kopiert vor,
  zwei Kopien liefen unbemerkt kaputt.

Es fehlte ein Werkzeug, das **dateiübergreifend** analysiert. Die Frage war
nicht nur, welche Werkzeuge das leisten, sondern auch, wie sie sich zu oxlint
verhalten (ersetzen? überlappen?) und wie sie eingeführt werden, ohne die CI mit
dem angesammelten Alt-Bestand an Befunden sofort rot zu färben.

## Entscheidungsfaktoren (Drivers)

- **Abdeckung der dateiübergreifenden Fehlerklassen**, die oxlint konstruktiv
  nicht sieht (toter Code über Grenzen, Zyklen, verwaiste Module, Schichtung).
- **Klare Rollenverteilung** — jedes Werkzeug soll eine benennbare Aufgabe haben;
  Überlappung nur dort, wo sie bewusst gewollt ist.
- **Erosionsfestigkeit** — die in ADR-0023 fixierte Schichtung muss maschinell
  greifen, nicht auf Aufmerksamkeit beim Review beruhen.
- **Einführbarkeit ohne Blockade** — der vorhandene Alt-Bestand darf die
  Einführung nicht verhindern; das Gate muss schrittweise scharfgestellt werden
  können.
- **Trennung von Werkzeug und Befund** — das Einführen der Analyse darf nicht mit
  dem Aufräumen ihrer Funde vermischt werden, sonst wird die Scheibe unklar
  begrenzt und riskant groß.

## Betrachtete Optionen

- **Option 1: oxlint erweitern/ersetzen.** Versuchen, die fehlenden Prüfungen als
  zusätzliche oxlint-Regeln oder durch ein mächtigeres Einzelwerkzeug (z. B.
  ESLint mit Import-Plugins) abzudecken — ein Werkzeug für alles.
- **Option 2: Zwei spezialisierte Werkzeuge neben oxlint stellen.** **Knip** für
  toten Code/Exports/Abhängigkeiten und **dependency-cruiser** für Struktur
  (Schichtung, Fassade, Zyklen, Waisen), bei unverändertem oxlint für die
  schnellen dateilokalen Regeln.
- **Option 3: Sofort blockierend einführen.** Beide Werkzeuge direkt als
  scharfe CI-Gates, was voraussetzt, dass der gesamte Alt-Bestand vorab bereinigt
  wird.

## Entscheidungsergebnis

Gewählte Option: **Option 2 — zwei spezialisierte Werkzeuge neben oxlint**,
warn-only eingeführt.

### Rollenverteilung — warum drei Werkzeuge statt einem

Die drei Werkzeuge arbeiten auf verschiedenen Ebenen, und keines subsumiert ein
anderes:

- **oxlint** (`npm run lint`) — schnelle, **dateilokale** Regeln: Syntax,
  ungenutzte lokale Variablen, sowie die Fassaden-Import-Regel
  `no-restricted-imports`. Läuft in Sekunden und ist bereits blockierend.
- **Knip** (`npm run knip`) — **dateiübergreifender** toter Code: ungenutzte
  Dateien, Exports, Typen und `package.json`-Abhängigkeiten. Deckt genau die
  „geparst-aber-nie-genutzt"- und Aufräum-Klasse ab, die oxlint pro Datei nicht
  sehen kann. Konfiguriert über `knip.json` (Entry: `index.html`,
  `src/**/*.test.{js,jsx}`, `scripts/**`; Projekt: `src/**`, `scripts/**`;
  ignoriert `.worktrees`, `.claude`, `src/parser/schema`, `__fixtures__`).
- **dependency-cruiser** (`npm run depcruise`) — **Struktur des Importgraphen**:
  die Schichtung `parser → solver → components` als erlaubte Richtung, die
  Solver-Fassade als Regel (`solver-nur-ueber-fassade`), Import-Zyklen
  (`no-circular`) und verwaiste Module (`no-orphans`, mit Ausnahmen für Konfig-,
  Setup-, Einstiegs-, Test- und Skriptdateien). Konfiguriert über
  `.dependency-cruiser.cjs`. Ein Sammel-Script `npm run analyze` führt Knip und
  depcruise zusammen aus.

### Bewusste Überlappung an der Fassade

oxlint und dependency-cruiser überwachen **beide** die Solver-Fassade aus
ADR-0023 — oxlint über `no-restricted-imports`, dependency-cruiser über die Regel
`solver-nur-ueber-fassade`, mit denselben Ausnahmen (solver-interne Module und
Testdateien frei). Diese Doppelung ist **gewollt**: oxlint fängt den Verstoß
schnell und lokal beim Schreiben ab, dependency-cruiser prüft dieselbe Grenze im
Gesamtgraphen und deckt zusätzlich die Zyklen ab, die oxlint gar nicht sieht.
Die Fassaden-Grenze ist wichtig genug (ADR-0023), um sie an zwei Stellen
abzusichern; die Ausnahmen werden bewusst gespiegelt gehalten, damit beide
Werkzeuge nicht widersprüchlich urteilen.

### Gate-Strategie: warn-only zuerst, blockierend später

Beide Werkzeuge sind zunächst **warn-only**: In `.github/workflows/ci.yml`, Job
`lint-and-test`, laufen sie als eigene Steps **nach** dem bestehenden
Lint-Step, jeweils mit `continue-on-error: true`. Ihre Befunde sind im CI-Log
sichtbar, blockieren den Lauf aber nicht. Auch die lokalen `pre-push`-Hooks
bleiben unberührt — die prüfen den Git-Workflow, nicht Statik.

Der **geplante Übergang** ist festgehalten: Sobald der angesammelte Alt-Bestand
an Befunden in eigenen Folge-Issues bereinigt ist, wird `continue-on-error`
Werkzeug für Werkzeug entfernt und das jeweilige Gate **blockierend**. Der
warn-only-Zwischenschritt existiert nur, um die Werkzeuge einzuführen, ohne die
CI am ersten Tag mit historischem Ballast rot zu färben — nicht als Dauerzustand.

### Abgrenzung: Werkzeuge einführen ≠ Befunde beheben

Dieses Vorhaben führt **nur die Werkzeuge und ihre Konfiguration** ein. Das
**Beheben** der von Knip und dependency-cruiser gemeldeten Befunde ist
ausdrücklich **nicht** Teil davon, sondern wird als eigene Folge-Issues erfasst —
so, wie es die Issues 39/43/50 bereits vorgemacht haben. Diese Trennung hält die
Scheibe klein und überprüfbar (Verifikation = beide Werkzeuge laufen ohne
Konfigurationsfehler durch und melden nur echte, erklärbare Befunde) und
verhindert, dass sich das Aufräumen unkontrolliert in die Einführung hineinzieht.

Bewusst **nicht** Teil dieser Entscheidung: **jscpd** (Copy-Paste-Detektor) und
TypeScript-`checkJS`/JSDoc bleiben mögliche spätere, eigenständige Vorhaben.
oxlint wird **nicht** ersetzt.

### Konsequenzen (Auswirkungen)

- **Positiv:** Die dateiübergreifenden Fehlerklassen (toter Code, Zyklen,
  Schichtverstöße, Waisen), die zuvor nur zufällig bei Refactorings auffielen,
  sind jetzt maschinell und reproduzierbar sichtbar. Die Fassade aus ADR-0023
  ist an zwei unabhängigen Stellen abgesichert.
- **Positiv:** Die warn-only-Einführung entkoppelt das Scharfstellen des Gates
  vom Aufräumen — beide können unabhängig und in eigenem Tempo passieren.
- **Negativ:** Solange die Steps warn-only sind, kann ihr Signal ignoriert
  werden; ein neuer Befund fällt im grünen CI-Lauf nicht auf, bevor das Gate
  blockierend wird. Der dokumentierte Übergangsplan ist die Gegenmaßnahme.
- **Negativ:** Drei Werkzeuge sind drei Konfigurationen (`.oxlintrc.json`,
  `knip.json`, `.dependency-cruiser.cjs`) mit teils gespiegelten Ausnahmen
  (Fassade, Testdateien), die konsistent gehalten werden müssen.
- **Neutral:** Die Werkzeuge laufen in CI und lokal über npm-Scripts, greifen
  aber (noch) nicht in die `pre-push`-Hooks ein.

## Vor- und Nachteile der Optionen

### Option 1 — oxlint erweitern/ersetzen

- **Gut, weil** nur ein Werkzeug zu pflegen wäre.
- **Schlecht, weil** die fehlenden Prüfungen (dateiübergreifender toter Code,
  Import-Zyklen, ungenutzte Abhängigkeiten) außerhalb dessen liegen, was ein
  dateilokaler Linter leisten kann — ein einzelnes Werkzeug müsste all diese
  grundverschiedenen Analysen vereinen, was keines gut tut.
- **Schlecht, weil** ein Wechsel weg von oxlint dessen Geschwindigkeit opfern
  würde, ohne das eigentliche Defizit (die Graph-Analyse) sauber zu lösen.

### Option 2 — zwei spezialisierte Werkzeuge neben oxlint

- **Gut, weil** jedes Werkzeug eine benennbare, scharf abgegrenzte Rolle hat und
  in dem, was es tut, spezialisiert ist.
- **Gut, weil** die eine bewusste Überlappung (Fassade) eine wichtige Grenze
  doppelt absichert, statt zufällig zu duplizieren.
- **Schlecht, weil** mehr Konfigurationsdateien konsistent zu halten sind.

### Option 3 — sofort blockierend

- **Gut, weil** das Signal von Beginn an verbindlich wäre.
- **Schlecht, weil** es das Aufräumen des gesamten Alt-Bestands zur Vorbedingung
  der Einführung machte — eine große, riskante Scheibe, die genau die Trennung
  „Werkzeug einführen ≠ Befunde beheben" verletzt.
