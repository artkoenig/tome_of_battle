# Custom Hook als ViewModel je UI-Baustein, gespeist aus dem Auswertungsbericht

- **Status:** Accepted
- **Datum:** 2026-08-20
- **Beteiligte:** Projektinhaber, Architektur-Review
- **Zugehörige ADRs:** verfeinert ADR-0037 (Schichtenarchitektur) für die UI-Schicht; setzt
  ADR-0034 (Bericht als alleinige Quelle) voraus; erweitert die Kontext-Begründung aus
  ADR-0015 (Settings-Context)

## Kontext und Problemstellung

Die Oberfläche hat heute **einen** Zustandsknoten und darunter Durchreichung.

`useRoster` gibt 21 Felder zurück und mischt drei Verantwortungen: Durchreichung des Berichts
(`violations`, `capabilities`, `description`, `costTotals`, `pathBySelectionId`,
`pathByForceId`, `unresolvedSelections`), Kommandos (`raiseUnit`, `removeUnit`, `copyUnit`,
`subSelectionOperations`, `updateRosterName`, `save`, `undo`, `redo`) und Auswahl-Zustand der
Oberfläche (`selectedRosterSelection`). Einziger Aufrufer ist `RosterEditor.jsx`.

Von dort wandern die Bericht-Felder durch den Komponentenbaum: `capabilities` erscheint in 14
Dateien, `pathBySelectionId` in 11, `violations` in 7, `costTotals` in 4. Die Folge sind
Signaturen, die kein Mensch mehr überblickt:

```
22 Props  editor/OptionGroup.jsx
20 Props  editor/ForceEditorSection.jsx
18 Props  editor/RosterCategorySection.jsx
15 Props  editor/UnitSelectionCard.jsx, play/PlayUnitDetails.jsx, editor/ListRuleChecklist.jsx
13 Props  editor/SelectionConfigurator.jsx, editor/RosterEditorTopBar.jsx
```

`RosterEditor.jsx` bündelt deshalb bereits von Hand ein Objekt `unitCardContext` und reicht es
unverändert bis zur Karte durch — ein ViewModel ohne Namen und ohne Test.

Zweiter Befund: Ableitungen passieren im Render. `CategoryUnitAdder` baut das Aushebe-Angebot
in der Map-Schleife auf; `RosterDashboard.jsx:170` ruft `evaluateAppRoster` **pro Zeile**
innerhalb von `.map`. Beides ist weder für sich testbar noch memoisierbar.

Dritter Befund: sechs ViewModel-artige Module existieren bereits, aber als lose Funktionen ohne
gemeinsames Muster — `editor/unitCardValidation.js`, `editor/costBudgets.js`,
`editor/optionNesting.js`, `importer/importMessages.js`, `importer/revisionDisplay.js`,
`profileCellClasses.js`.

## Entscheidungsfaktoren (Drivers)

- **Ableitung getrennt von Darstellung.** Was angezeigt wird, soll ohne DOM prüfbar sein.
- **Ende der Durchreichung.** Ein Prop-Satz von 22 ist kein Vertrag mehr, sondern ein Transport.
- **Eine Quelle bleibt eine Quelle.** ADR-0034 gilt unverändert: jede Anzeigefrage beantwortet
  der Bericht, nie ein zweiter Katalog-Durchlauf.
- **Keine Bibliothek.** Das Projekt trägt sechs Laufzeitpakete; eine State-Bibliothek wäre die
  siebte und die erste, die Architektur vorschreibt.
- **Kein Render-Rückschritt.** Ein neues Muster darf nicht öfter rendern als der Bestand.

## Betrachtete Optionen

- **Option 1 — Custom Hook als ViewModel je UI-Baustein**, gespeist aus zwei Kontexten
  (Bericht/Roster und Kommandos), Komponenten enthalten nur noch JSX.
- **Option 2 — Reine Selektor-Funktionen** `select(report, args) → viewModel`, von den
  Komponenten selbst aufgerufen und mit `useMemo` memoisiert; kein Kontext, Bericht weiter als
  Prop.
- **Option 3 — Externe Zustandsbibliothek** (Zustand, Jotai, Redux Toolkit) mit Selektoren und
  feingranularer Subscription.

## Entscheidungsergebnis

Gewählte Option: **Option 1 — Custom Hook als ViewModel je UI-Baustein.**

### Das Muster

```
src/ui/viewmodels/editor/useUnitCard.js         Hook. Liest den Bericht, gibt fertige Anzeigewerte.
src/ui/components/editor/UnitSelectionCard.jsx  Nur JSX. Props sind die Felder des ViewModels.
```

`src/ui/viewmodels/` spiegelt den Komponentenbaum. Es gehört zur UI-Schicht aus ADR-0037 und liegt
dort über `src/ui/components/`: ein ViewModel darf eine Komponente nie importieren.

### Zwei Kontexte, getrennt nach Änderungsfrequenz

| Kontext | Inhalt | Identität |
|---|---|---|
| `RosterCommandsContext` | `raiseUnit`, `removeUnit`, `copyUnit`, `subSelectionOperations`, `undo`, `redo` | stabil, ändert sich nie |
| `RosterReportContext` | `{ report, roster }` | ändert sich je Bearbeitung |

Die Trennung ist der Grund, warum ein Kontext hier vertretbar ist: Verbraucher, die nur ein
Kommando auslösen (Knöpfe, Menüs), hängen am stabilen Kontext und rendern bei einer
Roster-Änderung nicht neu.

Ein Render-Rückschritt entsteht nicht: der Bericht ist über die WeakMap in
`src/domain/evaluation/evaluationCache.js` bereits identitätsstabil je `(system, roster)`, und der
Roster-Zustand liegt heute ohnehin im `RosterEditor` — jede Bearbeitung rendert den Teilbaum
also schon jetzt vollständig neu.

### Regeln, die das Muster halten

In `.dependency-cruiser.cjs`:

| Regel | Verbietet |
|---|---|
| `viewmodel-keine-komponente` | `src/ui/viewmodels/` → `src/ui/components/` |
| `komponente-kein-bericht` | `src/ui/components/` → `src/domain/evaluation/`, `src/domain/evaluator/` |
| `viewmodel-keine-datenschicht` | `src/ui/viewmodels/` → `src/data/db/`, `src/data/parser/` (nur `src/data/services/`) |

In `.oxlintrc.json`, für `src/ui/components/**`: **`useEffect` und `useMemo` sind verboten.** Jeder
Effekt und jede Ableitung gehört ins ViewModel. `useState`, `useRef` und `useCallback` bleiben
erlaubt — ein aufgeklapptes Sheet, ein Fokus-Ref und ein stabiler Handler sind
Darstellungszustand, kein Modell.

Diese vier Regeln sind der eigentliche Beschluss. Ohne sie ist das Muster eine Empfehlung, und
Empfehlungen haben die 22-Prop-Signatur nicht verhindert.

### Konsequenzen (Auswirkungen)

- **Positiv:** Jede Ableitung wird ohne DOM testbar (`renderHook`), jede Komponente wird
  trivial testbar (Props rein, Markup raus).
- **Positiv:** Die Durchreichung endet. `capabilities` und `pathBySelectionId` verschwinden als
  Props aus 14 bzw. 11 Dateien.
- **Positiv:** Die sechs losen Helfermodule bekommen einen Ort und einen Namen; `unitCardContext`
  als handgebautes Bündel entfällt.
- **Positiv:** `evaluateAppRoster` in der Map-Schleife von `RosterDashboard` wird zu einem
  memoisierten Bericht je Roster.
- **Negativ:** Mehr Dateien — je UI-Baustein zwei statt einer, plus zwei Testdateien.
- **Negativ:** Die über 100 Testdateien, die heute `capabilities`-Maps von Hand aufbauen, müssen
  diese Fixtures in die ViewModel-Tests verschieben. Mechanisch, aber der größte Einzelposten
  des Umbaus.
- **Negativ:** Zwei Kontexte sind zwei Provider mehr im Baum und eine Fehlerquelle mehr in
  Tests, die eine Komponente isoliert rendern. Ein Test-Wrapper in `src/tests/test-utils/` fängt das
  ab.
- **Neutral:** Jede Roster-Bearbeitung erzeugt einen neuen Bericht, also rechnen alle ViewModels
  neu — genauso wie heute. Slot-genaue Identitätsstabilität müsste der Evaluator liefern; das
  ist ein eigenes Thema und ausdrücklich nicht Teil dieser Entscheidung.
- **Neutral:** Die ViewModels sind die Stelle, an der die Oberfläche künftig `src/data/services/`
  anspricht. Die 14 Direktkanten aus ADR-0037 wandern damit aus den Komponenten in die
  ViewModels, bevor die Service-Fassade sie schneidet — deshalb steht dieser Umbau **vor** der
  Einführung von `src/data/services/`.

## Vor- und Nachteile der Optionen

### Option 1 — Custom Hook als ViewModel

- **Gut, weil** ein Hook Zustand, Effekt und Ableitung zugleich halten kann; eine reine Funktion
  kann das nicht, und genau diese Mischung ist es, die heute in den Komponenten steckt.
- **Gut, weil** das Muster mit React-Bordmitteln auskommt und keine siebte Abhängigkeit einführt.
- **Gut, weil** es maschinell prüfbar ist: ein Pfad-Präfix plus zwei verbotene Hooks in
  `src/ui/components/**`.
- **Schlecht, weil** ein Kontext grobkörnig ist — jeder Verbraucher des Bericht-Kontexts rendert
  bei jeder Roster-Änderung. Die Aufteilung in zwei Kontexte begrenzt den Schaden, hebt ihn
  nicht auf.
- **Schlecht, weil** die Zahl der Dateien deutlich steigt.

### Option 2 — Reine Selektor-Funktionen

- **Gut, weil** pure Funktionen am einfachsten zu testen und zu memoisieren sind.
- **Gut, weil** kein Provider und kein Kontext nötig ist.
- **Schlecht, weil** der Bericht weiter als Prop durch den Baum müsste — der Hauptbefund bliebe
  ungelöst.
- **Schlecht, weil** UI-Zustand (aufgeklappte Regelgruppen, Auswahl, Dialoge) und Effekte
  weiterhin in den Komponenten lägen; das Muster würde nur die halbe Ableitung erfassen.

### Option 3 — Externe Zustandsbibliothek

- **Gut, weil** feingranulare Subscriptions das Render-Verhalten besser machen könnten als jeder
  Kontext.
- **Schlecht, weil** die Anwendung genau einen bearbeiteten Roster zur Zeit kennt; der
  Zustandsbaum ist klein und kurzlebig.
- **Schlecht, weil** eine Bibliothek die Bauform vorgibt und der Bestand ausdrücklich ohne
  Router, ohne UI-Kit, ohne CSS-Framework und ohne i18n-Bibliothek gebaut ist (ADR-0026 ist das
  Muster dieser Haltung).
- **Schlecht, weil** die eigentliche Rechenarbeit im Evaluator liegt und dort memoisiert ist;
  die Bibliothek löste ein Problem, das nicht gemessen wurde.
