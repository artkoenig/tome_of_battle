Status: ready-for-agent
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
- [ ] Ein Szenario unter `docs/testing/` deckt die drei oben genannten Auspraegungen an echten Katalogdaten ab.
- [ ] Die erwarteten Grenzwerte sind allein aus den Katalogdaten hergeleitet, nicht aus dem Verhalten der Engine abgelesen.
- [ ] Das Szenario ist ueber das Manifest-Format vom vorhandenen Runner ausfuehrbar.
- [ ] Der Fall aus Auspraegung 3 haelt fest, dass das Ergebnis eine Zahl ist — nicht "unbegrenzt".

## Comments
- Wird vom Black-Box-Autor verfasst (ADR-0033): allein aus den .cat/.gst-Daten, ohne Blick in src/evaluator/. Das Szenario ist absichtlich vor der Engine-Aenderung zu schreiben, damit die Erwartung aus den Daten stammt und nicht aus der reparierten Engine abgelesen wird. Es ist bis zum Geschwister-Slice erwartbar rot.
