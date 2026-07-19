# BattleScribe UI-Renderer-Audit (Solution D, Main-Issue 19)

Systematischer, **endlicher** Abgleich jedes anzeige-relevanten BattleScribe-XSD-
Konstrukts gegen den zuständigen Renderer. Ziel: sicherstellen, dass die in den
Slices 03–06 korrekt geparsten/ausgewerteten Daten in der UI tatsächlich
erscheinen. Kein neues Parsing/keine neue Auswertung — reine Anzeige-Schicht.

Der Abgleich geht von den 9 XSD-vs-Code-Lücken des PRD aus und ergänzt die
anzeige-tragenden Struktur-Konstrukte (Profile, Regeln, Kategorien, Kosten), über
die diese Lücken sichtbar werden.

## Anzeige-Brücken (SSOT der Anzeige)

Alle Renderer beziehen ihre Daten über wenige zentrale Brücken; wird ein Konstrukt
dort korrekt eingesammelt, erscheint es überall konsistent:

- `collectUnitProfilesAndRules` (`src/solver/profileCollector.js`) — Profile & Regeln
  einer Einheit inkl. aufgelöster Katalog-Einträge.
- `resolveEntry` (`src/solver/catalogResolver.js`) — flacht infoLinks/infoGroups in
  `profiles`/`rules` ab, sodass Renderer nur zwei Listen lesen müssen.
- `computeRosterCounts` (`src/solver/rosterCounter.js`) — Auswahl-/Kategorie-Zählungen
  (inkl. dynamischer Kategorien).
- `getEffectiveEntryCategoryLinks` / `isEntryPrimaryInCategory`
  (`src/solver/entryVisibility.js`) — effektive (post-Modifier) Kategoriezugehörigkeit
  für die **UI-Einsortierung**: welcher Aushebe-Dialog eine Einheit anbietet, ob eine
  Kategorie-Sektion überhaupt erscheint, und ob ein armeeweiter Selektor über eine
  Force-Kategorie erreichbar ist (ergänzt in Main-Issue 29; siehe ADR 0003 §4).
- `getExtraResourceTotals` (`src/solver/rosterCounter.js`) — Sekundär-Ressourcen für
  die Anzeige (filtert versteckte Kostenarten).
- `getModifiedConstraintValue` (`src/solver/modifierEvaluator.js`) +
  `formatConstraintLimit` (`src/solver/constraintScope.js`) — Constraint-Grenzwerte
  für die Anzeige (inkl. Prozent-Kennzeichnung).
- `getEffectiveName` / `getEffectiveSelectionName` (`src/solver/modifierEvaluator.js`)
  — effektiver (namens-modifizierter) Anzeigename, konsumiert von
  `CategoryUnitAdder`, `OptionGroup`, `UnitSelectionCard`, `PlayUnitDetails` und der
  XML-Export-Serialisierung; der rohe Katalogname bleibt separat als SSOT für
  namensbasierte Fuzzy-Abgleiche erhalten (ergänzt in Main-Issue 33).
- `collectTriggeredMessages` / `ValidationSeverity` (`src/solver/modifierEvaluator.js`)
  — kontextabhängige `field="error"/"warning"/"info"`-Hinweistexte mit Schweregrad,
  konsumiert von `rosterValidator`/`RosterSidebar` (ergänzt in Main-Issue 33).
- `isListConfiguration` (`src/solver/listConfiguration.js`) — entscheidet, ob eine
  Selection eine „Listenkonfiguration" (armeeweiter Regel-Schalter, keine spielbare
  Einheit; siehe `CONTEXT.md`) ist. `isListConfigurationCategory` /
  `buildConfigurationRadioGroups` (`src/solver/listConfigurationView.js`) bauen
  darauf das Editor-Anzeigemodell. Konsumiert von `PlayMode` (blendet
  Listenkonfigurationen aus der Spieleansicht vollständig aus) und `RosterEditor`
  (rendert sie als eigene `ListConfigurationCard` statt Einheitenkarten; ergänzt
  in Main-Issue 34).

## Checkliste: Konstrukt → Renderer → Soll/Ist

| # | XSD-Konstrukt (Anzeige-Aspekt) | Zuständiger Renderer / Brücke | Soll | Ist (vor Audit) | Status |
|---|--------------------------------|-------------------------------|------|-----------------|--------|
| 1 | `modifierGroup` conditions/repeats (gegateter Characteristic-Modifier) | `collectUnitProfilesAndRules` → `PlayUnitDetails` (`renderProfileCell` Breakdown) | Modifizierte Werte erscheinen mit Breakdown-Tooltip; ungegatete feuern nicht | Wird via `getEffectiveModifiers`/Gating angewandt und angezeigt | OK — keine Änderung |
| 2 | `condition`/`repeat` `includeChildSelections` | Evaluator → `computeRosterCounts`/`getModifiedConstraintValue` → Zähl-Badges | Kind-Auswahlen fließen in Zählungen/Grenzwerte ein | Vom Evaluator berücksichtigt, Ergebnis erscheint in Badges | OK — keine Änderung |
| 3 | Modifier `add`/`remove`/`set-primary`/`unset-primary` (dynamische Kategorien) | `computeRosterCounts` (via `getEffectiveCategoryLinks`) → Kategorie-Badges in `RosterEditor`/`RosterSidebar` | Kategorie-Zählungen spiegeln dynamische Zugehörigkeit | `categoryCounts` nutzt effektive CategoryLinks; Badges zeigen dynamischen Count | OK — keine Änderung |
| 3b | Modifier `add`/`remove`/`set-primary` (dynamische Kategorien) → **UI-Einsortierung** (Aushebe-Dialog, Sektions-Sichtbarkeit, armeeweite Selektoren) | `isEntryPrimaryInCategory`/`getEffectiveEntryCategoryLinks` (`entryVisibility.js`) → `CategoryUnitAdder`, `RosterEditor.hasPrimaryCatalogItems`, `armyWideSelectors` | Einheit erscheint im Aushebe-Dialog ihrer **effektiven** Primärkategorie | Prüfte nur statische `categoryLinks` → per Modifier umkategorisierte Einheiten (z. B. Ogerbullen) verschwanden | **Lücke → behoben** (Main-Issue 29) |
| 4 | `infoGroups`/`sharedInfoGroups`/`infoLink type="infoGroup"` | `resolveEntry` (Flatten) → `collectUnitProfilesAndRules` → `PlayUnitDetails`, `UnitChips`, `SelectionConfigurator`, `upgradeDetails` | Gebündelte Profile/Regeln erscheinen an der Einheit | Flatten in `resolveEntry` vorhanden; Renderer lesen `profiles`/`rules` | OK — Renderer-Test ergänzt |
| 5 | `profile@typeId`/`typeName` (Profil-Typ-Gruppierung) | `groupProfilesByType` (`rulesEvaluator.js`) → `PlayUnitDetails` Tabellen, `upgradeDetails` | Profile gruppieren generisch nach Typname als eigene Tabellen | Gruppierung liest `profileTypeName` (jetzt korrekt geparst) | OK — keine Änderung |
| 6 | `constraint@percentValue` (Grenzwert-Anzeige) | `RosterEditor` (Kategorie-Header), `RosterSidebar` (Armeeanforderungen), `OptionGroup` (Gruppen-Limit) | Prozent-Grenzwert als Prozent kenntlich (z. B. „Max: 25 %") | Zeigte nackte Zahl „Max: 25" — nicht von absoluter Zahl unterscheidbar | **Lücke → behoben** (`formatConstraintLimit`) |
| 6b | `constraint@includeChildSelections`/`includeChildForces` | `rosterValidator` → Fehlerliste in `RosterSidebar` | Constraint-Prüfung bezieht Kinder korrekt ein; Fehlermeldung erscheint | Vom Validator berücksichtigt; Fehler erscheinen | OK — keine Änderung |
| 7 | `catalogueLink@importRootEntries` | — (Import-Semantik, kein Renderer) | n/a für Anzeige | Nicht anzeige-relevant | n/a |
| 8 | `costType@hidden` (versteckte Kostenarten) | `getExtraResourceTotals` → `RosterEditor`, `RosterSidebar`, `PlayMode` | Versteckte Kostenarten werden nie angezeigt | Filter `!ct.hidden` vorhanden | OK — Renderer-Test ergänzt |
| 9 | `publication@publisherUrl` | `getPublicationRef` → `publicationRef`-Anzeige (Name/Seite) | Quelle als Name/Seite; URL derzeit von keinem Renderer konsumiert | `publicationRef` nutzt Name/ShortName; URL nirgends angezeigt | n/a — kein zuständiger Renderer (Feld korrekt geparst, keine Anzeige-Fläche) |

## Ergebnis

- **Eine echte Anzeige-Lücke** (Konstrukt #6, `percentValue`): Grenzwerte wurden als
  nackte Zahlen gerendert. Behoben durch den gemeinsamen Formatierer
  `formatConstraintLimit(value, constraint)` (`constraintScope.js`), eingesetzt in
  `RosterEditor`, `RosterSidebar` und `OptionGroup`.
- Alle übrigen anzeige-relevanten Konstrukte erschienen bereits korrekt, weil sie
  über die zentralen Brücken (`resolveEntry`, `collectUnitProfilesAndRules`,
  `computeRosterCounts`, `getExtraResourceTotals`) laufen, die von den Slices 03–06
  bereits korrekt befüllt werden.
- **Nachtrag (Main-Issue 29):** Konstrukt #3 war für die **Zähl-Badges** korrekt,
  nicht aber für die **UI-Einsortierung** (Aushebe-Dialog, Sektions-Sichtbarkeit,
  armeeweite Selektoren) — diese lasen weiterhin die statischen `categoryLinks`,
  wodurch per `set-primary` umkategorisierte Einheiten (z. B. die aus dem
  *Mercenaries*-Bibliothekskatalog importierten Ogerbullen) aus der Auswahl
  verschwanden. Behoben über die neue Brücke `isEntryPrimaryInCategory` /
  `getEffectiveEntryCategoryLinks` (Konstrukt #3b).
- Ergänzte Renderer-Tests sichern die auditierten Konstrukte ab:
  - `src/solver/constraintScope.test.js` — `formatConstraintLimit` (Prozent/Absolut).
  - `src/components/editor/RosterSidebar.test.jsx` — Prozent-Grenzwert mit „%",
    versteckte Kostenart ausgeblendet, sichtbare Kostenart angezeigt.
  - `src/components/play/PlayUnitDetails.infogroups.test.jsx` — infoGroup-gebündeltes
    Profil erscheint als eigene Profiltabelle (echte Brücke, kein Solver-Mock).
  - `src/solver/entryVisibility.test.js` — effektive Primärkategorie (Konstrukt #3b):
    `set-primary`-Modifier über einen entryLink auf ein Bibliothekskatalog-Ziel,
    inkl. Bedingungs-Gating.
  - `src/components/editor/CategoryUnitAdder.test.jsx` — der Aushebe-Dialog bietet eine
    per `set-primary` nach „Core" umkategorisierte Einheit an (echte Brücke, kein
    Solver-Mock).
- Nicht-anzeige-relevante Konstrukte (#7 `importRootEntries`, #9 `publisherUrl`) haben
  keinen zuständigen Renderer; die Feld-Korrektheit liegt in den Parser-Slices.
