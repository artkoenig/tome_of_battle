Status: resolved
Type: feature
Blocked by: None

## Description
Der Katalog-Parser verwirft aktuell gemeinsam genutzte Regeln (`sharedRules`), sobald ein Element zusätzlich ein Geschwister-Element `rules` besitzt (erst-Treffer-gewinnt statt Merge) — laut BattleScribe-Schema dürfen beide gleichzeitig existieren. Außerdem wird der gültige `infoLink`-Zieltyp `infoGroup` beim Parsen komplett übersprungen, obwohl er wie `profile`/`rule` auflösbar sein muss.

Beide Lücken wurden anhand eines vollständigen Test-Imports eines reichhaltigeren, real existierenden BattleScribe-Datensatzes gefunden (658 unauflösbare `targetId`-Referenzen von 15.418 geprüften; 654 durch die rules/sharedRules-Kollision, 4 durch fehlendes infoGroup-Parsing) und sind unabhängig von jeder konkreten Datenquelle reproduzierbar.

## Acceptance Criteria
- [ ] Ein Element mit sowohl `rules` als auch `sharedRules` als direkten Kind-Wrappern liefert die vereinigte Regel-Liste aus beiden Wrappern, nicht nur die des zuerst gefundenen.
- [ ] `infoGroup`-Elemente unter einem `infoGroups`-Wrapper werden geparst und erhalten eine `id`, sodass sie im System-Index auffindbar sind.
- [ ] Ein `infoLink` mit `type="infoGroup"` lässt sich über `resolveEntry`/`findEntryInSystem` auf das passende `infoGroup`-Objekt auflösen.
- [ ] Ein Regressionstest mit einem Fixture, das `rules` und `sharedRules` als Geschwister sowie mindestens ein `infoGroup` enthält, deckt beide Fälle ab.

## Comments
- parseRules merges both rules and sharedRules wrappers (union instead of first-match-wins). Added infoGroup parsing (parseInfoGroups/parseInfoGroup) wired into selectionEntry, selectionEntryGroup, entryLink and catalogue/gameSystem roots, so infoGroups get an id and enter the system index. resolveEntry now handles infoLink type=infoGroup, surfacing the group's profiles and rules. Regression test added in xmlParser.infoGroups.test.js.
