# Schnitt nach Fachlichkeit: Bounded Contexts, Shared Kernels und zwei Ports

- **Status:** Accepted
- **Datum:** 2026-08-25
- **Beteiligte:** Issue 0186
- **Zugehörige ADRs:** Präzisiert [ADR 0037](0037-schichtenarchitektur-ui-fachlogik-daten.md);
  löst die Verzeichnisnamen aus [ADR 0040](0040-services-und-rules-von-daten-zu-fachlogik.md)
  ab; die Prüfung läuft weiter über [ADR 0041](0041-cast-als-strukturpruefer.md)

> **Erratum (Issue 0205, 2026-08-26).** Der erste Positiv-Punkt unter „Konsequenzen“ nannte ursprünglich „23 Regeln“ und glossierte `kontext-kein-fremder-kontext` als „kein Kontext importiert einen anderen“. Beides war schon am Tag der Niederschrift ungenau: eine Zahl in Prosa veraltet mit jeder neuen Regel, und die Regel hat mit `lesemodell-die-eine-tuer` eine gesetzte Ausnahme. Der Punkt ist entsprechend korrigiert; die Entscheidung selbst ist unberührt.

## Kontext und Problemstellung

`src/` war nach Technik geschnitten: `ui/`, `domain/`, `data/`. Die Richtung stimmte —
`cast report` fand 0 Zyklen und 0 Regelverstöße —, der Schnitt aber nicht.
`src/domain/` war eine Schublade für fünf verschiedene Fachlichkeiten (Schreibmodell,
Auswertung, Katalogbibliothek, Regeltexte, Datenfassade), und
`src/domain/services/` importierte Dexie und JSZip direkt: die Fachlogik hing an der
Infrastruktur statt umgekehrt. Wer eine fachliche Frage stellte ("was gehört zur
Armeeliste?"), fand die Antwort auf drei Verzeichnisse verteilt; wer eine technische
stellte, fand sie an einer Stelle. Das ist die falsche Optimierung für ein Projekt, dessen
Änderungen fachlich motiviert sind.

## Entscheidungsfaktoren (Drivers)

- Fachliche Kohäsion: eine Änderung an der Armeeliste soll ein Verzeichnis betreffen.
- Umkehrbare Abhängigkeit zur Infrastruktur: IndexedDB und JSZip dürfen nicht in die
  Fachlogik hineinragen.
- Maschinelle Prüfbarkeit: ein Schnitt, den nur ein Diagramm behauptet, zerfällt.
- Kein Verhaltensrisiko: reine Verschiebung, keine neue Logik.

## Betrachtete Optionen

- **Option 1:** Alles lassen wie es ist, `domain/` weiter nach Unterordnern gliedern.
- **Option 2:** Schnitt nach Fachlichkeit in Bounded Contexts, mit Shared Kernels für das
  gemeinsame Vokabular und einer Plattformschicht hinter Ports.
- **Option 3:** Contexts einführen, aber die Infrastruktur weiter direkt importieren
  (keine Ports).

## Entscheidungsergebnis

Gewählte Option: **Option 2**, weil sie die fachliche Frage und die Verzeichnisstruktur zur
Deckung bringt und weil jede ihrer Grenzen als cast-Regel formulierbar ist — im Gegensatz zu
Option 3, die die Umkehrung der Abhängigkeit gerade nicht leistet.

Der Zielbaum:

| Verzeichnis | Inhalt |
|---|---|
| `src/contexts/armylist/` | `model/` (Schreibmodell), `application/` (Datenfassade), `ports/storagePort.js` |
| `src/contexts/ruleengine/` | `evaluator.js` (Fassade), `engine/` (Reinraum), `acl/` (Übersetzung), `readmodel/` (Anzeige-Ableitungen hinter `index.js`) |
| `src/contexts/catalog/` | `application/` (Systembibliothek, Katalogrevisionen), `ports/catalogRepository.js` |
| `src/contexts/rulebook/` | Regeltext-Index und Synonyme |
| `src/contexts/play/` | Fortschreibung durch Issue 0190: `model/game.js` (Aggregat `Game`), `application/gameStore.js`, `ports/storagePort.js`, Fassade `index.js`. Die laufende Partie verweist ueber `rosterId` auf die Liste und lebt in ihrem eigenen Object Store `games` (PRD `docs/PRD-play-mode-eigener-kontext.md`). |
| `src/platform/` | `persistence/` (IndexedDB, Migrationen, Katalog-Fork), `battlescribe/` (XML, ZIP, XSD) |
| `src/shared/` | `rostermodel/types.js`, `battlescribe/battlescribeSchema.generated.js`, `events/dataEvents.js` |

Drei Festlegungen, die aus der Simulation stammen und keine Geschmacksfragen sind:

- `types.js` ist unser eigenes Listenvokabular und liegt deshalb in
  `shared/rostermodel/`, nicht in `shared/battlescribe/`. Die ACL existiert, um zwischen
  beiden zu übersetzen.
- `dataEvents.js` liegt in `shared/events/`. In `armylist` erzeugte es sofort die Kante
  `contexts/catalog -> contexts/armylist`.
- Genau zwei Module unter `src/contexts/` dürfen `src/platform/` nennen:
  `armylist/ports/storagePort.js` und `catalog/ports/catalogRepository.js`. Sie enthalten
  keine Logik, nur Weiterleitungen.

### Konsequenzen (Auswirkungen)

- **Positiv:** Fachliche Fragen haben eine Adresse. Die Infrastruktur ist austauschbar,
  ohne einen Kontext anzufassen. `shared/` hat Fan-out 0, `domain/` und `data/` existieren
  nicht mehr.
- **Positiv:** Der Schnitt ist ein Gate, kein Diagramm: die verbotenen und die erlaubten
  Kanten stehen vollständig in `.cast/rules.json` — dort, nicht hier, ist ihre Zahl
  nachzulesen. Darunter `kontext-kein-fremder-kontext` (kein Kontext importiert einen
  anderen; die eine gesetzte Ausnahme ist die Tür des Lesemodells —
  `lesemodell-die-eine-tuer` erlaubt `src/contexts/armylist/application/mandatoryListRules.js`
  den Zugriff auf die Fassade des Lesemodells, sonst niemandem außerhalb von
  `src/ui/viewmodels/` und `src/tests/`),
  `kontext-nicht-auf-plattform` (nur die Ports), `shared-haengt-an-nichts`,
  `evaluator-nur-ueber-fassade`, `lesemodell-nur-ueber-fassade` und
  `nur-die-acl-ruft-die-engine`.
- **Negativ:** Jeder Importpfad im Baum hat sich geändert; ältere ADRs und Issues nennen
  weiterhin `src/domain/` und `src/data/`. Sie bleiben als Historie stehen — dieser ADR ist
  die gültige Karte der Verzeichnisse.
- **Neutral:** Das Modell selbst ändert sich nicht. Das Aggregat bleibt anämisch, die
  Schreibkommandos bleiben im ViewModel; das sind die Issues 0188 bis 0192.

## Vor- und Nachteile der Optionen

### Option 1 (Technik-Schnitt beibehalten)

- **Gut, weil** keine Bewegung, kein Risiko, alle Pfade bleiben.
- **Schlecht, weil** `domain/` weiter fünf Fachlichkeiten sammelt und die Fachlogik an
  Dexie und JSZip hängt.

### Option 2 (Contexts, Shared Kernels, Ports)

- **Gut, weil** fachliche Kohäsion, umgekehrte Infrastruktur-Abhängigkeit und ein
  prüfbarer Schnitt zusammen entstehen.
- **Schlecht, weil** ein großer, mechanischer Diff mit geänderten Importpfaden im ganzen
  Baum entsteht.

### Option 3 (Contexts ohne Ports)

- **Gut, weil** kleinerer Diff, keine zusätzlichen Module.
- **Schlecht, weil** die eigentliche Fehlrichtung — Fachlogik hängt an Infrastruktur —
  bestehen bliebe und sich nicht als Regel formulieren ließe.
