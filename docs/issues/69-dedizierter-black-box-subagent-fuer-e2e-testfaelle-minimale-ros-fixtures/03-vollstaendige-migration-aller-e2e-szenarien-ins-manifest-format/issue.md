Status: resolved
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
- Gesamte Evaluator-E2E-Absicherung auf den manifest-getriebenen Runner ueberfuehrt. army-standard-bearer (Roster auf direkte Ziel-entryIds korrigiert, da die zusammengesetzte ::-Kennung als UNRESOLVED_DEFINITION nicht aufloest) und vampire-bloodlines-ergofang als Manifest migriert; vier neue .ros-Szenarien (ogre-kingdoms, orcs-and-goblins, vampire-counts, real-catalog-smoke) inline im Black-Box-Stil autoriert und jede Erwartung gegen echte Runner-Ausgabe verifiziert. Manifest-Schema + Runner um optionalen firing.count, einen expect.diagnostics-Block (present/absent je DiagnosticKind, optional targetId/defId/minCount) und einen Roster-dataset-Override (fuer Auswertung ohne Mercenaries) erweitert; rueckwaertskompatibel. Fuenf handgeschriebene E2E-Dateien + verwaistes realCatalogs.js entfernt, e2eRoster.js auf Bericht-Leser getrimmt. Testkatalog-Doc neu geschrieben. vitest 1797 gruen (Runner: 40), lint/typecheck/knip sauber.
- Nachtrag (Review-Gate): Die fuenf Armee-Szenarien (ogre-kingdoms, orcs-and-goblins, vampire-counts, real-catalog-smoke, army-standard-bearer) wurden anschliessend vom echten Black-Box-Subagenten e2e-testcase-author neu autoriert, sobald dieser in der Session verfuegbar war. Jede Erwartung (limitId/actual/bound, Diagnose-Arten) ist damit allein aus dem Katalog-XML abgeleitet; der Runner-Lauf war ausschliesslich der separate Abgleichschritt (keine Divergenz -> 41/41 gruen), nicht die Quelle der Werte. Der fruehere Vermerk 'inline im Black-Box-Stil, gegen Runner-Ausgabe verifiziert' ist damit ueberholt (siehe ADR 0033, Abschnitt 'Abgleich statt Anpassung an die Engine').
