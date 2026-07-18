Status: resolved
Type: fix
Blocked by: None

## Description
### Bug
Beim allerersten Import der Spieldaten (leerer Zustand → `Importer`
`showAsEmptyState`) blitzt zwischen dem Ladeoverlay ("Beschwöre
Spieldaten...") und der endgültigen Heerlager-Ansicht (`RosterDashboard`) kurz
die Importer-Ansicht mit Erfolgsmeldung und ggf. der Schema-Warnungen-Box auf.
E2E reproduziert (leere IndexedDB, echter Bundle-Import über den
"Importieren"-Button, DOM per MutationObserver protokolliert):

```
t=10ms   leerer Zustand + Ladeoverlay
t=195ms  Ladeoverlay noch da, Warnungen bereits im State (hinter dem Overlay)
t=236ms  Ladeoverlay AUS, aber weiterhin Importer mit Warnungen+Erfolgsmeldung sichtbar  <- Flash
t=395ms  Heerlager (RosterDashboard)
```

### Ursache
`Importer.jsx` (`handleImportBundle`/`processUploadedFile`) setzt
`setLoading(false)` in seinem eigenen `finally`-Block, sobald **sein** Import
fertig ist. `App.jsx#handleSystemImported` (Z. 233) ruft daraufhin
`loadAllData()` **ohne `await`** auf und `navigate('rosters')` greift im
leeren Zustand nicht, weil dort `systems.length === 0` weiterhin den
`Importer` rendert — erst wenn `loadAllData()` durchgelaufen ist und
`systems` befüllt hat, wechselt `App.jsx` zur Heerlager-Ansicht. In der Lücke
dazwischen ist das Ladeoverlay schon weg, aber der (leere) Importer rendert
noch seine Erfolgs-/Warnungsbox.

### Entscheidung (vom Nutzer bestätigt, überschreibt einen Teil von Issue 19/ADR 0016)
Statt die Warnungen über die Sicht-Transition hinweg im State mitzuschleifen,
wird die advisory Schema-Warnung **nicht mehr in der UI angezeigt**, sondern
nur noch protokolliert (`console.warn`) — analog zum bereits bestehenden
Muster in `updateSystemFromCatalogIndex`
(`src/db/catalogUpdate.js:168-174`). Der Import bleibt advisory (Issue 19,
ADR 0016): eine schema-abweichende Datei wird weiterhin importiert, nie
abgelehnt — nur die **Sichtbarkeit** der Warnung ändert sich von "UI-Box" auf
"Konsole". Das ist eine bewusste Rücknahme des sichtbaren Teils von Issue 19
User Story 4; ADR 0016 braucht dafür einen Revisionseintrag, ebenso Issue
19's `issue.md` (Hinweis/Revision statt Story-Löschung), README.md (Zeile
~79) und `docs/battlescribe-data-format.md` (Zeile ~87).

### Lösung
- **`src/App.jsx`**: `handleSystemImported` (Z. 233) `async` machen und
  `await loadAllData()` **vor** `navigate('rosters')` ausführen, statt beide
  Aufrufe fire-and-forget nebeneinander zu feuern.
- **`src/components/Importer.jsx`**: In `handleImportBundle` und
  `processUploadedFile` `await onSystemImported()` **innerhalb** des
  `try`-Blocks aufrufen (nach `saveSystem`), sodass der `finally`-Block
  (`setLoading(false)`) erst feuert, nachdem `App` bereits zur
  Heerlager-Ansicht gewechselt hat — der `Importer` (samt Overlay) wird dann
  während `loading=true` unmounted, kein sichtbarer Zwischen-Frame.
  `schemaWarnings`-State und den zugehörigen JSX-Block
  (`data-testid="schema-warnings"`) entfernen; stattdessen die von
  `collectSchemaWarnings` gelieferten Warnungen bei `warnings.length > 0` per
  `console.warn(...)` ausgeben (Nachrichten-Format wie im bestehenden
  `catalogUpdate.js`-Muster).
- **`src/components/Importer.test.jsx`**: Test 7 ("Schema-invalid manual
  import surfaces a locatable advisory warning but still imports", Z.
  260-292) auf `console.warn`-Spy statt `getByTestId('schema-warnings')`
  umstellen; Import bleibt weiterhin erfolgreich (advisory).
- **`docs/adr/0016-battlescribe-xsd-als-vendored-konformitaetsquelle.md`**:
  Revisionseintrag ergänzen (Sichtbarkeit der Advisory-Warnung: UI-Box →
  Konsolen-Log; Begründung: Flash-Bug beim Erstimport, siehe oben).
- **`docs/issues/25-battlescribe-xsd-konformitaet/issue.md`**: User Story 4
  um einen Revisionshinweis ergänzen (Warnung wird geloggt, nicht mehr in der
  UI angezeigt) statt sie kommentarlos zu löschen — gleiches Muster wie beim
  bestehenden Hard-Gate→Advisory-Revisionshinweis in derselben Datei.
- **`README.md`** (Zeile ~79) und **`docs/battlescribe-data-format.md`**
  (Zeile ~87): Formulierung von "wird als Warnung angezeigt" auf "wird
  protokolliert (Konsole)" korrigieren.

### Nicht ändern
`src/db/catalogUpdate.js` (`updateSystemFromCatalogIndex`) loggt Warnungen
bereits ausschließlich über die Konsole — dient hier als Vorbild, muss selbst
nicht angefasst werden.

## Acceptance Criteria
- [ ] Erstimport (leerer Zustand → Heerlager): kein Zwischen-Frame mit
      Warnungen/Erfolgsmeldung zwischen Ladeoverlay und Heerlager-Ansicht
      mehr sichtbar (E2E verifiziert, analog zur Reproduktion oben)
- [ ] Schema-Warnungen werden nur noch via `console.warn` ausgegeben, nicht
      mehr im Importer-DOM gerendert; `data-testid="schema-warnings"` entfernt
- [ ] Import bleibt advisory: eine schema-abweichende Datei wird weiterhin
      importiert, nicht abgelehnt
- [ ] ADR 0016 um Revisionseintrag ergänzt (Sichtbarkeit UI → Konsole)
- [ ] Issue 19 `issue.md`, README.md, `docs/battlescribe-data-format.md`
      beschreiben konsistent nur noch Konsolen-Logging
- [ ] `Importer.test.jsx` Test 7 angepasst (console.warn statt DOM-Testid)
- [ ] `npm test` (inkl. Puppeteer-E2E) grün

## Comments
- Flash beim Erstimport behoben: App.handleSystemImported awaited loadAllData vor navigate; beide Importer-Handler awaiten onSystemImported innerhalb des try, sodass das Ladeoverlay erst nach dem Sichtwechsel unmountet. Advisory Schema-Warnung von UI-Box auf console.warn umgestellt (logSchemaWarnings, Muster wie catalogUpdate.js); schemaWarnings-State und data-testid schema-warnings entfernt. Test 7b auf console.warn-Spy umgestellt. ADR 0016, Issue-19 US4, README, battlescribe-data-format als Revision aktualisiert. npm test (548 vitest + Puppeteer-E2E) gruen.
