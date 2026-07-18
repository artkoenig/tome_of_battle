Status: needs-triage
Type: fix
Blocked by: None

## Description
Seit dem Wechsel auf den Lexicanum-Katalog (ADR-0018) werden Profilwert-Änderungen
(z.B. Stärke +2), die eine gewählte Vampir-Blutlinie eigentlich bewirken soll,
nicht mehr angewendet — obwohl die entsprechenden Katalog-Einträge korrekt und
BattleScribe-konform vorhanden sind. Die Blutlinien-Auswahl selbst (Sichtbarkeit
zugehöriger Powers/Regeln) funktioniert weiterhin; ausschließlich die reinen
Charakteristik-Modifier greifen nicht.

Root Cause: Der Solver wertet `instanceOf`-Bedingungen aus, bei denen `scope`
entweder ein bekanntes Schlüsselwort (`parent`/`force`/`roster`) oder generisch
eine Kategorie-ID ist, gegen deren Mitgliedschaft die aktuelle Selektion geprüft
wird. Im alten Ergofarg-Katalog war `scope` bei diesen Bedingungen tatsächlich
immer eine Kategorie-ID, wofür die Logik passte. Im echten Lexicanum-Katalog ist
`scope` bei den Charakteristik-Modifiern jedoch die **eigene ID** des Eintrags
selbst (BattleScribe-Idiom „suche in meinem eigenen Teilbaum"), nicht eine
Kategorie. Die generische Kategorie-Mitgliedschaftsprüfung findet für diesen Fall
nie eine passende `categoryLink` und liefert daher immer `false` — der Modifier
wird nie angewendet.

Dieses Selbstreferenz-als-Scope-Muster ist im echten Katalog nicht auf Vampire
beschränkt (insgesamt 422 `instanceOf`-Bedingungen in der Datei); der volle
Umfang der Betroffenheit ist noch zu ermitteln.

Kein bestehendes ADR oder Issue dokumentiert bisher die Charakteristik-Modifier-
Semantik oder deren Migration explizit.

Möglicher Lösungsansatz (kein vorgegebenes Design): die `instanceOf`-Auswertung
um den Fall „Selbst-Scope" erweitern — wenn `scope` gleich der ID des aktuell
resolvten Eintrags ist, als Suche im eigenen Teilbaum statt als Kategorie-
Mitgliedschaftsprüfung behandeln, analog zur bereits vorhandenen
`parent`/`force`/`roster`-Fallunterscheidung.

## Acceptance Criteria
- [ ] Ermittelt und dokumentiert, wie viele/welche der 422 `instanceOf`-Bedingungen
      im echten Lexicanum-Katalog dem Selbst-Scope-Muster folgen (nicht nur Vampire)
- [ ] Vampir-Blutlinien-Charakteristik-Modifier (z.B. Stärke) werden bei
      entsprechender Blutlinien-Wahl korrekt auf das Profil angewendet, verifiziert
      per E2E-Test gegen den echten Lexicanum-Vampire-Counts-Katalog
- [ ] Bestehende Tests (insb. gegen das alte Ergofarg-Fixture) bleiben grün
- [ ] Falls weitere Einheiten/Kataloge vom selben Muster betroffen sind, sind auch
      deren Charakteristik-Modifier nach dem Fix korrekt wirksam

## Comments
- Ursache durch Recherche-Subagent verifiziert (kein Code geändert): Beispiel aus
  "Vampire Counts (6th definitive edition).cat" (~Zeile 3126-3157):
  `<modifier type="increment" value="2" field="f95b-da01-0578-3bdc">` mit
  `<condition type="instanceOf" value="0" field="selections"
  scope="6822-0110-a7c9-cbb0" childId="4cae-a20e-8374-b6cb" shared="true"
  includeChildSelections="true"/>` — `scope` ist die eigene ID von
  "Vampire Count", `childId` die Von-Carstein-Blutlinien-Kategorie.
  Betroffener Code: `src/solver/modifierEvaluator.js:109-178`
  (`evaluateCondition`, `type="instanceOf"`), insb. `selectionHasCategory`-Aufruf
  Zeile 162-165 und `childId`-Vergleich Zeile 166.
