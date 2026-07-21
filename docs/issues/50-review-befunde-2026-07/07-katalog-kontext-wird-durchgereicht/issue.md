Status: resolved
Type: fix
Blocked by: [01, 06]

## Description

Befund W4. Beim Auflösen eines Eintrags kann angegeben werden, aus welchem
Katalog er stammt. Fehlt diese Angabe, sucht der Resolver ersatzweise über alle
geladenen Katalog-Indizes und liefert den ersten Treffer.

An mehreren Aufrufstellen — in der Sichtbarkeitsprüfung, im Zähler, in der
Selektions-Fabrik und in Komponenten der Editor- und Spielansicht — wird der
Katalog nicht mitgegeben. Solange nur ein Katalog geladen ist, geht das gut.
Nach ADR 0018 sind jedoch zwei Kataloge gleichzeitig geladen; dann kann der
Eintrag aus dem falschen stammen.

Dass das Risiko bekannt ist, zeigt eine eigene Testdatei für
Katalog-Kollisionen. Abgesichert ist damit aber nur der Resolver selbst, nicht
die Aufrufer, die ihm den Kontext vorenthalten.

Der Rückfall über alle Indizes ist ein Implementierungsdetail, auf das sich
Aufrufer stillschweigend verlassen — eine undichte Abstraktion. Wo der Katalog
fehlt, ist das ein Hinweis auf fehlenden Kontext, nicht auf einen zulässigen
Standardwert.

## Acceptance Criteria
- [ ] Alle Aufrufstellen geben den Katalog beim Auflösen mit
- [ ] Sind zwei Kataloge mit gleichlautenden Eintrags-Ids geladen, liefert jede Aufrufstelle den Eintrag des richtigen Katalogs
- [ ] Ein Test deckt diesen Kollisionsfall über die Aufrufstellen ab, nicht nur über den Resolver, und schlägt gegen den alten Stand fehl
- [ ] Der Rückfall über alle Indizes wird von keiner Aufrufstelle mehr stillschweigend genutzt
- [ ] Bleibt der Rückfall bestehen, ist im Code festgehalten, für welchen Fall er noch gedacht ist

## Comments
- Jede Aufrufstelle von resolveEntry/findEntryInSystem gibt den Katalog jetzt mit: Sichtbarkeitspruefung (neues Feld catalogueId im VisibilityContext), Zaehler/Anzeigepreis, Selektions-Fabrik (durchgereicht bis in die Pflicht-Kinder), Aushebe-Verfuegbarkeit, useRoster, Roster-Import sowie CategoryUnitAdder, PlayUnitDetails, RosterCategorySection und OptionGroup. Die Katalog-Vorrangregel liegt als resolveContextCatalogueId einmal im modifierEvaluator. Der Rueckfall ueber alle Indizes bleibt bestehen, ist im Resolver aber als das dokumentiert, wofuer er noch gedacht ist: katalogsuebergreifende Verweise auf geteilte Daten. Neue Testdatei callSites.catalogueCollisions.test.jsx deckt den Kollisionsfall ueber fuenf Aufrufstellen ab und faellt gegen den alten Stand durch.
