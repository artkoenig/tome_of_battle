Status: ready-for-agent
Type: fix
Blocked by: None

## Description

Übernimmt Issue 48 unverändert im Kern, ergänzt um das Ergebnis der dort
offenen Triage-Frage.

### Fehlverhalten

Bei einer Kostenlimit-Constraint auf einer **Auswahlgruppe** entscheidet
`src/solver/rosterValidator.js` zwei Dinge aus **verschiedenen** Quellen:

- *Ist das überhaupt eine Kostengrenze?* → aus `con.field`, über `isCostField`
  (`src/solver/rosterValidator.js:680`).
- *Welche Kosten summiere ich?* → immer über `roster.costLimitType`
  (`src/solver/rosterValidator.js:674`).

Nennt eine Constraint eine **andere** Kostenart als die im Roster eingestellte —
etwa „höchstens 5 Zauberwürfel in dieser Gruppe", während die Liste nach Punkten
gebaut wird — summiert der Validator die **Punkte** und vergleicht sie gegen den
Grenzwert für Zauberwürfel. Ergebnis: gemeldete Verstöße, die keine sind, und
übersehene, die welche wären.

### Der Fix ist klein und hat zwei Vorbilder im selben Modul

Diese Stelle ist der **einzige** Ausreißer. Beide vergleichbaren Pfade machen es
bereits richtig und summieren über `con.field`:

- `src/solver/rosterValidator.js:552-554` — dieselbe Prüfung auf Ebene eines
  einzelnen Eintrags.
- `src/solver/constraintScope.js:91-100` (`getScopeReferenceTotal`) — die
  Referenzgröße einer Prozent-Constraint.

Die übrigen `roster.costLimitType`-Stellen im Validator (`:157`, `:160`, `:284`)
sind korrekt: sie prüfen das Roster-Budget bzw. ein forceEntry-Limit und haben
gar kein `con.field`, an dem sie sich orientieren könnten. Sie bleiben unberührt.

### Ergebnis der Triage-Frage aus Issue 48: der Fehler ist latent

Issue 48 ließ offen, ob ein real genutzter Katalog eine Gruppen-Constraint auf
einer Nicht-Punkte-Kostenart führt. **Antwort: nein.** Gegenprobe über alle
`.cat`- und `.gst`-Dateien des WHFB6-Forks:

| `constraint field=` | Vorkommen |
| --- | --- |
| `selections` | 10647 |
| `ecfa-8486-4f6c-c249` (pts) | 384 |
| `limit::ecfa-8486-4f6c-c249` (pts) | 2 |

Die 15 Treffer auf `fcec-2340-6368-a2ba` (`" Casting Dice"`) und
`6001-b2bf-4529-c07d` (`" Dispel Dice"`) sind ausnahmslos **Modifier**
(`<modifier type="increment|decrement" field="…">`), keine Constraints — sie
verändern Kosten, sie prüfen keine Grenze.

Daraus folgen zwei Dinge:

1. Der Fehler ist heute **nicht auslösbar**. Er wird es, sobald der Fork eine
   solche Grenze bekommt oder ein anderes Spielsystem geladen wird — beides ist
   nach ADR 0017/0018 vorgesehen. Behoben wird er, weil er falsch ist, nicht
   weil er brennt.
2. Der Regressionstest muss auf **Fixtures** aufbauen. Echte Katalogdaten geben
   den Fall nicht her. Die Fixtures aus Issue 47 führen mit
   `CASTING_DICE` bereits eine zweite Kostenart und tragen den Test.

### Zusammenhang

Setzt Issue 47 („Kostenart durchgängig aus Katalogdaten") fort. 47 hat die
**Meldung** an den tatsächlich summierten Wert gebunden, damit der angezeigte
Text nicht zu einer Zahl behauptet, sie sei etwas anderes — bewusst nur
Schadensbegrenzung. Die **Ursache** ist Gegenstand dieses Kind-Issues. Siehe
ADR 0003 §3a.

## Acceptance Criteria
- [ ] Die Summe einer Gruppen-Kostenlimit-Constraint wird über die im
      `con.field` genannte Kostenart gebildet, nicht über
      `roster.costLimitType` (`src/solver/rosterValidator.js:674`).
- [ ] Die Meldung nennt die Kostenart, die tatsächlich geprüft wurde — der
      Kommentar bei `:688-689`, der die Bindung an die Roster-Kostenart
      begründet, ist entsprechend angepasst oder entfällt.
- [ ] Ein Test deckt eine Gruppen-Constraint auf einer **anderen** Kostenart als
      der eingestellten ab (Vorschlag: `CASTING_DICE` bei nach Punkten gebauter
      Liste) und weist nach, dass die richtige Kostenart summiert wird.
- [ ] Ein Test weist nach, dass die Prozent-Variante desselben Pfades
      (`checkGroupPercentConstraint`) ebenfalls die richtige Kostenart misst.
- [ ] Die drei korrekten `roster.costLimitType`-Stellen (`:157`, `:160`, `:284`)
      sind unverändert.
- [ ] `npm test` grün, `npm run lint` 0 Fehler / 0 Warnungen.

## Comments
