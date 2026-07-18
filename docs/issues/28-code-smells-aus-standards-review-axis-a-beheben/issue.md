Status: needs-triage
Type: refactor
Blocked by: None

## Description
Die Axis-A-Standards-Review im Rahmen von Haupt-Issue 22 (Repository-
Aufräumung) hat sechs vorbestehende Code-Smells über die gesamte Codebasis
gefunden, alle außerhalb des Scopes der reinen Doku-/Datei-Aufräumung von
Issue 22:

1. **Tote Such-Funktion — `src/components/PlayMode.jsx`.** `searchTerm`-State
   wird nie via `setSearchTerm` verändert (lint: unused), daher können die
   Filter-Zweige in `getGroupedAndSortedSelections` nie greifen. Entweder
   entfernen oder die Suche tatsächlich verdrahten.
2. **Data Clump mit halbfertiger Migration — `src/solver/profileCollector.js`.**
   `collectUnitProfilesAndRules` nimmt `{system, roster, currentCatalogueId,
   parentSelection, counts}` noch positional entgegen, während der Rest der
   Codebasis bereits das `EvaluationContext`-Objekt nutzt.
3. **Duplizierte Zähllogik — `src/solver/modifierEvaluator.js`.** Das
   `countMatches`-Reduce in `evaluateCondition` und `getModifiedConstraintValue`
   ist nahezu identisch; sollte in einen gemeinsamen Helper extrahiert werden.
4. **Überlange Funktion — `getArmourSave` in
   `src/solver/modifierEvaluator.js` (~220 Zeilen)** mischt Keyword-Scanning,
   mehrere Regex-Durchläufe und Save-Arithmetik. `getWardSave` hat dieselbe
   Struktur — Hinweis auf ein extrahierbares Muster.
5. **Duplizierter Filter-Block — `src/components/PlayMode.jsx`** (moot, falls
   Punkt 1 die Suche entfernt statt verdrahtet).
6. **Inkonsistente Primitive/Union-Shapes** — `toast` (String oder
   `{message,type}`), `saveSummaryData.breakdown`/`tooltipState.content`
   (Array oder ReactNode) erzwingen `typeof`/`Array.isArray`-Verzweigungen an
   jeder Nutzungsstelle.

## Acceptance Criteria
- [ ] Für jeden der sechs Punkte ist entschieden und umgesetzt: entfernen,
      beheben oder bewusst zurückstellen (mit Begründung im jeweiligen
      Child-Issue)
- [ ] `npm run lint` bleibt grün, `npm test` bleibt grün
- [ ] Keine Verhaltensänderung an Bestandsfunktionen ohne separate Abnahme
      (reines Refactoring/Cleanup, keine neuen Features)

## Comments
