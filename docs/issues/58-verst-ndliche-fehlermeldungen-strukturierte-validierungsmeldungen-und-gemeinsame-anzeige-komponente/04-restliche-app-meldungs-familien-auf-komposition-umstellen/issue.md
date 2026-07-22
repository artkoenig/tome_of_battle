Status: ready-for-agent
Type: feature
Blocked by: [03]

## Description

Abschluss-Slice für Issue 58: stellt die übrigen App-generierten Meldungs-Familien
auf strukturierte Felder + zentrale Komposition um, damit **alle** App-Meldungen
in Alltagssprache erscheinen.

Betroffene Familien (die noch nicht in Issue 02/03 behandelt wurden):
`roster-limit`, `force-selector-min`, `force-roster-limit`,
`group-points-min`/`-max`, `group-percent-min`/`-max` und `unresolved-entry`.

Jede Familie erhält strukturierte Felder am Validator und eine Vorlage in der
zentralen Kompositions-Stelle. Autor-Meldungen (`modifier-error/-warning/-info`)
bleiben ausdrücklich **wortgetreu** und werden nur durch die gemeinsame Komponente
einheitlich dargestellt (ADR 0022) — sie sind nicht Teil der Umformulierung.

Reine Darstellung: keine Änderung an der Validierungslogik.

## Acceptance Criteria
- [ ] `roster-limit`, `force-selector-min`, `force-roster-limit`,
      `group-points-min/-max`, `group-percent-min/-max` und `unresolved-entry`
      tragen strukturierte Felder und werden über die zentrale Komposition in
      Alltagssprache angezeigt.
- [ ] Nach dieser Slice erscheinen **alle** App-generierten Meldungen als
      verständlicher Klartext; keine App-Meldung zeigt mehr den alten technischen
      Wortlaut.
- [ ] Autor-Meldungen (`modifier-*`) bleiben im Wortlaut unverändert und werden
      nur einheitlich gestylt.
- [ ] Menge und Wahrheit aller Verstöße sind unverändert (keine Logikänderung).
- [ ] Tests decken die Komposition der neu umgestellten Familien ab; volle Suite
      grün.

## Comments
