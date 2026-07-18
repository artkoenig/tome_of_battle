Status: resolved
Type: feature
Blocked by: None

## Description
Bei der Arbeit an Issue 02 (systemQuirks) fiel auf, dass der neue Lexicanum-Datensatz Force-weite Kategorielimits anders modelliert als der alte Ergofarg-Datensatz: Das punktebasierte Characters-Limit (und weitere Kategoriegrenzen) hängt nicht mehr am `categoryLink` einer Force, sondern an der **`categoryEntry`-Definition selbst** (`scope="force"`, mit punkteskalierenden Modifiern); die Heroes-Kategorie trägt dort zusätzlich ein `max="-1"` (unbegrenzt).

Die bestehende Force-Kategorie-Validierung (`checkForceCategoryLimits` in `rosterValidator.js`) wertet ausschließlich Constraints aus, die am `categoryLink` hängen — `categoryEntry`-eigene, forcescope-Constraints werden nicht gelesen. Dadurch werden native Kategoriegrenzen des neuen Datensatzes (z. B. „max. so viele Charactere pro Punktebudget") in der App möglicherweise gar nicht durchgesetzt, obwohl der Katalog sie sauber deklariert.

Dieses Issue schließt die Lücke datengetrieben und sprachneutral — ohne fraktions- oder namensspezifische Sonderlogik (ADR-0003). Erster Schritt ist die Reproduktion an echten neuen Katalogdaten, um zu bestätigen, dass und wo das Limit heute nicht greift, bevor die Auswertung erweitert wird.

## Acceptance Criteria
- [ ] Reproduktion: An echten Lexicanum-Katalogdaten ist per Test belegt, dass ein Force-weites Kategorielimit, das nur am `categoryEntry` (scope="force") deklariert ist, aktuell nicht als Validierungsfehler erkannt wird.
- [ ] Die Force-Kategorie-Validierung berücksichtigt Constraints, die an der `categoryEntry`-Definition mit `scope="force"` hängen (inklusive der punkteskalierenden Modifier darauf), zusätzlich zu den bestehenden `categoryLink`-Constraints.
- [ ] `max="-1"` (unbegrenzt) auf einer Kategorie wird korrekt als „kein Limit" behandelt und erzeugt keinen falschen Fehler.
- [ ] Die Auswertung bleibt vollständig ID-/datengetrieben (keine hartkodierten Kategorienamen); der alte Ergofarg-Datensatz und seine bestehende Validierung (`validator.test.js`) verhalten sich unverändert.
- [ ] Regressionstest deckt sowohl den `categoryEntry`-scope-force-Fall (neuer Datensatz) als auch den bestehenden `categoryLink`-Fall (alter Datensatz) ab.

## Comments
- checkForceCategoryLimits liest jetzt zusätzlich force-scope-Constraints direkt an der categoryEntry-Definition (inkl. punkteskalierender Modifier); max=-1 gilt als unbegrenzt. Rein datengetrieben, alter Datensatz unberührt. Reproduktion + Regression an echten Lexicanum-Fixtures.
