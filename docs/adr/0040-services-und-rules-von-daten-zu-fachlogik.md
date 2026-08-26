# `src/data/services/` und `src/data/rules/` wechseln von Daten zu Fachlogik

- **Status:** Accepted; die Verzeichnisnamen sind durch
  [ADR-0042](0042-schnitt-nach-fachlichkeit-bounded-contexts-und-ports.md) abgelöst —
  `src/domain/services/` liegt seitdem als `src/contexts/armylist/application/` und
  `src/contexts/catalog/application/`, `src/domain/rules/` als `src/contexts/rulebook/`.
  Die Zuordnung zur Fachlogik statt zu den Daten bleibt genau die hier getroffene
- **Datum:** 2026-08-24
- **Beteiligte:** Projektinhaber, Architektur-Review
- **Zugehörige ADRs:** ergänzt ADR-0037 (Schichtenarchitektur UI → Fachlogik → Daten) um die
  Schichttabelle; folgt dem 0029→0030-Muster (der alte Befund bleibt stehen, die neue Zuordnung
  wird hier festgeschrieben)

> **Nachtrag (Issue 0205, 2026-08-26).** dependency-cruiser ist kein Prüfer dieses Projekts mehr: [ADR-0041](0041-cast-als-strukturpruefer.md) hat ihn durch **cast** abgelöst, `.dependency-cruiser.cjs` wurde mit Commit 997d49f entfernt. Wo unten `.dependency-cruiser.cjs` oder eine dependency-cruiser-Regel steht, steht heute `.cast/rules.json` (`npm run cast`); die geprüften Kanten gelten unverändert weiter.

## Kontext und Problemstellung

Issue 0179 ordnet `src` in vier Verzeichnisse — `ui`, `domain`, `data`, `tests` — deckungsgleich
mit den vier Schichten aus ADR-0037. Zwei Verzeichnisse lagen dabei am falschen Platz:

- `src/data/services/` ist laut ADR-0037 selbst **die einzige Adresse, über die die Oberfläche
  Daten erreicht** — eine Fassade, die Persistenz bündelt und Änderungen meldet, aber keine
  Persistenz selbst betreibt (die liegt in `src/data/db/` und `src/data/parser/`, die die
  Fassade durchreicht). Eine Fassade vor einer Schicht ist nicht dieselbe Schicht wie das, was
  sie verbirgt.
- `src/data/rules/` (Regeltext-Index `rules-index.json`, `synonyms.js`, `rulesLookup.js`) liest
  keine Persistenz und schreibt keine; es bildet Katalog-Regelnamen auf Dokuments-URLs ab — eine
  reine Übersetzung, wie sie ADR-0037 der Fachlogik zuschreibt (`Auswertung, Schreibmodell, Übersetzung
  zwischen beiden`).

Beide Verzeichnisse mit den Verzeichnisnamen `ui`/`domain`/`data`/`tests` benannt zu lassen hätte
bedeutet, sie unter `data/` zu belassen, obwohl ihre Verantwortung fachlich, nicht persistierend
ist. Das wäre ein Name, der die eigene Schichttabelle widerlegt.

## Entscheidungsfaktoren (Drivers)

- **Verzeichnisname folgt Verantwortung**, nicht Historie: ADR-0037 selbst nennt `src/data/services/`
  bereits eine Fassade, keine Persistenz.
- **Keine neue Regelklasse.** Die Reinraum- und Schichtregeln aus ADR-0030/0037 bleiben unverändert
  — nur die Zuordnung zweier Verzeichnisse zur bestehenden Fachlogik-Schicht ändert sich.
- **Prüfbarkeit vor Prosa**, wie in ADR-0037 selbst begründet: die dependency-cruiser-Regeln
  müssen die neuen Pfade kennen, sonst entsteht ein blinder Fleck, den keine Regel mehr erfasst.

## Betrachtete Optionen

- **Option 1 — Beide Verzeichnisse nach `src/domain/services/` bzw. `src/domain/rules/` verschieben**,
  Import-Pfade und Regeln nachziehen.
- **Option 2 — Bei `src/data/` belassen**, nur die Doku ADR-0037 unverändert lassen.
- **Option 3 — Nur `rules/` verschieben, `services/` bei `data/` belassen** (die Fassade bliebe
  begrifflich bei dem, was sie verbirgt).

## Entscheidungsergebnis

Gewählte Option: **Option 1.** Beide Verzeichnisse ziehen nach `src/domain/services/` und
`src/domain/rules/` um. Die Schichttabelle aus ADR-0037 wird wie folgt ergänzt:

| Schicht | Verzeichnisse | Verantwortung |
|---|---|---|
| Fachlogik | `src/domain/evaluator/`, `src/domain/evaluation/`, `src/domain/roster/`, `src/domain/services/`, `src/domain/rules/` | Auswertung, Schreibmodell, Übersetzung zwischen beiden, die Datenfassade und der Regeltext-Index |
| Daten | `src/data/db/`, `src/data/parser/` | Persistenz, Import, Katalog-Zerlegung |

Die Fassaden-Regel aus ADR-0037 gilt unverändert: die Oberfläche erreicht Daten nur über
`src/domain/services/`; ein direkter Griff nach `src/data/db/` oder `src/data/parser/` bleibt
verboten (`ui-nicht-auf-daten`). Nur der Verzeichnisname der Fassade selbst ändert sich, nicht ihre
Regel.

Option 2 wurde verworfen, weil sie genau den Widerspruch stehen ließe, der diesen ADR ausgelöst
hat. Option 3 wurde verworfen, weil sie die Fassade an ihrer alten Adresse beließe, obwohl
ADR-0037 sie bereits als das der Fachlogik zugehörige Bindeglied beschreibt — ein halber Umzug
hätte dieselbe Inkonsistenz nur verkleinert, nicht behoben.

### Durchsetzung

- `.dependency-cruiser.cjs`: `SERVICES_LAYER` zeigt auf `^src/domain/services/`; die
  Fachlogik-Schicht (`DOMAIN_LAYER`) schließt `src/domain/rules/` und `src/domain/services/` ein.
- `.claude/rules/areas/services.md` trägt `paths: ["src/domain/services/**"]`.
- `scripts/generate-rules-index.js` schreibt `rules-index.json` nach `src/domain/rules/`.

### Konsequenzen (Auswirkungen)

- **Positiv:** Die Schichttabelle widerspricht sich nicht mehr selbst.
- **Positiv:** `src/data/` enthält danach nur noch, was tatsächlich persistiert oder importiert
  (`db/`, `parser/`) — ein schärferer Schnitt für neue Beiträge.
- **Neutral:** Reiner Verzeichnis- und Import-Pfad-Umzug ohne Verhaltensänderung, wie schon die
  Umbenennung aus ADR-0037s Nachtrag zu `src/ui|domain|data|shared`.

## Vor- und Nachteile der Optionen

### Option 1 — Beide Verzeichnisse nach `domain/` verschieben

- **Gut, weil** die Schichttabelle danach die tatsächliche Verantwortung trägt statt der
  historischen Adresse.
- **Schlecht, weil** sie Import-Pfade in Dutzenden Dateien anfasst — reine Zeremonie ohne
  Verhaltensänderung.

### Option 2 — Unverändert lassen

- **Gut, weil** sie nichts kostet.
- **Schlecht, weil** der Widerspruch zwischen Doku und Verzeichnisname bestehen bliebe.

### Option 3 — Nur `rules/` verschieben

- **Gut, weil** kleinerer Diff.
- **Schlecht, weil** die Fassade — laut ADR-0037 selbst das zentrale Bindeglied der Fachlogik —
  an ihrer alten, jetzt falsch benannten Adresse bliebe.
