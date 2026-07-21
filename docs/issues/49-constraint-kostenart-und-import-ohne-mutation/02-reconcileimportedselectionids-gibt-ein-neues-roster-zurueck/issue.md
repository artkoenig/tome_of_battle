Status: ready-for-agent
Type: fix
Blocked by: None

## Description

Übernimmt Issue 45 (dort `Type: refactor` — der Charakter der Arbeit ist
unverändert Refactoring, der Typ ist hier nur vom Haupt-Issue geerbt), mit einer
Korrektur an dessen Beschreibung: die offene Triage-Frage löst sich dadurch auf.

### Ausgangslage

`reconcileImportedSelectionIds` (`src/solver/rosterSync.js:25`) verändert das
übergebene Roster direkt (`src/solver/rosterSync.js:46-47`) und gibt lediglich
ein `boolean` zurück, ob etwas geändert wurde. Das verletzt Immutability und
„Seiteneffekte minimieren".

Besonders sichtbar wird der Bruch an der einzigen Produktiv-Aufrufstelle: in
`src/App.jsx:324` steht die mutierende Funktion unmittelbar über
`syncRosterSelectionsWithSystem` (`src/App.jsx:325`), die den entgegengesetzten
Vertrag erfüllt und ein **neues** Roster zurückgibt. Zwei gegensätzliche
Konventionen in zwei benachbarten Zeilen, beide auf dem Pfad
Import → `saveRoster`.

Die Kosten werden bereits bezahlt und sind im Code dokumentiert: die Testdaten
in `src/solver/__fixtures__/grimdarkSystem.js:8-12` sind ausdrücklich als
Fabriken angelegt, weil unter anderem diese Funktion mutiert — sonst würde ein
Test die Daten des nächsten beschädigen (FIRST: *Independent*).

**Bekannte Fehlfunktionen gibt es nicht.** Es geht um Wartbarkeit und darum,
eine Ausnahme von der ansonsten durchgehaltenen Konvention zu beseitigen.

### Korrektur an Issue 45: der Rückgabewert steuert nichts

Issue 45 hielt für die Triage offen, ob der `boolean` weiterhin signalisieren
muss, dass etwas geändert wurde — „heute steuert er, ob gespeichert wird".

**Das trifft nicht zu.** `src/App.jsx:324` wertet den Rückgabewert überhaupt
nicht aus; `saveRoster` läuft im Anschluss bedingungslos. Die einzigen
Konsumenten des `boolean` sind Tests
(`src/solver/rosterSync.test.js:85,124`,
`src/utils/rosterSerialization.integration.test.js:105`), die damit Idempotenz
belegen.

Die Triage-Frage ist damit entschieden: **der `boolean` entfällt ersatzlos.**
Die Funktion gibt ein Roster zurück. Die Idempotenz-Tests prüfen sie künftig
über Referenzgleichheit — bei unveränderlichen Daten der übliche Weg und der
eigentliche Gewinn des Umbaus. Dafür muss die Funktion bei „nichts geändert"
die **Eingabe unverändert durchreichen**, nicht eine gleichwertige Kopie.

### ADR-Lage

ADR 0011 §2 sanktioniert die *Existenz* der Funktion als Anti-Corruption-Layer
zwischen fremden Importformaten und dem internen Modell. Zur Mutation trifft
weder ADR 0011 noch ein anderes ADR eine Aussage — sie ist nirgends als bewusste
Ausnahme dokumentiert.

### Lösungsansatz

`mapSelectionTree` ist in `src/solver/rosterSync.js:3` bereits importiert und im
Modul in Gebrauch (`syncRosterSelectionsWithSystem` baut darauf auf). Die
Funktion darauf umstellen. `src/App.jsx:324` übernimmt dann das Ergebnis:

```js
newRoster = reconcileImportedSelectionIds(newRoster, system);
newRoster = syncRosterSelectionsWithSystem(newRoster, system);
```

## Acceptance Criteria
- [ ] `reconcileImportedSelectionIds` verändert das übergebene Roster nicht
      mehr, sondern gibt ein Roster zurück; der `boolean`-Rückgabewert entfällt.
- [ ] Wurde nichts geändert, ist das Ergebnis **referenzgleich** mit der
      Eingabe.
- [ ] `src/App.jsx:324` übernimmt das Ergebnis.
- [ ] Ein Test weist nach, dass das Eingabe-Roster nach dem Aufruf unverändert
      ist.
- [ ] Die drei Tests, die heute den `boolean` auswerten
      (`src/solver/rosterSync.test.js:85,124`,
      `src/utils/rosterSerialization.integration.test.js:105`), prüfen dieselbe
      Aussage über Referenzgleichheit — die Idempotenz-Aussage geht nicht
      verloren.
- [ ] Der Kommentar in `src/solver/__fixtures__/grimdarkSystem.js:8-12`, der die
      Fabrik-Bauweise unter anderem mit dieser Mutation begründet, ist geprüft
      und angepasst. **Achtung:** die Fabriken bleiben nötig — der
      `_entryCache` an den Katalogen ist der zweite, unabhängige Grund. Nur die
      Erwähnung der Roster-Mutation entfällt.
- [ ] Import einer fremden Roster-Datei funktioniert unverändert (E2E).
- [ ] `npm test` grün, `npm run lint` 0 Fehler / 0 Warnungen.

## Comments
