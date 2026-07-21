Status: resolved
Type: fix
Blocked by: None

## Description

Der **Wert** einer Auswahl wird über die Kostenart-id ermittelt, nie über ein
Literal. Enthält außerdem die Fixture-Umstellung, auf der Kind-Issue 02 aufbaut.

### Fehlverhalten

`src/solver/rosterCounter.js:44` und `:47`:

```js
resolved.costs?.find(c => c.typeId === costLimitType || c.typeId === 'pts')
```

Das vergleicht eine **id** gegen einen **Anzeigenamen**. Im geladenen
WHFB6-Katalog lautet die id `ecfa-8486-4f6c-c249` — die Bedingung ist dort nie
wahr. Der als Ersatzwert gedachte Zweig ist im Betrieb **toter Code**.

Zusätzlich ist die `||`-Konstruktion auch dort falsch, wo sie greifen *würde*:
`find` liefert den ersten Eintrag, auf den *irgendeines* der beiden Prädikate
passt, nicht den bevorzugten. Bei lesbaren ids (wh40k-9e: `id="points"`) und der
Reihenfolge `[points, PL]` käme bei eingestelltem `PL` der **points**-Wert
zurück.

`src/solver/rosterCounter.js:163` löst dasselbe Problem bereits korrekt:
`ownCosts[costLimitType] ?? ownCosts[POINTS_COST_TYPE_ID] ?? 0`. Der `find`-Aufruf
in `:44/:47` steht zudem zweimal wortgleich da.

### Warum die Fixtures der eigentliche Kern sind

`src/solver/__fixtures__/grimdarkSystem.js:15` führt `POINTS = 'pts'` als *id*.
Genau deshalb ist der Fehler nie aufgefallen: die Suite deckt einen Pfad ab, den
die Produktion nie nimmt, und bleibt dabei grün. Ohne diese Umstellung würde auch
eine korrigierte Fassung nichts beweisen.

Die Umstellung berührt viele Solver-Tests. Das ist erwartet — es ist der Grund,
weshalb dieses Kind-Issue vor 02 liegt.

### Weitere Fundstellen desselben Literals

- `src/utils/rosterSerialization.js:75` und `:297` — **unschädlich**, weil davor
  bereits der korrekte generische Ersatz `system?.costTypes?.[0]?.id` steht; das
  `'pts'` dahinter ist unerreichbar. Trotzdem entfernen.
- `src/components/PlayMode.jsx:61` — `roster.costLimitType || 'pts'`, dieselbe
  Attrappe ohne vorgeschalteten generischen Ersatz.

### Lösungsansatz

1. Wahrheitsquelle ist `roster.costLimitType` (eine id).
2. Fehlt sie, ist der Ersatz `system.costTypes[0].id` — die erste im Katalog
   deklarierte Kostenart. Genau das tut `rosterSerialization.js` bereits.
3. Fehlt einem Eintrag der Wert dieser Kostenart, ist das Ergebnis **0**, nie der
   Wert einer anderen. Eine Punktzahl anzuzeigen, wo nach Zauberwürfeln gefragt
   wurde, ist kein Ersatzwert, sondern eine falsche Zahl.

Zu entscheiden bei der Umsetzung: ob `POINTS_COST_TYPE_ID`
(`src/solver/rosterCounter.js:12`) damit entfällt. Nach Punkt 2 ist der Ersatz
katalogabgeleitet, nicht literal — die Konstante hätte dann keinen Gegenstand
mehr. Betrifft auch die heute korrekte Stelle `:163`.

Die **Bezeichnung** ist nicht Teil dieses Kind-Issues, sondern von 02.

## Acceptance Criteria
- [ ] `src/solver/rosterCounter.js:44/:47` ermitteln den Wert allein über die
      eingestellte Kostenart-id; der doppelte `find`-Aufruf ist auf einen
      reduziert.
- [ ] Fehlt der Wert dieser Kostenart, ist das Ergebnis 0 — es wird kein Wert
      einer anderen Kostenart eingesetzt.
- [ ] Das Literal `'pts'` kommt in `src/` nicht mehr als Kostenart-id vor
      (`rosterCounter.js`, `rosterSerialization.js:75,297`, `PlayMode.jsx:61`) —
      Gegenprobe per Suche.
- [ ] Die Fixtures verwenden GUID-förmige Kostenart-ids, die **nicht** mit dem
      Anzeigenamen übereinstimmen. Vorschlag: die realen Werte des Forks
      (`ecfa-8486-4f6c-c249` = `pts`, `fcec-2340-6368-a2ba` = `" Casting Dice"`).
- [ ] Ein Test deckt einen Eintrag mit **zwei** Kostenarten in ungünstiger
      Array-Reihenfolge ab und weist nach, dass die eingestellte gewinnt.
- [ ] Ein Test deckt einen Eintrag ab, dem die eingestellte Kostenart fehlt, und
      erwartet 0.
- [ ] `npm test` grün, `npm run lint` 0 Fehler / 0 Warnungen.

## Comments
- Wertermittlung laeuft ausschliesslich ueber die eingestellte Kostenart-id: neue geteilte Ableitung resolveCostLimitTypeId (rosterCounter, ueber die Fassade re-exportiert), doppelter find-Aufruf in getOptionDisplayCost auf einen reduziert, Rueckfall auf 'pts' in rosterCounter/rosterSerialization/PlayMode/OptionGroup/PlayUnitDetails/App entfernt. Fixtures fuehren jetzt GUID-foermige Kostenart-ids (ecfa-... = 'pts', fcec-... = ' Casting Dice'). 13 neue Tests in rosterCounter.costTypeSelection.test.js, davon zwei als belegter Regressionsschutz gegen den alten Rueckfall.
