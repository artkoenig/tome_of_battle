Status: ready-for-agent
Type: refactor
Blocked by: None

## Description
Erster, tragender Slice der zentralen Query-Engine (siehe
[ADR 0029](../../../adr/0029-zentrale-query-engine-fuer-constraint-auswertung.md)):
Der scope-agnostische Zähl-Kern entsteht — ein Scope wird zu einem Anker
aufgelöst, über den einheitlich gezählt/summiert wird, und das Ergebnis trägt
seine Ursachen. Als erster Konsument laufen die `min`/`max`-**Grenzen an
Einträgen** über diesen Kern.

Beobachtbares Verhalten: Grenzen an Einträgen werden für jeden Bezugsrahmen
(`self`/`parent`/`force`/`roster` sowie Eintrags- und Kategorie-ID) nach der
BSData-Spec geprüft, inklusive Prozent-Grenzen am Eintrag. Gruppen-, Kategorie-
und Force-Grenzen sowie die Oberfläche folgen in späteren Slices und ändern sich
hier noch nicht.

## Acceptance Criteria
- [ ] Eine Auswahl, die ihr `max` überschreitet, wird als Verstoß gemeldet — für jeden Entry-Bezugsrahmen (`self`/`parent`/`force`/`roster`, Eintrags-/Kategorie-ID); eine `min`-Grenze am Eintrag ebenso.
- [ ] `shared="false"` an einer Entry-Grenze zählt nur die eine Instanz, an der sie hängt; `shared="true"` (Vorgabe) aggregiert über alle Vorkommen des Eintrags — jeweils spec-konform.
- [ ] Eine Prozent-Grenze an einem Eintrag wird gegen eine Referenzmenge geprüft, die im selben Bezugsrahmen gezählt wird wie ihr Zähler.
- [ ] Eine Validierungsmeldung aus diesem Pfad trägt ihre Ursache(n) nach ADR 0027, wenn der verletzte Grenzwert durch einen bedingten Modifier zustande kam.

## Comments
