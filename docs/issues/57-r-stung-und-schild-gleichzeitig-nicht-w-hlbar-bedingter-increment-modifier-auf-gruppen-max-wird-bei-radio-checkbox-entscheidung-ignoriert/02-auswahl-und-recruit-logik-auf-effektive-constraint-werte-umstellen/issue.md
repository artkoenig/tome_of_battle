Status: resolved
Type: fix
Blocked by: [01]

## Description
Kern-Slice. Stellt **alle** Auswahl-, Recruit- und Autofill-Entscheidungen, die
heute aus **rohen** Katalog-Constraint-Werten getroffen werden, auf die
**effektiven** (modifier-angepassten) Werte um — mit den Bausteinen aus Issue 01.
Damit werden Rüstung + Schild gemeinsam wählbar, und die verwandten Muster
(senkendes Max, Deaktivierung, Pflicht-Min) verhalten sich korrekt.

Leitregel (mit Nutzer abgestimmt): Eine Gruppe rendert als **Mehrfachauswahl mit
Live-Zähler**, sobald ein Modifier ihr Max über 1 heben **kann** (nicht erst wenn
das aktuelle effektive Max > 1 ist). Nur echte, fix auf 1 gedeckelte Gruppen
**ohne** solchen Modifier bleiben Radios. Alle abhängigen Anzeigen und
Klammerungen leiten sich aus demselben effektiven Wert ab.

Umzustellende Stellen (Zeilen können driften — vor der Änderung am aktuellen
Stand verifizieren):
- `src/components/editor/OptionGroup.jsx`: `minLimitOption`, `maxLimitOption`,
  `isRadio`, `isExplicitlyMulti`, `isBinary`, `isMandatory`, Zähler/Anzeige.
- `src/components/editor/SelectionConfigurator.jsx`: `minLimit`, `maxLimit`,
  `isMandatory`, `isBinary` und die Count-Klammerungen der Handler.
- `src/components/editor/AutoFillSuggestions.jsx`: Auto-Select-/Mengenlogik.
- `src/solver/optionsCollector.js`: `isOptionRosterUnique` (Roster-/Kategorie-Max).
- `src/solver/listRules.js`: `isBinaryListRule`.
- `src/solver/rosterCounter.js` und `profileCollector.js`: Min-Seite
  (Pflicht-Kinder-Anzahl / `isMandatory`).
- `src/solver/selectionFactory.js`: Min-Seite; hier den in Issue 01 vorgesehenen
  Kontext durchreichen.

`modifierEvaluator.js` selbst bleibt unverändert (rechnet korrekt). ADR-Vorgaben
(Solver-Fassade, Schichtung, Komponentengrenzen) einhalten. Vor der Umsetzung den
Bug E2E entlang des echten Nutzerpfads reproduzieren.

## Acceptance Criteria
- [ ] **Rüstung + Schild:** Am Empire-Captain lassen sich eine Rüstung (Full
      Plate / Heavy / Light) und ein Schild gleichzeitig auswählen; das
      Gruppen-Label zeigt nach Schild-Wahl das erhöhte Max (2). Gilt generisch
      für alle Gruppen mit diesem Modifier-Muster (Armour / Magic Armour u. a.).
- [ ] **Max-hebbar ⇒ Mehrfach:** Eine Gruppe, deren Max durch einen Modifier über
      1 gehoben werden kann, rendert als Mehrfachauswahl mit Zähler — auch bevor
      die Bedingung erfüllt ist (kein Teufelskreis).
- [ ] **Senkend:** Sinkt das effektive Max bedingt auf 1 (z. B. Weapons bei
      Battle Standard Bearer), wird eine zweite Auswahl verhindert.
- [ ] **Deaktivierung:** Sinkt das effektive Max bedingt auf 0, ist die Gruppe
      nicht mehr auswählbar.
- [ ] **Min-Seite:** Ein bedingt erhöhtes Min wird konsistent als Pflichtwahl
      behandelt (Recruit/Autofill/Anzeige), inkl. `selectionFactory` mit
      durchgereichtem Kontext.
- [ ] **Konsistenz:** Radio/Checkbox/Binär/Mandatory, angezeigtes „Max/Min: N",
      Count-Klammerungen, `isOptionRosterUnique`, Autofill und die Solver-Min-
      Sites beziehen ihren Wert ausschließlich aus effektiven Constraints.
- [ ] **Keine Regression:** fix-`max=1`-Gruppen ohne max-hebenden Modifier
      bleiben Radios; `increment`+`<repeat>` (mehrere gleiche Items) bleibt
      Mehrfachauswahl.
- [ ] Reproduktion-vor-Fix (E2E) dokumentiert; `npm test`, Lint, Typecheck grün;
      Screenshot der Captain-Rüstungsgruppe mit Rüstung + Schild gewählt.

## Comments
- Implementierung durch Agent fertiggestellt (Code + Tests + E2E-Screenshot), aber der Agent endete ohne Commit/Statuswechsel. Von der Hauptsitzung verifiziert und abgeschlossen: Rüstung+Schild am Captain gleichzeitig waehlbar (Screenshot .screenshots/captain-armour-shield.png: Armour 2/2, Full Plate + Shield angehakt). npm run lint, npm run typecheck und npm test (vitest + Puppeteer-E2E) gruen im Worktree.
