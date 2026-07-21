Status: needs-triage
Type: fix
Blocked by: None

## Description

**Herkunft:** Nebenbefund aus Kind-Issue 42/04. Der Implementierer stieß darauf,
während er eine ungenutzte Prop-Kette zurückbaute, und hat ihn korrekt gemeldet
statt ihn im laufenden Refactoring mitzuerledigen.

### Fehlverhalten

Die Limitanzeige einer Auswahlgruppe im Editor schreibt die Kosteneinheit
**fest als „Pkt."** in den Text, statt den Kostentyp des Spielsystems zu
verwenden — in `src/components/editor/OptionGroup.jsx` an zwei Stellen (aktuell
Zeile 164 und 166):

```
`${currentPoints} / ${ptsConstraintVal} Pkt.`
`${currentPoints} Pkt.`
```

Überall sonst leitet die Anwendung die Beschriftung aus
`system.costTypes` ab und reicht sie als `costTypeLabel` weiter. Ein Katalog mit
einer anderen Kosteneinheit — BattleScribe erlaubt beliebige Kostentypen, etwa
„Power Level" — zeigt in dieser einen Anzeige trotzdem „Pkt.".

**Erwartet:** Die Gruppen-Limitanzeige nutzt dieselbe abgeleitete Beschriftung
wie der Rest der Oberfläche.

### Zum Zusammenhang mit 42/04

Kind-Issue 42/04 hat die `costTypeLabel`-Prop-Kette bis `OptionGroup` **zurück**
gebaut, weil die Komponente sie entgegennahm, ohne sie je zu lesen — der Linter
meldete sie zu Recht als ungenutzt. Der Rückbau löscht keine Information: die
Prop war schon vorher wirkungslos, der Fehler bestand also bereits.

Die Behebung besteht deshalb **nicht** darin, den Rückbau rückgängig zu machen,
sondern darin, die Beschriftung an dieser Stelle tatsächlich zu *benutzen*.
Ob sie erneut als Prop durchgereicht oder an Ort und Stelle aus dem System
abgeleitet wird, ist eine Entwurfsentscheidung — der Rest des Editors reicht sie
durch, was für Konsistenz spricht.

### Offene Frage für die Triage

Es ist **nicht belegt**, dass ein real genutzter Katalog eine andere
Kosteneinheit als Punkte verwendet. Die WHFB6-Kataloge tun es vermutlich nicht,
womit der Fehler heute unsichtbar wäre. Vor der Umsetzung ist zu klären, ob das
ein tatsächlich beobachtbarer Fehler ist oder eine latente Inkonsistenz — das
entscheidet über die Dringlichkeit und darüber, ob ein Regressionstest sich
sinnvoll gegen echte Katalogdaten stellen lässt.

## Acceptance Criteria
- [ ] Die Gruppen-Limitanzeige zeigt die Kosteneinheit des Spielsystems statt
      einer festgeschriebenen Zeichenkette.
- [ ] Ein Test deckt einen Kostentyp ab, der nicht „Pkt." ist.
- [ ] Die Codebasis enthält keine weitere festgeschriebene Kosteneinheit in der
      Oberfläche (Gegenprobe per Suche).
- [ ] `npm test` grün, `npm run lint` 0 Fehler / 0 Warnungen.

## Comments
