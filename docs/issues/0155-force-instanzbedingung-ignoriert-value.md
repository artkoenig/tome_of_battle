---
status: backlog
branch:
pr:
---

# Kontingent-Instanzbedingung: `value` darf nicht wirken

## Goal

In der O&G-Definitive-Edition-Liste steht der Riese unter Elite (`Special`) statt unter Selten
(`Rare`), und die Einheit "Trolls" wird in der Standardliste gar nicht angeboten. Ursache ist die
Auswertung von `instanceOf`/`notInstanceOf` gegen ein Kontingent (`forceEntry`) im Schreibmodell:
`value="0"` wird dort als Verneinung gelesen, obwohl `value` bei diesen beiden Vergleichsarten
laut Upstream-Wiki ("Has no effect where `Type` is `instance of|not instance of`") und laut
`docs/battlescribe-data-format.md` ohne Wirkung ist. Dadurch kippt jedes so kodierte Listen-Gate
in sein Gegenteil: Einheiten erscheinen genau in den Sonderheeren, die sie ausschließen, und
fehlen in denen, die sie führen. Der Evaluator wertet dieselbe Bedingungsart bereits richtig aus —
die beiden Engines widersprechen sich heute über denselben Katalogdaten.

## Acceptance criteria

- AC1: Eine `instanceOf`/`notInstanceOf`-Bedingung gegen ein Kontingent liefert dasselbe Ergebnis,
  unabhängig davon, welchen `value` sie trägt (`0`, `1` oder gar keinen); nur die Vergleichsart
  entscheidet über die Verneinung. | verify: forge-test --run src/roster
- AC2: In der Standardliste (`Standard (OG-AB)`) des Katalogs "Orcs and Goblins" der Definitive
  Edition ist der "Giant" eine Auswahl der Kategorie `Rare`, nicht `Special`; in der Liste
  "Mountain or Troll Country Waaagh! (OG-AB)" ist er eine Auswahl der Kategorie `Special`. Ein Fall
  über die echten Fixture-Kataloge nagelt beide Richtungen fest. | verify: forge-test --run src/roster
- AC3: In der Standardliste wird die Einheit "Trolls" unter `Rare` angeboten; in den Sonderheeren,
  deren Gate sie nennt (`Night Goblin Horde (OG-AB)`, `Mountain or Troll Country Waaagh! (OG-AB)`,
  `Nomadic Badlands Waaagh! (OG-AB)`, `Snotling Horde (OG-AB)`, `Night Goblin Horde (CJ#46)`),
  wird sie nicht angeboten. | verify: forge-test --run src/roster
- AC4: Schreibmodell und Evaluator stimmen bei dieser Bedingungsart überein — ein Fall führt
  dieselbe Kontingent-Instanzbedingung durch beide Engines und vergleicht das Ergebnis, statt die
  erwartete Wahrheit nur im Schreibmodell zu behaupten. | verify: forge-test
- AC5: Die übrigen Bedeutungen von `value` bleiben unangetastet: die zählenden Vergleichsarten
  (`atLeast`, `atMost`, `greaterThan`, `lessThan`, `equalTo`, `notEqualTo`) lesen `value`
  unverändert, und keine Bedingung außerhalb der Kontingent-Instanzprüfung ändert ihr Verhalten.
  | verify: forge-test
- AC6: Schriftlicher Befund zur Katalogseite: benannt wird, welche Katalogdaten die Einheit
  "Stone Trolls" in der Standardliste unter `Special` sichtbar machen, und ob das dem Armeebuch
  entspricht. Der Befund steht am Ende dieses Issues; eine Änderung am Katalog-Fork gehört nicht
  dazu.

## Out of scope

- Jede Änderung im Katalog-Fork-Repository (eigenes Repository, eigener PR).
- Die doppelt angebotene Einheit "Orc Boar Chariot" in der Elite-Sektion der Standardliste und die
  Einsortierung von "Goblin Rock Lobba"/"Goblin Spear Chukka" unter `Rare` — zwei getrennte
  Beobachtungen aus derselben Sitzung, jede mit eigener Ursache.
- Die roster-weite Rückfallprüfung der Kontingent-Instanzbedingung (sie prüft heute auch fremde
  Kontingente desselben Rosters); ohne Befund, dass sie schadet, bleibt sie wie sie ist.
