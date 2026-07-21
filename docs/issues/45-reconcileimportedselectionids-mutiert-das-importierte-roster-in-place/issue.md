Status: superseded
Type: refactor
Blocked by: None

## Description

`reconcileImportedSelectionIds` (`src/solver/rosterSync.js:25`) verändert das
übergebene Roster direkt (`src/solver/rosterSync.js:46-47`) und gibt lediglich ein
`boolean` zurück, ob etwas geändert wurde. Das verletzt Immutability und
„Seiteneffekte minimieren".

Besonders sichtbar wird der Bruch an der einzigen Produktiv-Aufrufstelle: in
`src/App.jsx:325` steht die mutierende Funktion unmittelbar über
`syncRosterSelectionsWithSystem` (`src/App.jsx:326`), die den entgegengesetzten
Vertrag erfüllt und ein **neues** Roster zurückgibt. Zwei gegensätzliche
Konventionen in zwei benachbarten Zeilen, beide auf dem Pfad
Import → `saveRoster`.

Die Kosten werden bereits bezahlt und sind im Code dokumentiert: die Testdaten in
`src/solver/__fixtures__/grimdarkSystem.js:10-12` sind ausdrücklich als Fabriken
angelegt, weil diese Funktion mutiert — sonst würde ein Test die Daten des
nächsten beschädigen (FIRST: *Independent*).

**Bekannte Fehlfunktionen gibt es nicht.** Es geht um Wartbarkeit und darum, eine
Ausnahme von der ansonsten durchgehaltenen Konvention zu beseitigen.

### ADR-Lage

ADR 0011 §2 sanktioniert die *Existenz* der Funktion als Anti-Corruption-Layer
zwischen fremden Importformaten und dem internen Modell. Zur Mutation trifft
weder ADR 0011 noch ein anderes ADR eine Aussage — sie ist nirgends als bewusste
Ausnahme dokumentiert.

### Lösungsansatz

`mapSelectionTree` ist in `src/solver/rosterSync.js:3` bereits importiert und im
Modul in Gebrauch. Die Funktion darauf umstellen, sodass sie ein neues Roster
zurückgibt statt eines `boolean`. Die Aufrufstelle in `src/App.jsx:325` muss das
Ergebnis dann übernehmen, statt den Rückgabewert als „geändert ja/nein"
auszuwerten.

Offen für die Triage: ob der Rückgabewert weiterhin signalisieren muss, dass
etwas geändert wurde (heute steuert er, ob gespeichert wird). Ein Vergleich auf
Referenzgleichheit gegen die Eingabe könnte das ersetzen — genau das ist bei
unveränderlichen Daten der übliche Weg und wäre der eigentliche Gewinn des
Umbaus.

Herkunft: Neubewertung gegen `architecture-principles` /
`code-generation-principles` vom 2026-07-21, Befund 2 von 8.

## Acceptance Criteria
- [ ] `reconcileImportedSelectionIds` verändert das übergebene Roster nicht mehr,
      sondern gibt ein neues zurück.
- [ ] `src/App.jsx` übernimmt das Ergebnis; das Speichern nach einem Import
      passiert weiterhin genau dann, wenn sich tatsächlich etwas geändert hat.
- [ ] Ein Test weist nach, dass das Eingabe-Roster nach dem Aufruf unverändert
      ist.
- [ ] Der Kommentar in `src/solver/__fixtures__/grimdarkSystem.js:10-12`, der die
      Fabrik-Bauweise mit dieser Mutation begründet, ist geprüft und angepasst
      oder entfernt.
- [ ] Import einer fremden Roster-Datei funktioniert unverändert (E2E).

## Comments
- superseded: Aufgegangen in 49-constraint-kostenart-und-import-ohne-mutation/02, das denselben Umbau spezifiziert und die offene Triage-Frage beantwortet enthaelt (der boolean-Rueckgabewert steuert nichts und entfaellt ersatzlos).
