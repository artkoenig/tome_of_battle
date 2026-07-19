Status: resolved
Type: feature
Blocked by: [01]

## Description
Voraussetzung: Kind-Issue 01 (`ModifierKind.PREPEND` und
`AttributeName.JOIN` existieren im generierten Schema-Modul).

Katalogautoren benennen geteilte/generische Einträge kontextabhängig um
über `modifier field="name"` (Typen `set`/`append`/`prepend`, teils mit
`join`-Attribut; 500 Treffer über alle 18 Kataloge). Beispiele: The
Empire — der `infoLink`-Profilname „Empire soldier" wird zu
„Halberdier"/„Spearmen"/„Ulric's Champion"; Bretonnia — eine Waffe wird zu
„Polearm (counts as Halberd)", ein Reittier zu „Silvaron"; Dogs of War —
„Relics of Lustria" wird mit `join="&#160; + &#160;"` angehängt (NBSP-
umschlossenes „+", **nicht** ein einzelnes Leerzeichen — `join` muss
geparst, nicht angenommen werden). Weder Parser noch Solver werten
`field="name"` aus; jede UI-Stelle zeigt bislang den rohen Katalognamen.

Der modifizierte Name gilt überall — Roster-Editor, Aushebe-Dialog,
Play-Modus, XML-Export — und ersetzt den rohen Katalognamen konsequent an
allen Stellen, die heute `.name` direkt lesen.

## Acceptance Criteria
- [ ] Eine Auswahl mit einem bedingungserfüllten Namens-Modifier
      (`set`/`append`/`prepend`, inkl. `join`) zeigt den modifizierten Namen
      im Roster-Editor, im Aushebe-Dialog, im Play-Modus und im XML-Export.
- [ ] `prepend`/`append` mit unterschiedlichen `join`-Werten (Leerzeichen,
      NBSP, „ + ") fügen den Text korrekt getrennt zusammen — kein
      hartkodiertes Leerzeichen.
- [ ] Ist die Bedingung des Modifiers nicht erfüllt, bleibt der rohe
      Katalogname unverändert sichtbar.
- [ ] Bestehende namens-basierte Abgleiche (z. B. Profil-/Regel-Zuordnung
      per Fuzzy-Match) funktionieren weiterhin korrekt — keine Regression
      durch die neue effektive Namensauflösung.
- [ ] Reproduktions-Regressionstest mit realdatennahem Fixture (z. B. The
      Empire „Empire soldier" → „Halberdier"/„Spearmen").
- [ ] Die volle Testsuite (`npm test`) bleibt grün.

## Comments
- Namens-Modifier (field=name; set/append/prepend inkl. verbatim geparstem join) umgesetzt: getEffectiveName/getEffectiveSelectionName im modifierEvaluator (SSOT), join im xmlParser geparst. Effektiver Name an allen vier Stellen sichtbar - Roster-Editor (UnitSelectionCard, OptionGroup), Aushebe-Dialog (CategoryUnitAdder), Play-Modus (PlayUnitDetails) und XML-Export (rosterSerialization) - sowie fuer infoLink-Profilnamen (profileCollector). Roher selection.name bleibt SSOT, Fuzzy-Match unveraendert. Reproduktions-Fixture The Empire (Empire soldier -> Halberdier/Spearmen). 704 vitest-Tests gruen.
