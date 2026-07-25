Status: ready-for-agent
Type: refactor
Blocked by: None

## Description

Der Tracer-Bullet. Die Reinraum-Engine löst heute nur die direkt unter der
Katalog-Wurzel stehenden Einträge auf; per Verweis importierte Definitionen und
die Spielsystemdatei bleiben außen vor. Damit ist kein echtes, vollständiges
Datenset auswertbar.

Diese Slice befähigt die Engine, ein reales Datenset — eine Spielsystemdatei
(`.gst`) plus **eine oder mehrere** Armee-Kataloge (`.cat`) — **vollständig
aufzulösen**: `entryLink`, `infoLink`, `sharedSelectionEntries` **und
`catalogueLink`** (`.cat`→`.cat`-Import) werden transitiv über die Link-/Import-
Ketten zusammengeführt, sodass importierte Definitionen tatsächlich
mit-ausgewertet werden. Die Fassade nimmt dafür eine `.gst` + eine Liste von
`.cat` entgegen (ADR-0032). Ein Verweis, der auch nach der Auflösung nicht
gefunden wird, erscheint weiterhin als Diagnose, nie als Absturz; fehlt eine per
`catalogueLink` deklarierte Abhängigkeit unter den mitgegebenen Katalogen, wird
das als Diagnose gemeldet.

Als erster Beleg wird die **echte** Definitive-Edition-Ogre-`.cat` zusammen mit
der `.gst` **und** der per `catalogueLink` benötigten `Mercenaries`-`.cat`
end-to-end ausgewertet — an den echten Daten lösen 41 der Ogre-Ziel-IDs
ausschließlich über Mercenaries auf. Die realen DE-Rohdaten liegen versioniert
unter `src/evaluator/__fixtures__/whfb6-definitive/` (bereits bereitgestellt),
getrennt von den unberührten Solver-Testdaten und ohne die Clean-Room-Trennung
(ADR-0030) zu verletzen.

Im selben Zug werden die von echten Ogre-Daten **abgelösten synthetischen
E2E-Tests entfernt**: der synthetische „Walking Skeleton"-Fassadentest und das
an der Definitive Edition modellierte synthetische Fixture. Der bisherige
Einzel-Katalog-Smoke-Test wird auf die volle Auflösung gehoben (oder von den
neuen Real-Data-Tests abgelöst).

## Acceptance Criteria
- [ ] Wird die echte Ogre-`.cat` zusammen mit der `.gst` und der Mercenaries-`.cat`
      ausgewertet, so werden per Verweis importierte Definitionen (einschließlich
      solcher aus der `.gst` **und katalogübergreifend aus Mercenaries**) in der
      Auswertung berücksichtigt und erscheinen nicht fälschlich als unaufgelöst.
- [ ] Mindestens eine bekannte, nur über Mercenaries auflösbare Definition wird im
      Bericht korrekt aufgelöst (Beleg der katalogübergreifenden `catalogueLink`-
      Auflösung).
- [ ] Wird dieselbe Ogre-`.cat` **ohne** die Mercenaries-Abhängigkeit ausgewertet,
      erscheint das als Diagnose (fehlende Katalog-Abhängigkeit), nicht als Absturz.
- [ ] Eine leere Armee gegen die echten Ogre-Daten liefert einen strukturell
      vollständigen Bericht ohne Absturz.
- [ ] Die reale armeeweite Pflichteinheit „Bulls" schlägt bei leerer Armee an
      (Ist 0, Grenze 1) und ist erfüllt, sobald ein „Bulls"-Trupp vorhanden ist.
- [ ] Der reale bedingte Modifikator auf der „Tyrant"-Obergrenze wirkt sichtbar:
      seine effektive Grenze und die zugehörige Verletzung ändern sich abhängig
      vom Roster-Zustand, der die reale Bedingung schaltet.
- [ ] Ein Verweis, der trotz Auflösung nicht gefunden wird, erscheint als
      Diagnose; die Auswertung stürzt nicht ab.
- [ ] Die realen DE-Rohdaten liegen versioniert im Repository und werden von den
      E2E-Tests gelesen, ohne die Testdaten der alten Engine zu verändern.
- [ ] Der synthetische Fassaden-E2E-Test und das synthetische Definitive-Edition-
      E2E-Fixture existieren nicht mehr; ihre abgedeckten Verhaltensweisen sind
      durch echte Ogre-Daten abgebildet.
- [ ] Alle Tests (`npm test`) sind grün.

## Comments
