# Das Schreibmodell erreicht den Auswertungsbericht nur hereingereicht

- **Status:** Accepted
- **Datum:** 2026-08-21
- **Beteiligte:** Projektinhaber, Agentenlauf zu Issue 0174
- **Zugehörige ADRs:** Ergänzt ADR-0030 (Reinraum) und ADR-0037 (Schichten UI → Fachlogik → Daten); baut auf ADR-0034 (Bericht als alleinige Quelle) auf.

> **Erratum (Issue 0205, 2026-08-26).** Die Regel auf dieser Kante trug hier ihren damaligen Namen; mit dem Kontextschnitt (Issue 0186, [ADR-0042](0042-schnitt-nach-fachlichkeit-bounded-contexts-und-ports.md)) ist sie entfallen, weil Auswertungs-Brücke und Engine seither im selben Kontext liegen, und der Name ist unten deshalb durch die Kante selbst ersetzt. Gehalten wird die Kante heute von `roster-keine-evaluator-abhaengigkeit` in `.cast/rules.json` (`src/contexts/armylist/**` → `src/contexts/ruleengine/**`). dependency-cruiser ist kein Prüfer dieses Projekts mehr: [ADR-0041](0041-cast-als-strukturpruefer.md) hat ihn durch **cast** abgelöst, `.dependency-cruiser.cjs` wurde mit Commit 997d49f entfernt. Wo unten `.dependency-cruiser.cjs` oder eine dependency-cruiser-Regel steht, steht heute `.cast/rules.json` (`npm run cast`); die geprüften Kanten gelten unverändert weiter. Die Pfade unter `src/domain/` unten sind historisch: seit [ADR-0042](0042-schnitt-nach-fachlichkeit-bounded-contexts-und-ports.md) gibt es weder `src/domain/` noch `src/data/`, `src/domain/roster/` als `src/contexts/armylist/model/`, `src/domain/evaluation/` als `src/contexts/ruleengine/acl/`, `src/domain/evaluator/` liegt seitdem als `src/contexts/ruleengine/engine/`. Die hier festgehaltene Entscheidung bleibt davon unberührt.

## Kontext und Problemstellung

`src/domain/roster/rosterSerialization.js` importierte `evaluateAppRoster` aus
`src/domain/evaluation/evaluationCache.js` und wertete im `.ros`-Export selbst
aus, um `costTotals` für den Summenblock und `slots` für Namen und
Selektionskosten zu bekommen.

Die blockierende Regel `roster-keine-evaluator-abhaengigkeit` griff dort nicht:
Importziel war `src/domain/evaluation/`, nicht `src/domain/evaluator/`. Der
Buchstabe der Regel war erfüllt, die Absicht des Reinraums (ADR-0030) nicht —
das Schreibmodell erreichte den Evaluator mittelbar. Es war die einzige Kante
dieser Art im ganzen Abhängigkeitsgraphen, und sie war nirgends beschrieben.

## Entscheidungsfaktoren (Drivers)

- Der Reinraum (ADR-0030) lebt davon, dass die Trennung maschinell geprüft ist
  und nicht von der Disziplin einzelner Änderungen abhängt.
- Die Richtung UI → Fachlogik → Daten (ADR-0037): der Bericht gehört der
  Oberfläche, die ihn ohnehin lesen darf.
- Am `.ros`-Inhalt darf sich nichts ändern; der Export ist Nutzerdatenformat.
- Der einzige Aufrufer des Exports (`src/ui/viewmodels/useRosterList.js`) liegt in
  der UI-Schicht; die Kosten der Umstellung sind eine Signatur.

## Betrachtete Optionen

- **Option 1 — Bericht hereinreichen:** `exportRosterToXml(roster, system, report)`;
  der Aufrufer besorgt den Bericht, die Kante fällt, eine Regel hält sie fern.
- **Option 2 — Kante ausdrücklich erlauben:** festhalten, dass das Schreibmodell
  den Bericht **lesen** darf, solange es nichts selbst ableitet; der heutige
  Zustand bliebe richtig und wäre nur beschrieben.

## Entscheidungsergebnis

Gewählte Option: **Option 1**, weil sie die Reinraum-Grenze wieder maschinell
prüfbar macht, statt sie an eine Bedingung zu knüpfen ("liest nur"), die kein
Werkzeug nachhalten kann. Der Bericht wird hereingereicht; das Schreibmodell
bleibt rein strukturell und ruft nichts aus `src/domain/evaluation/` auf.

Festgehalten wird das durch die Struktur-Regel auf der Kante
`src/domain/roster/` → `src/domain/evaluation/` (`severity: 'error'`),
Schwester der bestehenden `roster-keine-evaluator-abhaengigkeit`. Testdateien
sind wie dort ausgenommen:
ein Fall, der eine Kostensumme braucht, ruft `evaluateAppRoster` selbst.

### Konsequenzen (Auswirkungen)

- **Positiv:** `src/domain/roster/` hat keine Kante mehr in Richtung Auswertung,
  weder mittelbar noch unmittelbar, und `forge-lint` hält das fest. Der Export
  wird testbar, ohne die Auswertungskette anzuwerfen.
- **Negativ:** Der Aufrufer trägt eine Pflicht mehr — er muss den Bericht zum
  **selben** `(system, roster)`-Paar hereinreichen. Ein falsch besorgter Bericht
  fällt erst im erzeugten XML auf.
- **Neutral:** Am erzeugten `.ros`-Inhalt ändert sich nichts; Summenblock,
  Selektionsnamen und Kosten stammen weiter aus derselben einen Auswertung
  (`evaluateAppRoster`, memoisiert in `evaluationCache.js`). Kein
  Versionssprung.

## Vor- und Nachteile der Optionen

### Option 1 — Bericht hereinreichen

- **Gut, weil** die Grenze wieder von einer Regel gehalten wird und nicht von
  einer Absichtserklärung.
- **Gut, weil** die Schichtrichtung aus ADR-0037 unverletzt bleibt: die
  Auswertung passiert dort, wo der Bericht ohnehin lebt.
- **Schlecht, weil** die Signatur einen dritten Parameter bekommt, den jeder
  Aufrufer und jeder Test korrekt befüllen muss.

### Option 2 — Kante ausdrücklich erlauben

- **Gut, weil** kein Code sich ändert und die Signatur schlank bleibt.
- **Schlecht, weil** "liest nur, leitet nichts ab" keine prüfbare Bedingung ist:
  die nächste Ableitung im Schreibmodell fällt niemandem auf.
- **Schlecht, weil** die eine erlaubte Kante die Ausnahme normalisiert, an der
  sich weitere anhängen.
