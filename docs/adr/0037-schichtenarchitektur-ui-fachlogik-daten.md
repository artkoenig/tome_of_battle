# Schichtenarchitektur UI → Fachlogik → Daten mit maschinell geprüfter Richtung

- **Status:** Accepted
- **Datum:** 2026-08-20
- **Beteiligte:** Projektinhaber, Architektur-Review
- **Zugehörige ADRs:** ergänzt ADR-0030 (Reinraum-Trennung) und ADR-0034 (Bericht als
  alleinige Quelle); wird für die Oberfläche verfeinert durch ADR-0038 (ViewModel-Muster);
  betrifft die Regeln aus ADR-0024 (Statik-Toolchain)

## Kontext und Problemstellung

Die Anwendung hat gewachsene, aber nur teilweise durchgesetzte Schichten. Maschinell geprüft
ist bislang genau eine Grenze: die um den Reinraum-Evaluator (ADR-0030), durchgesetzt mit
`severity: error` in `.dependency-cruiser.cjs` und der oxlint-Regel `no-restricted-imports`.
Alles andere ist Konvention.

Das Architektur-Review vom 2026-08-20 hat drei Folgen davon gemessen:

1. **Die Oberfläche greift direkt auf die Datenschicht durch.** 14 Import-Kanten führen von
   `src/components/`, `src/hooks/` und `src/contexts/` unmittelbar nach `src/db/` bzw.
   `src/parser/`:

   | Von | Nach |
   |---|---|
   | `contexts/SettingsContext.jsx` | `db/database` |
   | `components/Importer.jsx` | `db/catalogSourceIndex`, `db/catalogUpdate`, `db/database`, `db/systemImport`, `parser/libraryDependencies`, `parser/zipExtractor` |
   | `components/importer/revisionDisplay.js` | `db/catalogUpdate` |
   | `components/PlayMode.jsx` | `db/database` |
   | `components/RosterEditor.jsx` | `db/database` |
   | `hooks/useAppData.js` | `db/catalogUpdate`, `db/database`, `db/migrations` |
   | `hooks/useRosterList.js` | `db/database` |

   Es gibt deshalb keine Stelle, an der man Persistenz austauschen, instrumentieren oder mit
   einer Benachrichtigung versehen könnte. `Importer.jsx` hält eine eigene, von `useAppData`
   unabhängige Systemliste; wer eine davon ändert, sieht die andere veralten.

2. **Die Richtung ist an den Alt-Grenzen nicht durchgesetzt.** Die vorhandene Regel
   `schichtung-parser-kein-rueckgriff` steht auf `warn` und beschreibt nur ein Paar
   (`parser` → `components`). Für „UI greift nicht auf Daten durch" gibt es gar keine Regel.

3. **Eine halb vollzogene Migration ist unsichtbar geblieben.** Seit ADR-0034 beantwortet der
   Bericht jede Anzeigefrage. Trotzdem existieren Lesungen des Katalogs neben ihrem
   Bericht-Äquivalent weiter und werden weiter aufgerufen (siehe Issue 0158 für das
   Kostenanzeige-Paar). Ohne Regel, die einen Rückgriff verbietet, fällt so etwas erst bei
   einem Review auf — hier nach Monaten.

Gesucht ist die kleinste Festlegung, die diese drei Befunde dauerhaft ausschließt.

## Entscheidungsfaktoren (Drivers)

- **Prüfbarkeit vor Prosa.** Eine Schichtung, die nur in der Doku steht, erodiert. Das Projekt
  hat mit den Reinraum-Regeln bereits belegt, dass eine `error`-Regel hält.
- **Kein Umbau um seiner selbst willen.** Der Bestand ist groß (rund 5 800 Zeilen JSX, über
  100 Testdateien). Eine Festlegung, die einen Big-Bang erzwingt, wird nicht umgesetzt.
- **Ein Ort je Verantwortung.** Persistenz, Auswertung und Darstellung sollen je genau eine
  Adresse haben — Voraussetzung für Austausch, Benachrichtigung und Test.
- **Keine neue Abhängigkeit.** Das Projekt kommt mit sechs Laufzeitpaketen aus; eine
  Architektur, die eine Bibliothek voraussetzt, widerspricht dem Bestand.

## Betrachtete Optionen

- **Option 1 — Klassische Dreischichtung mit Pfad-Regeln.** Drei Schichten (UI, Fachlogik,
  Daten) als Verzeichnis-Präfixe, die erlaubte Richtung als `forbidden`-Regeln in
  dependency-cruiser, schrittweise von `warn` auf `error` gezogen.
- **Option 2 — Hexagonale Architektur / Ports & Adapters.** Fachlogik im Zentrum, Datenzugriff
  und Oberfläche als austauschbare Adapter hinter Ports, Abhängigkeiten zeigen nach innen.
- **Option 3 — Konvention ohne Werkzeug.** Die Schichtung nur in `docs/project-map.md` und den
  Bereichsnotizen beschreiben, Einhaltung im Review.

## Entscheidungsergebnis

Gewählte Option: **Option 1 — klassische Dreischichtung mit Pfad-Regeln.**

Die Richtung ist `UI → Fachlogik → Daten`; der Pfeil bezeichnet die **erlaubte
Abhängigkeitsrichtung**. Eine höhere Schicht darf eine tiefere importieren, ein Rückgriff von
tief nach hoch ist verboten.

| Schicht | Verzeichnisse | Verantwortung |
|---|---|---|
| UI | `src/components/`, `src/viewmodels/`, `src/contexts/`, `src/styles/`, `src/i18n/` | Darstellung und Interaktion |
| Fachlogik | `src/evaluator/`, `src/evaluation/`, `src/roster/` | Auswertung, Schreibmodell, Übersetzung zwischen beiden |
| Daten | `src/services/`, `src/db/`, `src/parser/` | Persistenz, Import, Katalog-Zerlegung |

Neu ist `src/services/` als **einzige** Adresse, über die die Oberfläche Daten erreicht. Die
14 Direktkanten aus dem Kontext werden dorthin umgelenkt.

Die Reinraum-Regeln aus ADR-0030/0034 bleiben unberührt und gelten weiter innerhalb der
Fachlogik-Schicht: `src/evaluator/` ist von `src/roster/` in beide Richtungen getrennt und von
außen nur über seine Fassade erreichbar.

Option 2 wurde verworfen, weil sie für eine Anwendung ohne Backend und ohne zweiten Adapter
Ports einführt, die nie ein zweites Mal implementiert werden — Kosten ohne Gegenwert. Option 3
wurde verworfen, weil die drei gemessenen Befunde genau unter einer Konvention ohne Werkzeug
entstanden sind.

### Durchsetzung

Neue Regeln in `.dependency-cruiser.cjs`, Testdateien wie bisher ausgenommen:

| Regel | Verbietet |
|---|---|
| `ui-nicht-auf-daten` | UI → `src/db/`, `src/parser/` (nur `src/services/` ist erlaubt) |
| `daten-kein-rueckgriff` | Daten → UI, Daten → Fachlogik |
| `fachlogik-kein-rueckgriff` | Fachlogik → UI |
| `keine-i18n-unter-ui` | Fachlogik/Daten → `src/i18n/` |

Jede Regel entsteht als `warn` und wird auf `error` gezogen, sobald die Phase, die ihre
Verstöße abbaut, gemergt ist. Eine Regel ohne offene Verstöße, die auf `warn` stehen bleibt,
ist ein Fehler — sie erlaubt den Rückfall.

### Konsequenzen (Auswirkungen)

- **Positiv:** Persistenz bekommt eine Fassade. Erst dadurch sind Änderungs-Benachrichtigung
  (IndexedDB bietet keine — nur `onversionchange`/`onclose` an der Verbindung), Instrumentierung
  und ein Austausch der Ablage überhaupt an einer Stelle machbar statt an vierzehn.
- **Positiv:** Ein Rückgriff kann nicht mehr unbemerkt entstehen. Was heute ein Review-Befund
  war, ist danach ein roter `forge-lint`.
- **Positiv:** Die doppelten Lesungen aus Befund 3 lassen sich abbauen, ohne dass ein neues Paar
  entsteht.
- **Negativ:** Eine zusätzliche Indirektion. Ein Aufruf, der heute direkt `saveRoster`
  importiert, läuft danach über `services/rosterStore.js`. Für Aufrufe, die nichts als
  durchreichen, ist das reine Zeremonie.
- **Negativ:** Die Umstellung berührt viele Dateien. Sie ist deshalb in Phasen geschnitten
  (Issues 0161–0171); jede Phase ist für sich lauffähig und grün.
- **Neutral:** Die Verzeichnisse behalten zunächst ihre Namen. Eine Umbenennung nach
  `src/ui|domain|data|shared` wäre ein Diff über rund 400 Dateien ohne Verhaltensänderung und
  steht deshalb als letzte, ausdrücklich optionale Phase am Ende.
- **Neutral:** `src/utils/` gehört in keine der drei Schichten und wird beim Abbau der
  Doppelungen aufgelöst.

## Vor- und Nachteile der Optionen

### Option 1 — Dreischichtung mit Pfad-Regeln

- **Gut, weil** sie mit dem Werkzeug durchgesetzt wird, das im Projekt bereits für die
  Reinraum-Grenze arbeitet und dort nachweislich hält.
- **Gut, weil** sie schrittweise scharf gestellt werden kann: `warn` zeigt den Bestand, `error`
  friert das Erreichte ein.
- **Gut, weil** sie die vorhandene Struktur beschreibt statt sie zu ersetzen — bis auf
  `src/services/` entsteht kein neues Verzeichnis.
- **Schlecht, weil** Pfad-Regeln nur Verzeichnisse kennen. Eine Datei am falschen Ort ist
  regelkonform und trotzdem falsch geschnitten.
- **Schlecht, weil** die Schichtung mehr Dateien für dieselbe Aufgabe bedeutet.

### Option 2 — Hexagonal / Ports & Adapters

- **Gut, weil** sie den Datenzugriff vollständig austauschbar macht und die Fachlogik ohne
  Browser testbar hält.
- **Schlecht, weil** die Anwendung genau einen Adapter je Port hätte und nie einen zweiten
  bekommt — es gibt kein Backend und keine zweite Ablage.
- **Schlecht, weil** die Fachlogik hier bereits rein ist (der Evaluator ist eine pure Funktion
  `evaluate(prepared, roster) → report`); der Hauptgewinn der Bauform ist damit schon eingelöst.

### Option 3 — Konvention ohne Werkzeug

- **Gut, weil** sie nichts kostet.
- **Schlecht, weil** die drei gemessenen Befunde belegen, dass sie hier nicht trägt: alle drei
  sind unter genau dieser Konvention entstanden und über Monate unbemerkt geblieben.
