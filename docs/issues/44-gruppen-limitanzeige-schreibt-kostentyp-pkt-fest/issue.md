Status: superseded
Type: fix
Blocked by: None

## Description

**Herkunft:** Nebenbefund aus Kind-Issue 43/04. Der Implementierer stieß darauf,
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

### Zum Zusammenhang mit 43/04

Kind-Issue 43/04 hat die `costTypeLabel`-Prop-Kette bis `OptionGroup` **zurück**
gebaut, weil die Komponente sie entgegennahm, ohne sie je zu lesen — der Linter
meldete sie zu Recht als ungenutzt. Der Rückbau löscht keine Information: die
Prop war schon vorher wirkungslos, der Fehler bestand also bereits.

Die Behebung besteht deshalb **nicht** darin, den Rückbau rückgängig zu machen,
sondern darin, die Beschriftung an dieser Stelle tatsächlich zu *benutzen*.
Ob sie erneut als Prop durchgereicht oder an Ort und Stelle aus dem System
abgeleitet wird, ist eine Entwurfsentscheidung — der Rest des Editors reicht sie
durch, was für Konsistenz spricht.

### Offene Frage für die Triage — beantwortet am 2026-07-21

Die ursprüngliche Frage lautete, ob ein real genutzter Katalog überhaupt eine
andere Kosteneinheit als Punkte führt. **Er tut es.** Der von der App geladene
Fork (ADR 0017/0018) deklariert drei Kostenarten:

```xml
<costTypes>
  <costType id="ecfa-8486-4f6c-c249" name="pts"/>
  <costType id="fcec-2340-6368-a2ba" name=" Casting Dice"/>
  <costType id="6001-b2bf-4529-c07d" name=" Dispel Dice"/>
</costTypes>
```

Der Fehler ist damit keine latente Inkonsistenz mehr, sondern gegen echte
Katalogdaten testbar.

### Erweiterter Geltungsbereich (2026-07-21)

Der Geltungsbereich wird von „in der Oberfläche" auf die **gesamte Codebasis**
ausgeweitet. Anlass: die Neubewertung gegen `architecture-principles` /
`code-generation-principles` hat festgeschriebene Kosteneinheiten auch in der
Solver-Schicht gefunden, wo sie beim ursprünglichen Kriterium durchs Raster
gefallen wären — Validierungsmeldungen entstehen dort, nicht in der Oberfläche:

- `src/solver/rosterValidator.js:690` und `:698` („Pkt.")
- `src/solver/rosterValidator.js:559` und `:732` („Punkte")

### Entscheidung: keine Übersetzung der Bezeichnung

Heute lesen `src/components/RosterEditor.jsx:71-73` und
`src/components/RosterDashboard.jsx:159-161` die Bezeichnung zwar aus dem
Katalog, ersetzen sie danach aber: heißt sie `pts`, `points` oder `punkte`, wird
stattdessen `Pkt.` angezeigt (`POINT_COST_TYPE_ALIASES` /
`POINT_COST_TYPE_LABEL`, in der Dashboard-Variante als kopierte Bedingung
dupliziert).

**Der Maintainer hat entschieden, diese Übersetzung ersatzlos zu entfernen.** Die
im Katalog hinterlegte Bezeichnung wird unverändert angezeigt. Die deutsche
Oberfläche zeigt künftig also `pts` statt `Pkt.` — das ist gewollt und keine
Regression.

Damit entfallen `POINT_COST_TYPE_ALIASES` und `POINT_COST_TYPE_LABEL`
vollständig; es bleibt eine einzige Ableitung „id → Bezeichnung aus
`system.costTypes`".

### Fachlicher Hintergrund (recherchiert am 2026-07-21)

`costType/@id` und `costType/@name` sind zwei verschiedene Dinge: die `id` ist
der Schlüssel, auf den `cost/@typeId` verweist, der `name` ist reine Anzeige.
Die `id` ist vom Katalog-Autor frei gewählt und **nicht standardisiert** — der
WHFB6-Fork und Warpath verwenden GUIDs, Warhammer 40k 9e verwendet `id="points"`.
Eine reservierte id für Punkte gibt es nicht; das BSData-Wiki führt die
Verknüpfung selbst nur als TODO. Es darf deshalb **nie** eine id oder ein Name
im Code festgeschrieben werden.

Achtung bei der Anzeige: die Namen tragen im Katalog teils **führende
Leerzeichen** (`" Casting Dice"`, bei 40k `" PL"`) und müssen getrimmt werden.

Quellen: [BSData Wiki – Data structure overview](https://github.com/BSData/catalogue-development/wiki/Data-structure-overview),
[wh40k-9e Warhammer 40,000.gst](https://github.com/BSData/wh40k-9e/blob/master/Warhammer%2040,000.gst).

Der zugehörige **Rechenfehler** (Vergleich einer id gegen den Namen `'pts'` in
`src/solver/rosterCounter.js`) ist bewusst **nicht** Teil dieses Issues, sondern
in Issue 46 erfasst.

## Acceptance Criteria
- [ ] Die Gruppen-Limitanzeige zeigt die Kosteneinheit des Spielsystems statt
      einer festgeschriebenen Zeichenkette.
- [ ] Die Bezeichnung wird unverändert aus `system.costTypes[].name` übernommen,
      lediglich getrimmt — keine Alias-Übersetzung mehr.
- [ ] `POINT_COST_TYPE_ALIASES` und `POINT_COST_TYPE_LABEL` sind entfernt; die
      duplizierte Variante in `src/components/RosterDashboard.jsx:160-161` ist
      mit entfallen.
- [ ] Die Ableitung „id → Bezeichnung" existiert genau einmal als geteilte
      Hilfsfunktion.
- [ ] Auch die Validierungsmeldungen in `src/solver/rosterValidator.js`
      (`:559`, `:690`, `:698`, `:732`) verwenden die Bezeichnung des
      Spielsystems.
- [ ] Ein Test deckt einen Kostentyp ab, der nicht „pts" ist — etwa
      `" Casting Dice"` aus dem WHFB6-Fork, samt führendem Leerzeichen.
- [ ] Die **Codebasis** enthält keine festgeschriebene Kosteneinheit mehr
      (Gegenprobe per Suche, Oberfläche *und* Solver).
- [ ] `npm test` grün, `npm run lint` 0 Fehler / 0 Warnungen.

## Comments
- Geltungsbereich am 2026-07-21 von 'Oberflaeche' auf die gesamte Codebasis erweitert (Validierungsmeldungen im Solver). Maintainer-Entscheidung: die Katalog-Bezeichnung wird unveraendert angezeigt, die Alias-Uebersetzung nach 'Pkt.' entfaellt ersatzlos. Der zugehoerige Rechenfehler ist als Issue 46 abgetrennt.
- superseded: Aufgegangen in 47-kostenart-durchgaengig-aus-katalogdaten/02: dieselbe Anforderung, aber gemeinsam mit der Wertermittlung geschnitten, weil beide dieselben Dateien und dieselben Fixtures anfassen.
