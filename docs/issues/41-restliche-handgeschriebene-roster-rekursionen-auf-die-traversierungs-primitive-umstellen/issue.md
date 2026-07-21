Status: needs-triage
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
- [ ] (noch zu spezifizieren — dieses Issue steht auf `needs-triage`)

## Comments

Angelegt am 2026-07-21 aus der Vier-Achsen-Prüfung des Haupt-Issues 39,
Achse A (`standards-reviewer`), Fund 6.
