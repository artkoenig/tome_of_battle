Status: resolved
Type: refactor
Blocked by: None

## Description

**Geruch:** Restbestand einer unvollständigen Migration — Fund 6 aus der
Vier-Achsen-Prüfung des Haupt-Issues 39 (Achse A).

Kind-Issue 39/01 hat die Traversierungs-Primitive des Roster-Baums in
`src/solver/rosterTree.js` geschaffen und die sieben duplizierten Rekursionen
darauf umgestellt. Einzelne handgeschriebene Durchläufe blieben jedoch stehen:

- `src/components/play/PlayUnitDetails.jsx` (zwei Stellen)
- `src/components/editor/SelectionConfigurator.jsx` (eine Stelle)

Sie laufen von Hand über `.selections`, wo `traverseSelectionTree` beziehungsweise
`countSelections` anwendbar wären.

**Abgrenzung zum verwandten Fund:** Anders als das dreifach wortgleiche
`containsSel` (Fund 2, behandelt in Kind-Issue 39/13) sind dies **einzelne,
nicht duplizierte** Vorkommen. Der Schaden ist entsprechend geringer: es liegt
keine DRY-Verletzung vor, sondern lediglich eine verpasste Gelegenheit, den
Sonderfall „keine Kind-Selections" ebenfalls an der einen zentralen Stelle
behandeln zu lassen. Daher eigenes Issue mit niedrigerer Dringlichkeit statt
Aufnahme in 39/13.

**Zu prüfen bei der Triage:** Ob jede der drei Stellen tatsächlich auf ein
vorhandenes Primitiv abbildbar ist, oder ob eine davon eine Form des Durchlaufs
braucht, die `rosterTree.js` heute nicht anbietet. Im zweiten Fall ist die
Frage, ob das Primitiv ergänzt wird oder die handgeschriebene Variante als
begründete Ausnahme stehen bleibt.

Bei der Umsetzung ist ADR-0023 zu beachten: der Zugriff auf `src/solver/`
erfolgt ausschließlich über die Fassade `src/solver/validator.js`, maschinell
erzwungen durch eine `no-restricted-imports`-Regel.

## Acceptance Criteria

Triage-Ergebnis: Alle drei Stellen bilden auf bereits vorhandene Primitive ab;
**kein neues Primitiv** ist nötig. Die beiden `PlayUnitDetails`-Stellen laufen
nur über die *direkten* Kinder und bilden daher auf den Zugriffs-Primitiv
`childSelectionsOf` ab (nicht auf die Tiefen-Traversierung). Die
`SelectionConfigurator`-Stelle ist eine echte Tiefen-Rekursion und bildet auf
`countSelections` ab. Alle Primitive sind über die Fassade `validator.js`
verfügbar (ADR-0023).

- [ ] `SelectionConfigurator.getSubSelectionCount`: die handgeschriebene
  `findCount`-Rekursion ist durch `countSelections(unitSelection.selections,
  { includeChildSelections: true, predicate })` ersetzt, wobei `predicate` eine
  Selection über `(entryLinkId || selectionEntryId) === optionEntryId` erkennt.
  Das gezählte Ergebnis (Summe der `number`-Werte im Teilbaum) bleibt identisch.
- [ ] `PlayUnitDetails` `independentSubUnits` (aktuell
  `(selection.selections || []).filter(...)`) bezieht die direkten Kinder über
  `childSelectionsOf(selection)`.
- [ ] `PlayUnitDetails` Modell-Zählung (aktuell `sel.selections.forEach(...)`)
  bezieht die direkten Kinder über `childSelectionsOf(sel)`; die berechneten
  Werte (`totalModels`, `hasModelChildren`) bleiben identisch.
- [ ] Alle Primitive werden aus der Fassade `validator.js` importiert; kein
  direkter Import aus `src/solver/*` außerhalb der Fassade. `npm run lint`
  (`no-restricted-imports`) bleibt grün.
- [ ] Die bestehende Test-Suite bleibt grün; das Verhalten der Sub-Selection-
  Zählung und der Modell-Zählung ist unverändert.

## Comments

Angelegt am 2026-07-21 aus der Vier-Achsen-Prüfung des Haupt-Issues 39,
Achse A (`standards-reviewer`), Fund 6.
- Triage 2026-07-21: Alle drei Stellen auf vorhandene Primitive abbildbar, kein neues Primitiv noetig. PlayUnitDetails (2x, nur direkte Kinder) -> childSelectionsOf; SelectionConfigurator (echte Rekursion) -> countSelections. Akzeptanzkriterien spezifiziert.
- Umgesetzt: SelectionConfigurator.getSubSelectionCount nutzt countSelections; PlayUnitDetails (independentSubUnits + Modell-Zaehlung) nutzt childSelectionsOf. Test-Mocks der Fassade reichen die Primitive real durch. Lint sauber, volle Suite (1128 Unit + E2E) gruen. Kein neues Primitiv noetig.
