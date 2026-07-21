Status: needs-triage
Type: refactor
Blocked by: None

## Description

**Geruch:** Divergent Change / God Component — Restbefund aus der
Vier-Achsen-Prüfung des Haupt-Issues 39 (Achse A, Fund 5).

Kind-Issue 39/04 hatte die Entflechtung der Wurzelkomponente zum Ziel und hat
dabei echte Fortschritte erzielt: die fünf PWA-Belange liegen nun in
`src/hooks/usePwaLifecycle.js`, die Ansichtswerte in `src/constants/views.js`,
die Release-Diff-Logik in `src/utils/releaseDiff.js`, und der redundante
Roster-Zustand ist auf `selectedRosterId` als alleinige Quelle
zurückgeführt — samt behobenem Umbenennungsfehler.

Dennoch schrumpfte `src/App.jsx` nur von 600 auf 581 Zeilen und ändert sich
weiterhin aus sechs unabhängigen Gründen:

1. Ansichts-Routing
2. Integration des Browser-Verlaufs
3. PWA- und Offline-Zustand (der nach der Extraktion verbliebene Rest)
4. Toast- und Fehlerkanal
5. Beherbergung der Dialoge
6. Vollständiges Roster-CRUD, inklusive des inline aufgebauten Roster-Literals

Die Extraktionen, die im Zuge von Issue 39 tatsächlich landeten
(`importMessages.js`, `revisionDisplay.js`, `profileCellClasses.js`), stammen
aus `Importer.jsx` beziehungsweise `PlayUnitDetails.jsx` — nicht von hier.

**Warum ein eigenes Issue:** Anders als die übrigen Prüf-Funde verlangt dieser
eine Entwurfsentscheidung statt einer mechanischen Ersetzung. Welche der sechs
Belange in eigene Hooks wandern, welche in eine Routing-Schicht und ob das
Roster-CRUD eine eigene Datenschicht-Fassade erhält, ist nicht aus dem Befund
ableitbar — das ist zu spezifizieren, bevor jemand Hand anlegt.

## Acceptance Criteria
- [ ] (noch zu spezifizieren — dieses Issue steht auf `needs-triage`)

## Comments

Angelegt am 2026-07-21 aus der Vier-Achsen-Prüfung des Haupt-Issues 39,
Achse A (`standards-reviewer`), Fund 5. Bewusst nicht in Kind-Issue 39/13
aufgenommen, das nur die mechanisch behebbaren Funde 1-4 abdeckt.
