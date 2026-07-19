Status: resolved
Type: feature
Blocked by: None

## Description
Katalogautoren hinterlegen kontextabhängige Klartext-Hinweise über
`modifier field="error"/"warning"/"info"` (Beispiel aus den echten Daten:
Bretonnia/Dark Elves — „Please enable \"Allow special characters?\"", wenn
die zugehörige Bedingung nicht erfüllt ist; 163 Treffer über 17 Kataloge +
`.gst`). Diese Modifier nutzen ausschließlich bereits unterstützte
Modifier-Typen (`add`) — kein Bezug zu Kind-Issue 01.

Ein ausgelöster (bedingungserfüllter) `error`-Hinweis verhält sich wie ein
bestehender Regelverstoß: Er erscheint in der Validierungsliste und
blockiert die Liste als ungültig (Play-Button gesperrt). `warning`/`info`
erscheinen ebenfalls in der Liste, aber rein informativ — sie blockieren
nichts. Dafür bekommt jeder bisherige Validierungseintrag (die heute
existierenden Regelverstöße) ein explizites `severity: 'error'`, und die
Play-Gate-Logik filtert künftig auf `severity === 'error'` statt auf die
bloße Listenlänge.

## Acceptance Criteria
- [ ] Eine Auswahl mit einem bedingungserfüllten `field="error"`-Modifier
      erscheint in der Validierungsliste und blockiert das Spielen (wie ein
      bestehender Regelverstoß).
- [ ] Eine Auswahl mit einem bedingungserfüllten `field="warning"`- oder
      `field="info"`-Modifier erscheint in der Validierungsliste, blockiert
      das Spielen aber nicht.
- [ ] Ist die Bedingung des Modifiers nicht erfüllt, erscheint kein Eintrag.
- [ ] Alle bisherigen Validierungseinträge (Kategorie-/Entry-/Gruppen-
      Limits etc.) tragen weiterhin `severity: 'error'` und blockieren wie
      bisher — keine Regression.
- [ ] Reproduktions-Regressionstest mit realdatennahem Fixture (Bretonnia
      oder Dark Elves „Allow special characters?"-Muster).
- [ ] Die volle Testsuite (`npm test`) bleibt grün.

## Comments
- field=error/warning/info-Modifier werden jetzt ausgewertet: collectTriggeredMessages (modifierEvaluator) sammelt bedingungsgegatet die Autoren-Hinweise, rosterValidator meldet sie mit severity error/warning/info. Play-Gate (isRosterValid/RosterSidebar-Badge) filtert via hasBlockingViolations auf severity==='error' statt Listenlänge. Verbatim-Bretonnia-Fixture (Allow special characters?) plus Regressionstest.
