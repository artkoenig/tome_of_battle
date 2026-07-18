Status: resolved
Type: feature
Blocked by: None

## Description
`systemQuirks.js` bildet App-seitige Sonderfälle ab, die im Katalog-Datenmodell nicht sauber ausdrückbar sind — Schlüssel ist die `gameSystemId`. Der bestehende Eintrag ist an die aktuelle gameSystemId gebunden; der neue, deutlich reichhaltigere Datensatz trägt eine andere gameSystemId (`0d13-7737-ea86-4662`), unter der `getSystemQuirks` aktuell auf `EMPTY_QUIRKS` zurückfällt.

Die konkreten Kategorie-/Eintrags-IDs, auf die der bestehende Quirk verweist (Heroes, Characters, der General-Eintrag), sind im neuen Datensatz nachweislich identisch vorhanden — sie müssen aber gegen die tatsächliche neue Katalogstruktur (Force-Entries, Constraints) validiert werden, nicht blind unter dem neuen Schlüssel übernommen werden, falls sich die Regel-Semantik dort unterscheidet.

## Acceptance Criteria
- [ ] `SYSTEM_QUIRKS` enthält einen Eintrag, dessen Schlüssel die gameSystemId des neuen Datensatzes ist.
- [ ] Für jede Kategorie/jeden Eintrag, die/der im alten Quirk-Eintrag referenziert wird, ist gegen die neue Katalogstruktur geprüft, ob der Quirk dort weiterhin nötig ist (z. B. hat die Heroes-Kategorie im neuen Datensatz inzwischen einen eigenen `max`-Constraint, oder erbt sie weiterhin von Characters?) — der neue Eintrag spiegelt das tatsächliche Ergebnis, nicht die alte Annahme.
- [ ] `getInheritedCategoryMaxSource`/`isQuirkGeneralEntryId` liefern für den neuen Datensatz korrekte Ergebnisse, verifiziert gegen ein Fixture aus echten neuen Katalogdaten.
- [ ] Neue Testdatei für `systemQuirks.js` (bisher ungetestet).

## Comments
- SYSTEM_QUIRKS-Eintrag für neue gameSystemId 0d13-7737-ea86-4662 ergänzt (teilt sich mit der alten Ergofarg-ID denselben, gegen echte Lexicanum-Daten validierten Quirk: Heroes erbt Characters' force-max, General-Eintrag 1b7c-2c90-6d96-28c9). Neue Testdatei systemQuirks.test.js plus Verbatim-Fixture-Auszüge aus echten neuen Katalogdaten.
