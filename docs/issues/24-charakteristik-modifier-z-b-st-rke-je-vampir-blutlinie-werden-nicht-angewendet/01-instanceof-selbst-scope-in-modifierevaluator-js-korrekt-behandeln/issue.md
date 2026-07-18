Status: resolved
Type: fix
Blocked by: None

## Description
Der Solver wertet `instanceOf`-Bedingungen aus, indem er `scope` entweder als
bekanntes Schlüsselwort (`parent`/`force`/`roster`) oder generisch als
Kategorie-ID behandelt, gegen deren Mitgliedschaft die aktuelle Selektion via
Kategorie-Link geprüft wird. Im echten Lexicanum-Katalog trägt `scope` bei
bestimmten Bedingungen jedoch die eigene Entry-ID des Eintrags, an dem die
Bedingung hängt (BattleScribe-Idiom „suche in meinem eigenen Teilbaum"), nicht
eine Kategorie-ID. Für diesen Fall liefert die generische Kategorie-Prüfung
immer `false`, weil nie eine passende Kategorie-Mitgliedschaft existiert — der
zugehörige Modifier (z.B. eine Charakteristik-Änderung wie Stärke +2 je
gewählter Vampir-Blutlinie) wird dadurch nie angewendet.

Die Auswertung muss erkennen, wenn `scope` gleich der ID des Eintrags ist, an
dem die Bedingung selbst hängt, und in diesem Fall im eigenen Teilbaum nach
der per `childId` referenzierten Selektion suchen statt eine
Kategorie-Mitgliedschaft zu prüfen — analog zur bereits vorhandenen
`parent`/`force`/`roster`-Fallunterscheidung.

## Acceptance Criteria
- [ ] `instanceOf`-Bedingungen mit `scope` == eigene Entry-ID werden als Suche
      im eigenen Teilbaum ausgewertet, nicht als Kategorie-Mitgliedschaftsprüfung
- [ ] Vampir-Blutlinien-Charakteristik-Modifier (z.B. Stärke) greifen korrekt
      bei entsprechender Blutlinien-Wahl, verifiziert per E2E-Test gegen den
      echten Lexicanum-Vampire-Counts-Katalog
- [ ] Ermittelt und dokumentiert, wie viele/welche der 422 `instanceOf`-
      Bedingungen im echten Lexicanum-Katalog demselben Selbst-Scope-Muster
      folgen (nicht nur Vampire), und diese sind nach dem Fix ebenfalls korrekt
      wirksam
- [ ] Bestehende Tests (insb. gegen das alte Ergofarg-Fixture, wo `scope`
      weiterhin eine Kategorie-ID ist) bleiben grün

## Comments
- instanceOf-Auswertung um Selbst-Scope-Fall erweitert: erkennt scope==eigene Entry-ID und sucht im eigenen Teilbaum nach childId anhand EFFEKTIVER (modifizierter) Kategorie-Mitgliedschaft (getEffectiveCategoryLinks), damit dynamisch (per category-add-Modifier) zugewiesene Blutlinien-Kategorien greifen. Analyse des echten Lexicanum-Katalogs: 14 von 422 instanceOf-Bedingungen folgen dem Selbst-Scope-Muster, verteilt auf 3 Vampir-Charaktereinträge (Vampire Lord, Vampire Count, Vampire Thrall), alle für Blutlinien (Blood Dragon/Necrarch/Strigoi). E2E gegen echte Katalogdaten verifiziert (WS 7->9 nur bei gewählter Blutlinie; ohne Fix bleibt 7 -> Bug reproduziert). Neuer verbatim-reduzierter Fixture + Test (modifierEvaluator.selfScope.test.js); Ergofarg-Tests und Gesamtsuite (653 Tests) grün.
