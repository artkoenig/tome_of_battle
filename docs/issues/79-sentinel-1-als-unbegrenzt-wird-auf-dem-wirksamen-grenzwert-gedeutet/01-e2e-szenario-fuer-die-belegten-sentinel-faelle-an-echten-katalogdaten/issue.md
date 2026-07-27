Status: resolved
Type: fix
Blocked by: None

## Description

Es fehlt ein Testfall an echten Katalogdaten, der festhaelt, wann eine Grenze
"unbegrenzt" bedeutet und wann derselbe Zahlenwert schlicht eine Zahl ist.

Fachlich gilt: eine Grenze, die mit dem Wert minus eins **deklariert** ist,
bedeutet "keine Obergrenze". Derselbe Wert als Ergebnis einer Rechnung bedeutet
das **nicht** — er ist dann eine gewoehnliche Zahl. Der Unterschied liegt an der
Deklaration, nicht am Ergebnis.

Drei Auspraegungen kommen in den Katalogen tatsaechlich vor und gehoeren in das
Szenario:

1. Eine Grenze ist von vornherein mit minus eins deklariert und wird von keinem
   Modifikator angefasst → unbegrenzt.
2. Ein Modifikator setzt eine Grenze ausdruecklich auf minus eins, obwohl ihr
   Grundwert endlich ist → ab dann unbegrenzt.
3. Eine Grenze ist mit minus eins deklariert und wird hochgezaehlt (in den
   Fixture-Daten je angefangener Punktmenge) → das Ergebnis ist eine gewoehnliche
   Zahl, keine Unbegrenztheit. In der Spielsystem-Datei gibt es dafuer eine
   Obergrenze fuer Kommandanten, die auf diese Weise mit der Punktgroesse des
   Rosters waechst.

Beide Schreibweisen des Wertes kommen vor (mit und ohne Nachkommastelle), das
Szenario darf sich nicht auf eine verlassen.

Der Fall "ein Modifikator zieht eine Grenze ins Negative" gehoert ausdruecklich
**nicht** hierher: kein Katalog im Repo erzeugt ihn, und synthetische
Katalogdaten dafuer zu bauen ist ausgeschlossen (ADR-0033). Diesen Fall haelt
das Geschwister-Issue per Modultest fest.

## Acceptance Criteria
- [x] Ein Szenario unter `docs/testing/` deckt die an echten Katalogdaten belegbaren Auspraegungen ab: (1) mit minus eins deklariert und unangetastet → unbegrenzt; (2) ein Modifikator setzt eine endliche Grenze ausdruecklich auf minus eins → ab dann unbegrenzt.
- [x] Die erwarteten Grenzwerte sind allein aus den Katalogdaten hergeleitet, nicht aus dem Verhalten der Engine abgelesen.
- [x] Das Szenario ist ueber das Manifest-Format vom vorhandenen Runner ausfuehrbar.
- [x] Der belegbare Teil von Auspraegung 3 ist festgehalten: eine mit minus eins deklarierte Grenze, deren wirksamer Wert durch einen Modifikator eine Zahl wird, wird an dieser Zahl gemessen und nicht als unbegrenzt gelesen.
- [x] Das arithmetische Muster "mit minus eins deklariert **und** hochgezaehlt" ist als Luecke dokumentiert statt erfunden — es kommt im Datensatz des Evaluators nicht vor und wird im Geschwister-Slice per Modultest festgehalten.

## Comments
- Wird vom Black-Box-Autor verfasst (ADR-0033): allein aus den .cat/.gst-Daten, ohne Blick in src/evaluator/. Das Szenario ist absichtlich vor der Engine-Aenderung zu schreiben, damit die Erwartung aus den Daten stammt und nicht aus der reparierten Engine abgelesen wird. Es ist bis zum Geschwister-Slice erwartbar rot.
- Szenario 'unlimited-sentinel' angelegt (docs/testing/unlimited-sentinel/, 5 Roster). Der Autor hat die ihm mitgegebenen Ids selbst nachgeprueft und drei davon widerlegt: 4e53-29c7-31c3-8b2d sitzt am selectionEntry 'Black Orcs' und traegt einen BEDINGTEN set -1, nicht einen unbedingten am entryLink; ffea-b24a-0cdf-781e und die Schreibweise -1.0 existieren im Evaluator-Datensatz nicht. Er hat stattdessen 938b-15b1-f433-e0d5 gewaehlt (gleiche Bauart, zusaetzlich mit increment). Das ist die erhoffte Wirkung des Black-Box-Verfahrens: die Erwartung stammt aus den Daten, nicht aus der Vorlage.
