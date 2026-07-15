Status: resolved
Blocked by: None

## Description

**Typ:** Datenfehler in den BattleScribe-Katalogen.

**Beobachtung:** **72 Namen** in `public/catalogs/whfb6/` tragen ein führendes
oder nachgestelltes Leerzeichen — `'Armour of Damnation '`, `'Asp Bow '`,
`'Bane Shield '`, `'Berserker Sword '`, `'Cavalry hammer '`. Die Namensauflösung
vergleicht exakt (nur klein geschrieben, ohne Trim), weshalb solche Einträge
keinen Treffer im Regel-Index finden, obwohl die Seite existiert.

**Konkrete Auswirkung heute:** **5 Regeln** scheitern allein am Leerzeichen und
wären sofort verlinkbar:

| Katalogname | vorhandene Seite |
|---|---|
| `'Cavalry hammer '` | `/weapons/cavalry-hammer` |
| `'Repeater Handgun '` | `/weapons/repeater-handgun` |
| `'Repeater Pistol '` | `/weapons/repeater-pistol` |
| `'Chariot of the Gods '` | `/special-rules/chariot-of-the-gods` |
| `'Crazed! '` | `/special-rules/crazed` |

Die übrigen 67 betroffenen Namen sind armeespezifische Gegenstände; sie profitieren
erst, wenn deren Einzelseiten erschlossen sind (Issue 10/02). Danach steigt der
Nutzen dieser Bereinigung deutlich — der Zusammenhang sollte bei der Umsetzung
neu gemessen werden.

**Warum in den Katalogdaten und nicht im Lookup:** Ein `trim()` in der
Namensauflösung würde das Symptom verdecken und die fehlerhaften Daten
konservieren. Die Leerzeichen sind ein Datenfehler und wirken sich auch außerhalb
der Regel-Verlinkung aus (Anzeige, Vergleiche, Sortierung). Konsistent mit der
Projektlinie, Datenlücken in den `.cat`/`.gst`-Dateien zu beheben statt per
App-Heuristik.

**Zu klären bei der Triage:** Die Kataloge stammen aus BSData (upstream). Zu
entscheiden ist, ob die Korrektur lokal erfolgt oder upstream eingereicht wird,
und wie sie einen künftigen Katalog-Import übersteht.

## Acceptance Criteria
- [ ] Kein Name in `public/catalogs/whfb6/` trägt ein führendes oder
      nachgestelltes Leerzeichen.
- [ ] Die fünf genannten Regeln (`Cavalry hammer`, `Repeater Handgun`,
      `Repeater Pistol`, `Chariot of the Gods`, `Crazed!`) sind im Editor
      verlinkt (E2E in der laufenden App geprüft).
- [ ] Die Namensauflösung bleibt unverändert — kein `trim()` als Workaround.
- [ ] Keine Regression: Punktekosten, Validierung und Anzeige der betroffenen
      Einträge verhalten sich wie zuvor.
- [ ] Der Umgang mit künftigen Katalog-Importen ist entschieden und festgehalten.
- [ ] Volle Suite grün.

## Comments
- Gefunden bei der Analyse zu Issue 10 (Regel-Index-Abdeckung).
- Issue 11 implementiert: Alle ueberfluessigen Leerzeichen in name-Attributen der Katalogdateien entfernt (6049 Fixes in 17 Dateien).

Vorgehen: Python-Script trimmt führende/nachgestellte Leerzeichen in allen name="..."-Attributen in public/catalogs/whfb6/*.cat und *.gst.

Ergebnisse:
- Cavalry hammer (vorher "Cavalry hammer ", jetzt "Cavalry hammer")
- Repeater Handgun, Repeater Pistol (vorher mit trailing space)
- Chariot of the Gods, Crazed! (vorher mit trailing space)
- Auch Cost-Namen wie " Casting Dice", " Dispel Dice" bereinigt.
- Kein trim() in der Namensaufloesung (rulesLookup.js) – Fix rein in Katalogdaten.
- 301 Tests gruen, Lint sauber.
