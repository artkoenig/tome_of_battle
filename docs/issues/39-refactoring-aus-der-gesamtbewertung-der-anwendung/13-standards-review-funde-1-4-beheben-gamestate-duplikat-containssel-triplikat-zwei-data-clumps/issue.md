Status: resolved
Type: refactor
Blocked by: None

## Description

Die Vier-Achsen-Prüfung des Haupt-Issues 39 (Achse A, `standards-reviewer`)
förderte sechs Code-Gerüche zutage. Dieses Kind-Issue behebt die ersten vier;
die Funde 5 und 6 werden bewusst nicht hier bearbeitet.

### Fund 1 — Vorgabewert des Spielstands dreifach

`{ round: 1, vp: 0, cp: 0, wounds: {} }` steht hartkodiert an drei Stellen:
`src/App.jsx:261`, `src/utils/rosterSerialization.js:343`,
`src/hooks/usePlayState.js:18`.

Das ist genau der Geruch, den dieser Zweig für das Punktelimit bereits behoben
hat — samt passendem Zuhause: `src/utils/rosterDefaults.js` existiert und wird
für `DEFAULT_ROSTER_COST_LIMIT` an allen seinen Aufrufstellen korrekt genutzt.
Diese zweite Konstante wurde schlicht übersehen.

### Fund 2 — `containsSel` dreimal wortgleich

`src/solver/profileCollector.js:24`, `src/components/editor/SelectionConfigurator.jsx:29`
und `src/components/editor/OptionGroup.jsx:10` schreiben jeweils dieselbe
rekursive Suche „enthält diese Force die Selection X?" von Hand.

Das ist der schwerwiegendste Fund, weil er das **Kernziel** des Haupt-Issues
betrifft: das ersetzende Primitiv existiert bereits und ist über die Fassade
exportiert — `someSelection(force.selections, s => s.id === id)`
(`src/solver/rosterTree.js:136`). Die Abstraktion ist gelandet, diese drei
Aufrufstellen wurden nie umgestellt.

### Fund 3 — Data Clump im Sichtbarkeits-Kontext

`isSelectionEntryHidden(entry, system, roster, selectionCounts, forceCategoryCounts, force)`
(`src/solver/entryVisibility.js:100`) und `isCategoryLinkHidden` (`:22`) nehmen
den Kontext als fünf bis sechs Positionsparameter entgegen.

Der Klumpen trägt intern bereits einen Namen (`buildEvalContext`, `:48`, nebst
einer `visibilityContext`-JSDoc-Form bei `:42`), und die Aufrufer in
`src/solver/optionsCollector.js:33` sowie `src/solver/armyWideSelectors.js:68`
zerlegen ein Kontextobjekt nur deshalb in Positionsargumente, damit die
aufgerufene Funktion es wieder zusammensetzt.

Konkrete Gefahr: `src/solver/entryVisibility.js:135` reicht `null` in den
fünften Slot — eine Positions-Eigenheit, die ein benannter Kontext explizit
machen würde.

### Fund 4 — Data Clump in den Validator-Prüffunktionen

`src/solver/rosterValidator.js:409` (10 Felder), `:504` (11), `:533`, `:680`
(12): dasselbe Tupel `{roster, system, force, counts, errors, forceCatalogueId}`
fädelt sich durch jede `check*`-Funktion. Sie erhielten ein Objekt, aber nie
einen Typ — ein `ValidationContext` will hier entstehen. Die Zerlegung in
benannte `check*`-Funktionen ist ansonsten gelungen und bleibt erhalten.

## Acceptance Criteria
- [ ] Der Vorgabewert des Spielstands ist genau einmal benannt definiert und
      wird von allen drei bisherigen Fundstellen bezogen
- [ ] Keine handgeschriebene `containsSel`-Rekursion mehr; alle drei Aufrufer
      nutzen das Primitiv aus der Fassade (ADR-0023 beachten: Zugriff auf den
      Solver ausschliesslich ueber `src/solver/validator.js`, maschinell
      erzwungen)
- [ ] Der Sichtbarkeits-Kontext wird als ein benanntes Objekt uebergeben; das
      `null` im fuenften Positions-Slot ist als benanntes Feld erkennbar
- [ ] Die `check*`-Funktionen des Validators nehmen einen benannten
      Validierungskontext entgegen statt eines untypisierten Feld-Tupels
- [ ] Kein veraendertes Verhalten — dies ist ein reines Refactoring
- [ ] `npm run lint` und `npm test` bleiben gruen

## Comments

Angelegt am 2026-07-21 aus der Vier-Achsen-Pruefung des Haupt-Issues 39.

Bewusst NICHT Teil dieses Issues sind die Funde 5 und 6 derselben Pruefung
(`App.jsx` schrumpfte trotz God-Component-Ziel nur von 600 auf 581 Zeilen;
vereinzelte handgeschriebene Rekursionen in `PlayUnitDetails.jsx` und
`SelectionConfigurator.jsx`). Sie gehoeren in eigene Issues, da Fund 5 eine
eigene Entwurfsentscheidung verlangt statt mechanischer Ersetzung.
- Funde 1-4 behoben: createInitialGameState() in rosterDefaults.js als einzige Quelle des Spielstand-Vorgabewerts; findForceContainingSelection() als neues rosterTree-Primitiv ersetzt die drei handgeschriebenen containsSel-Rekursionen (ueber die Fassade exportiert); isSelectionEntryHidden/isCategoryLinkHidden nehmen einen benannten VisibilityContext (das vormals positionale null ist jetzt forceCategoryCounts: null); die check*-Funktionen des Validators nehmen einen ValidationContext. Reines Refactoring, kein veraendertes Verhalten.
