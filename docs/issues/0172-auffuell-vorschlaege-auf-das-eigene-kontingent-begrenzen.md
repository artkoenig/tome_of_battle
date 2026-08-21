---
status: done
branch: claude/new-session-065uhx
pr: 255
---

# Auffüll-Vorschläge auf das eigene Kontingent begrenzen

## Goal

`useAutoFillSuggestions` (aus Issue 0164) prüft den Rahmen eines Slots gegen die
roster-weite Umkehrung von `pathBySelectionId`. Vor 0164 hatte
`ForceEditorSection` die `capabilities` vorher auf den Teilbaum des Kontingents
gefiltert (`path === forcePath || path.startsWith(forcePath + '/')`). Dadurch
bietet das Auffüll-Panel eines Kontingents heute auch Slots an, deren Rahmen eine
Auswahl in einem **anderen** Kontingent derselben Liste ist. Das ist eine
Verhaltensänderung, die 0164 ausdrücklich ausschloss; sie fällt keinem Test auf,
weil kein Szenario zwei Kontingente aufspannt.

Die Vorschlagsliste muss wieder auf den Teilbaum des eigenen Kontingents
begrenzt sein, und ein Test muss das festnageln.

## Acceptance criteria

- AC1: `src/viewmodels/editor/useAutoFillSuggestions.js` sammelt nur Slots, deren
  Pfad im Teilbaum des Kontingents liegt (`path === forcePath` oder
  `path` beginnt mit `` `${forcePath}/` ``). | verify: `grep -n forcePath src/viewmodels/editor/useAutoFillSuggestions.js`
- AC2: Ein Test in `src/viewmodels/editor/useAutoFillSuggestions.test.jsx` spannt
  zwei Kontingente auf: Kontingent `'0'` mit einem bezahlbaren eigenen Slot,
  Kontingent `'1'` mit einer Auswahl `'1/0'` und einem bezahlbaren Slot `'1/0/0'`
  daran. Beim Aufruf mit `forcePath: '0'` erscheint der eigene Slot in den
  Vorschlägen, der fremde nicht. Der Test schlägt gegen den heutigen Stand fehl. | verify: `npx forge-test --run useAutoFillSuggestions`
- AC3: Kein bestehendes Verhalten geht verloren: Slots direkt unter dem eigenen
  Kontingent und Slots an eigenen Auswahlen bleiben Vorschläge. | verify: `npx forge-test --run src/viewmodels`
- AC4: `forge-test`, `forge-lint`, `forge-typecheck`, `forge-build` sind grün. | verify: `npx forge-test && npx forge-lint && npx forge-typecheck && npx forge-build`
