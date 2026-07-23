Status: superseded
Type: feature
Blocked by: [02]

## Description

Erweitert Issue 58 auf die Options-Familien und räumt die dadurch berührte
ADR-0022-Mechanik auf.

Die Familien `entry-min`/`entry-max` (und die Prozent-Varianten
`entry-percent-min`/`-max`) erhalten strukturierte Felder und werden über die
zentrale Kompositions-Stelle (aus Issue 02) formuliert — gemäß der verbindlichen
Ton-Vorgabe im PRD des Main-Issues 58. Für diese Familie gilt: bei einzelnen
Einträgen wird um den Eintragsnamen herum formuliert (nicht „Auswahl"):

- Eintrag max: `Commander darf „Hand Weapon" höchstens einmal wählen.`
  (max = 0: `Commander darf „Shield" nicht wählen.`)
- Eintrag min: `Commander braucht mindestens eine „Hand Weapon".`
- Prozent: `„Handlanger" dürfen höchstens 50 % der Punkte ausmachen.`

Besonderheit: `stripHypotheticalCount` (ADR 0022, `entryAvailability.js`) kappt
heute per **Regex** auf den deutschen Wortlaut „(aktuell: N)" den hypothetischen
Zählwert — aber nur auf dem Anzeigepfad des Aushebe-Dialogs, nicht an der
Validierungspanel. Sobald diese Meldungen aus strukturierten Feldern entstehen,
ist der Regex fragil bzw. überflüssig: Er wird durch eine Logik auf Basis der
**strukturierten Felder** ersetzt. Das bisherige Verhalten (Kappen des
hypothetischen Werts genau auf dem Dialogpfad, Validierungspanel unberührt) bleibt
unverändert erhalten.

Reine Darstellung: keine Änderung an der Verfügbarkeits-/Validierungslogik.

## Acceptance Criteria
- [ ] `entry-min`/`entry-max` (+ Prozent-Varianten) tragen strukturierte Felder
      und werden über die zentrale Komposition in Alltagssprache angezeigt.
- [ ] `stripHypotheticalCount` arbeitet nicht mehr über einen Wortlaut-Regex,
      sondern über die strukturierten Felder; der bisherige String-Regex auf
      „(aktuell: N)" ist entfernt.
- [ ] Das Kappen des hypothetischen Zählwerts geschieht weiterhin nur auf dem
      Aushebe-Dialogpfad; die Validierungspanel-Anzeige ist unverändert.
- [ ] Menge und Wahrheit der Verstöße dieser Familien sind unverändert
      (keine Logikänderung).
- [ ] Tests decken die Komposition dieser Familien und den erhaltenen
      Kappungs-Effekt im Aushebe-Dialog ab; volle Suite grün.

## Comments
- superseded: stripHypotheticalCount ist auf main bereits durch sprachneutrales stripCurrentCountClause/omitCurrentCount abgeloest (i18n-PR #114).
