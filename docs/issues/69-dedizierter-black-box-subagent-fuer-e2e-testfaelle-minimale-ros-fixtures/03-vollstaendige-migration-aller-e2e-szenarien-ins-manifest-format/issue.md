Status: needs-triage
Type: chore
Blocked by: [02]

## Description
Ueberfuehrt die **gesamte** E2E-Absicherung des Evaluators auf den
manifest-getriebenen Runner, sodass es genau eine Quelle der Wahrheit gibt.

Zwei Gruppen bestehender Tests werden migriert:
1. **Bereits `.ros`-basierte Szenarien** ausser dem Piloten — `army-standard-bearer`
   und `vampire-bloodlines-ergofang` — werden in das Manifest-Format ueberfuehrt.
2. **Programmatische Armee-Suiten** (Ogre Kingdoms, Orcs & Goblins, Vampire Counts
   sowie der Rauchtest an den vollen Definitive-Daten), deren Roster heute im
   Testcode aufgebaut werden: fuer sie werden neue `.ros`-Szenarien mit Manifest
   **autoriert**. Diese Autorenarbeit laeuft ueber den Black-Box-Autor aus
   Child-Issue 02, damit auch die migrierten Faelle blind gegenueber dem
   Evaluator-Code entstehen.

Nach der Migration werden die abgeloesten handgeschriebenen E2E-Testdateien
entfernt. Der nicht-technische Testkatalog `docs/testkatalog-evaluator-e2e.md`,
der jeden E2E-Test des Evaluators spiegelt, wird deckungsgleich zum neuen,
runner-basierten Stand gehalten.

Das insgesamt abgesicherte Verhalten bleibt erhalten: die Menge der geprueften
Regeln und ihrer Erwartungen entspricht nach der Migration mindestens dem heutigen
Stand; die Suite bleibt gruen.

## Acceptance Criteria
- [ ] `army-standard-bearer` und `vampire-bloodlines-ergofang` liegen im
      Manifest-Format vor und werden vom Runner ausgewertet.
- [ ] Fuer Ogre Kingdoms, Orcs & Goblins, Vampire Counts und den Definitive-
      Rauchtest existieren `.ros`-Szenarien mit Manifest, die das bisher
      programmatisch gepruefte Verhalten abdecken; sie wurden vom Black-Box-Autor
      erstellt.
- [ ] Die abgeloesten handgeschriebenen E2E-Testdateien sind entfernt; die
      gesamte Evaluator-E2E-Absicherung laeuft ueber den generalisierten Runner.
- [ ] `docs/testkatalog-evaluator-e2e.md` ist deckungsgleich zum neuen Stand.
- [ ] Die vollstaendige Testsuite ist gruen.

## Comments
