Status: needs-triage
Type: chore
Blocked by: None

## Description

Die E2E-Suite der Reinraum-Engine deckt Kategorie-Grenzen bisher nur **je
Kontingent** ab: alle vorhandenen Szenarien pruefen einen Bezugsrahmen innerhalb
eines einzelnen Force. Eine Kategorie-Obergrenze, die **armeeweit ueber mehrere
Kontingente hinweg** zaehlt, hat kein Szenario.

Gefunden bei der Recherche zu Issue 73. Belegte Abdeckung heute:

| Szenario | prueft |
|---|---|
| `evaluator-force-child-category-missing` | Pflicht-Minimum, je Kontingent |
| `explorer-force-constraints` | Obergrenze an der Kategorie-Definition, je Kontingent |
| `explorer-category-constraints` | Obergrenze am Verweis samt Modifikator, je Kontingent |
| `category-scope-bug` | Gegenprobe: eine fremde Kategorie loest die Grenze nicht aus |

**Dies ist kein belegter Fehler.** Die Recherche konnte kein falsches Ergebnis
reproduzieren; die Pflicht-Synthese an der Wurzel behandelt Kategorien
ausdruecklich mit. Was fehlt, ist der Beleg fuer den Obergrenzen-Fall: dass eine
armeeweit gezaehlte Kategorie-Obergrenze die Vorkommen aus **allen**
Kontingenten summiert und nicht nur die des ersten. Solange das kein Szenario
festhaelt, ist es eine Zusicherung ohne Netz — und genau die Sorte Zusicherung,
die ein spaeterer Umbau still bricht.

Der Fall ist vor dem Cutover (Main-Issue 82) relevant: dort uebernimmt die Engine
den produktiven Auswertungspfad, und eine armeeweite Kategorie-Obergrenze, die
zu niedrig zaehlt, laesst eine unzulaessige Armeeliste als gueltig durch.

Zuerst zu klaeren ist, ob die Katalogdaten der Definitive Edition ueberhaupt eine
armeeweit gezaehlte Kategorie-Obergrenze in einem Datensatz mit mehreren
Kontingenten hergeben. Falls nicht, ist die ehrliche Antwort, die Luecke als
datenseitig unbelegbar zu dokumentieren, statt ein kuenstliches Szenario zu
bauen — die Suite arbeitet nach ADR-0033 ausdruecklich an echten Katalogdaten.

## Acceptance Criteria
- [ ] Aus den Katalogdaten ist belegt, ob eine armeeweit gezaehlte Kategorie-Obergrenze in einem Datensatz mit mehreren Kontingenten vorkommt.
- [ ] Falls ja: ein Szenario an echten Katalogdaten haelt fest, dass sie die Vorkommen aus allen Kontingenten summiert (ADR-0033, verfasst vom Black-Box-Autor).
- [ ] Falls nein: die Luecke ist als datenseitig unbelegbar dokumentiert, mit der Stelle, an der ein solcher Fall auftauchen wuerde.
- [ ] Die uebrige E2E-Suite bleibt gruen.

## Decisions
- `[po]` Gefunden bei der Recherche zu Issue 73 als ausdruecklich nicht abschliessend geklaerter Punkt. Kein reproduzierter Fehler, sondern eine Abdeckungsluecke: die vier vorhandenen Kategorie-Szenarien pruefen alle nur einen Bezugsrahmen je Kontingent. Neues Main-Issue auf needs-triage statt Child-Issue, weil es keinem Akzeptanzkriterium des laufenden Main-Issues 81 dient. Bewusst nicht als Bug formuliert, weil kein Fehlfall belegt ist; das erste Akzeptanzkriterium fragt zuerst, ob die Katalogdaten den Fall ueberhaupt hergeben.

## Comments
