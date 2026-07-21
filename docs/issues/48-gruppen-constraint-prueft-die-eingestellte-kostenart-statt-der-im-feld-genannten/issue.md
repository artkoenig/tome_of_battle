Status: superseded
Type: fix
Blocked by: None

## Description

**Herkunft:** Nebenbefund aus Kind-Issue 47/02. Der Implementierer stieß darauf,
während er die Kostenart-Bezeichnung umstellte, und hat ihn korrekt gemeldet,
statt ihn im laufenden Umbau mitzuerledigen.

### Fehlverhalten

Bei einer Kostenlimit-Constraint auf einer Auswahlgruppe entscheidet
`src/solver/rosterValidator.js` zwei Dinge aus **verschiedenen** Quellen:

- *Ist das überhaupt eine Kostengrenze?* → aus `con.field` (über `isCostField`).
- *Welche Kosten summiere ich?* → immer über `roster.costLimitType`
  (`src/solver/rosterValidator.js:673`).

Nennt eine Constraint eine **andere** Kostenart als die im Roster eingestellte —
etwa „höchstens 5 Zauberwürfel in dieser Gruppe", während die Liste nach Punkten
gebaut wird — summiert der Validator die **Punkte** und vergleicht sie gegen den
Grenzwert für Zauberwürfel. Ergebnis: gemeldete Verstöße, die keine sind, und
übersehene, die welche wären.

### Was 47/02 daran geändert hat — und was nicht

47/02 hat die **Meldung** an den tatsächlich summierten Wert gebunden, damit der
angezeigte Text nicht zu einer Zahl behauptet, sie sei etwas anderes. Das ist
bewusst nur Schadensbegrenzung: der Fehler bleibt sichtbar, statt hinter einer
stimmigen Formulierung zu verschwinden. Die **Ursache** — die Summe über die
falsche Kostenart — ist unangetastet und Gegenstand dieses Issues.

### Offene Frage für die Triage

Es ist **nicht belegt**, dass ein real genutzter Katalog eine Gruppen-Constraint
auf einer Nicht-Punkte-Kostenart führt. Der WHFB6-Fork deklariert mit
`" Casting Dice"` und `" Dispel Dice"` zwar weitere Kostenarten, aber ob eine
Constraint sie als `field` verwendet, ist zu prüfen — per Suche nach
`field="fcec-2340-6368-a2ba"` und `field="6001-b2bf-4529-c07d"` in den `.cat`-
und `.gst`-Dateien des Forks. Das Ergebnis entscheidet über die Dringlichkeit
und darüber, ob sich ein Regressionstest an echte Katalogdaten anlehnen lässt.

### Zusammenhang

Gehört fachlich zu Issue 47 („Kostenart durchgängig aus Katalogdaten"), wurde
aber bewusst nicht mehr in dessen PR gezogen: 47 stellt Wertermittlung und
Bezeichnung um, dies hier ist ein eigenständiger Auswertungsfehler mit eigenem
Risiko. Siehe auch ADR 0003 §3a.

## Acceptance Criteria
- [ ] Belegt oder widerlegt, ob der Fork Gruppen-Constraints auf einer
      Nicht-Punkte-Kostenart führt (Ergebnis im Issue festhalten).
- [ ] Die Summe einer Kostenlimit-Constraint wird über die **im `field`
      genannte** Kostenart gebildet, nicht über `roster.costLimitType`.
- [ ] Die Meldung nennt die Kostenart, die tatsächlich geprüft wurde.
- [ ] Ein Test deckt eine Constraint auf einer anderen Kostenart als der
      eingestellten ab.
- [ ] `npm test` grün, `npm run lint` 0 Fehler / 0 Warnungen.

## Comments
- superseded: Aufgegangen in 49-constraint-kostenart-und-import-ohne-mutation/01, das denselben Fehler spezifiziert und die offene Triage-Frage beantwortet enthaelt (kein realer Katalog fuehrt eine Constraint auf einer Nicht-Punkte-Kostenart; der Fehler ist latent).
