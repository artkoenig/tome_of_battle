Status: ready-for-agent
Type: feature
Blocked by: [02]

## Description

Erweitert Issue 58 auf die Options-Familien und räumt die dadurch berührte
ADR-0022-Mechanik auf.

Die Familien `entry-min`/`entry-max` (und die Prozent-Varianten
`entry-percent-min`/`-max`) erhalten strukturierte Felder und werden über die
zentrale Kompositions-Stelle (aus Issue 02) in Alltagssprache formuliert.

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
