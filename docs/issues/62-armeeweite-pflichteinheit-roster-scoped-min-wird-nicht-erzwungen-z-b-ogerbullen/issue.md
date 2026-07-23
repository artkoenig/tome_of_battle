Status: resolved
Type: fix
Blocked by: None

## Description

### Problem

Ein Katalog-Autor kann eine armeeweite Pflichteinheit ausdrücken, indem er einem
Wurzel-`selectionEntry` einen `min`-Constraint mit `scope="roster"` gibt (z. B.
Ogre Kingdoms: der „Bulls"-Eintrag trägt `constraint field="selections"
scope="roster" value="1" type="min"`). Semantisch heißt das: „Die Armee muss
mindestens eine Bullen-Einheit enthalten."

Der Validator erzwingt das heute **nicht**, solange die Einheit **ganz fehlt**.
Grund: Die eintragsweise Constraint-Prüfung (`checkEntryConstraints`) läuft nur
über Auswahlen, die **bereits im Roster** liegen. Der einzige Pfad, der eine
komplett fehlende Pflichtauswahl meldet, ist `checkMandatoryForceSelectors` — und
der filtert strikt auf `scope="force"` (`collectForceScopedMinSelectors`,
`FORCE_SCOPE = 'force'`). Ein `scope="roster"`-Mindestwert auf einem fehlenden
Wurzeleintrag fällt durch beide Raster.

**Folge:** Eine Oger-Liste ohne jede Bullen-Einheit wird fälschlich als gültig
gemeldet.

### Aktuelles vs. erwartetes Verhalten

- **Aktuell:** Roster ohne Bullen → keine Validierungsmeldung; Liste gilt als
  spielbar.
- **Erwartet:** Roster ohne Bullen → blockierende Validierungsmeldung (Schweregrad
  `error`): „Die Armee braucht noch einen „Bulls"."

### Umfang der Behebung (bestätigt: generisch)

Der Fix ist **system-agnostisch** (ADR 0003 — keine armeespezifische Logik): Der
Validator meldet **jeden** unbedingten `scope="roster"`-`min ≥ 1` auf einem
Wurzel-`selectionEntry`, wenn dieser Eintrag armeeweit gar nicht vorhanden ist.

**Blast Radius (empirisch über alle 17 Live-Kataloge gezählt):** genau **zwei**
betroffene Wurzeleinträge, **beide legitim** zu erzwingen — es entsteht kein
Kollateralschaden:

1. `Ogre Kingdoms.cat` → „Bulls" (`type=unit`, min=1) — der Auslöser dieses Issues.
2. `High Elf.cat` → „Who Is the general? …" (`type=upgrade`, min=1 **und** max=1) —
   eine Pflicht-Generalswahl, die die App heute ebenfalls nicht erzwingt und die
   der Fix korrekt mitbehebt.

Zukünftige `scope="roster"`-mins in aktualisierten Katalogen wirken damit
automatisch, ohne Code-Änderung.

### Fachliches Modell / Design

- **Neuer interner Verstoß-Typ `roster-selector-min`**, parallel zum bestehenden
  `force-selector-min`. Nötig, weil er **armeeweit** zählt (über alle Kontingente),
  nicht pro Kontingent — er trägt daher **keine** `forceId`, sondern gilt fürs
  ganze Roster und wird **einmal pro Roster** gemeldet (nicht einmal pro Force).
- **Nur der „gar nicht vorhanden"-Fall (Count == 0)** wird hier gemeldet — exakt
  wie beim bestehenden `checkMandatoryForceSelectors`. Ein vorhandener, aber zu
  geringer Count bleibt bei der eintragsweisen Prüfung, damit kein Fehler doppelt
  erscheint.
- **Zählung armeeweit:** über die roster-weiten Selektions-Zähler (`selectionCounts`),
  nicht die kontingentweiten (`forceSelectionCounts`). Sonst würde eine Liste mit
  mehreren Kontingenten falsch (mehrfach oder pro-Force) bewertet.
- **Skip nicht-wählbarer Selektoren:** analog zum bestehenden
  `isSelectionEntryHidden`-Guard werden Einträge übersprungen, die in der aktuellen
  Armee-Variante gar nicht wählbar sind, damit keine unerfüllbare Pflicht entsteht
  (siehe Risiko unten).
- **Ursachen (ADR 0027):** Der neue Verstoß trägt sein `causes`-Feld nach demselben
  Muster wie alle anderen Meldungen (`evaluateConstraintWithCauses` +
  `...withCauses(causes)`).
- **Aushebe-Verfügbarkeit (ADR 0022):** `roster-selector-min` ist **nicht
  aushebe-sperrend** (`VIOLATION_BLOCKS_ADD_AVAILABILITY['roster-selector-min'] =
  false`) — wie alle `*-min`. Ein neu eingeführter, unklassifizierter Typ muss den
  Driftschutz-Test fehlschlagen lassen (bestehendes Verhalten von
  `classifyBlocksAddAvailability`).
- **Meldungstext (App-Meldung, ADR 0026):** Der Solver liefert nur Schlüssel +
  Parameter; die UI bildet den Satz. Wortlaut identisch zur bestehenden
  Pflichtwahl-Meldung, damit beide Fälle konsistent klingen:
  - DE: „Die Armee braucht noch einen „{entryName}"."
  - EN: „The army still needs a \"{entryName}\"."
  - `{entryName}` ist der **unübersetzte Katalogname** (ADR 0003) — beim englischen
    Oger-Katalog also **„Bulls"**, nicht „Ogerbullen".
  - Neuer i18n-Schlüssel `validation.rosterSelectorMin` (eigener Schlüssel für
    saubere Trennung, gleicher Wortlaut wie `validation.forceSelectorMin`).

### Test-Nahtstelle (Seam)

Getestet wird an der Solver-Fassade **`validateRoster(roster, system)`** (ADR 0023),
analog zum vorhandenen `src/solver/rosterValidator.mandatoryForceSelector.test.js`.
Abzudeckende Fälle:

1. Wurzeleintrag mit `scope="roster"` `min=1` **fehlt** armeeweit → genau ein
   `roster-selector-min`-Fehler (Schweregrad `error`).
2. Derselbe Eintrag **ist vorhanden** → kein Fehler.
3. Nicht wählbarer / versteckter Pflichteintrag → **übersprungen**, kein Fehler
   (deckt das Unerfüllbarkeits-Risiko ab).
4. Roster mit **mehreren Kontingenten**, Pflichteintrag fehlt → Fehler erscheint
   **genau einmal** (nicht pro Force).
5. **Regression:** bestehendes `force-selector-min`-Verhalten unverändert.

### Bekanntes Risiko (offen gehalten)

Ein Pflichteintrag, den der Nutzer gar nicht aushebeln kann (z. B. der
High-Elf-General-Eintrag hat nur eine `primary="false"`-Kategorie und erscheint
womöglich in keiner Aushebe-Sektion), würde als **unerfüllbarer** blockierender
Fehler stehenbleiben — die Liste wäre nie spielbar. Der `isSelectionEntryhidden`-
Skip deckt „hidden" ab, aber nicht zwingend „hat keine primäre Kategorie / nicht im
Dialog wählbar". Die genaue Behandlung dieses Falls ist bewusst **offen** und wird
bei der Umsetzung geklärt (Nutzer-Entscheidung: „erstmal offen lassen"). Kandidaten:
(a) den Skip-Guard auf „nicht aushebbar" ausweiten, (b) nur als `warning` statt
`error` melden, (c) den Datenfall im Katalog-Fork gesondert betrachten.

### Nicht im Umfang

- Keine Änderung an den Katalogdaten (`.cat`) — die Daten sind korrekt authored;
  der Fehler liegt in der App.
- Keine Behandlung von `scope="force"`-mins (bereits abgedeckt).
- Keine Einheiten-/armeespezifische Sonderlogik (ADR 0003).

## Acceptance Criteria
- [x] Reproduktion zuerst: ein E2E-naher Test an `validateRoster(roster, system)` mit einer Oger-artigen Fixture ohne „Bulls"-Einheit zeigt den Bug (heute grün/kein Fehler) — er wird mit dem Fix rot→grün.
- [x] Ein Wurzel-`selectionEntry` mit unbedingtem `scope="roster"` `min ≥ 1`, der armeeweit fehlt (Count == 0), erzeugt über `validateRoster` genau einen `roster-selector-min`-Verstoß mit Schweregrad `error`.
- [x] Ist mindestens eine Instanz des Pflichteintrags im Roster vorhanden, erscheint **kein** `roster-selector-min`-Verstoß (der „zu wenig, aber vorhanden"-Fall bleibt der eintragsweisen Prüfung überlassen — keine Doppelmeldung).
- [x] Bei einem Roster mit mehreren Kontingenten wird der fehlende Pflichteintrag **genau einmal** (armeeweit) gemeldet, nicht pro Force; die Zählung nutzt die roster-weiten Selektions-Zähler, nicht die kontingentweiten.
- [x] Ein in der aktuellen Armee-Variante nicht wählbarer/versteckter Pflichteintrag (`isSelectionEntryHidden`) wird übersprungen — kein Verstoß.
- [x] Der `roster-selector-min`-Verstoß trägt sein `causes`-Feld nach ADR 0027 (`evaluateConstraintWithCauses` + `...withCauses(causes)`).
- [x] `roster-selector-min` ist in `VIOLATION_BLOCKS_ADD_AVAILABILITY` mit `false` eingetragen (nicht aushebe-sperrend, wie alle `*-min`); `classifyBlocksAddAvailability` wirft für den neuen Typ nicht, der Driftschutz-Test bleibt grün.
- [x] Neuer i18n-Schlüssel `validation.rosterSelectorMin` in `de.json` **und** `en.json`, Wortlaut identisch zu `validation.forceSelectorMin` (DE: „Die Armee braucht noch einen „{entryName}".") ; `{entryName}` bleibt unübersetzter Katalogname (ADR 0003).
- [x] Bestehendes `force-selector-min`-Verhalten unverändert (Regressionstest grün).
- [x] `npm test`, `npm run lint`, `npm run typecheck` grün.

## Comments
- Wiedereröffnet: Fix #122 deckt nur das selectionEntry-Muster (scope=roster) ab. Die Definitive Edition (lexicanum-imperialis, gameSystemId 0d13-…) codiert die Pflicht-Ogerbullen-Regel als Wurzel-entryLink mit force-scoped min (Basis 0, per Standard-Modifier auf 1). collectScopedMinSelectors durchsucht nur catalogue.selectionEntries, nie catalogue.entryLinks → die Pflicht wird dort nicht erzwungen. Folge-Child-Issue angelegt.
- Definitive-Edition-Lücke geschlossen (Child 01 resolved): collectScopedMinSelectors wertet jetzt auch Wurzel-entryLinks aus. Vier-Achsen-Verifikation grün. Version-Bump 1.8.1 → 1.8.2 (fix).
