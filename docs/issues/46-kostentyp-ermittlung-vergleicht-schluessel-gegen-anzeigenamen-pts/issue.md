Status: superseded
Type: fix
Blocked by: None

## Description

**Herkunft:** Neubewertung gegen `architecture-principles` /
`code-generation-principles` vom 2026-07-21, Befund 1 von 8 (schwerwiegendster).

### Fehlverhalten

`src/solver/rosterCounter.js:44` und `:47` ermitteln den Kostenwert eines
Eintrags so:

```js
resolved.costs?.find(c => c.typeId === costLimitType || c.typeId === 'pts')
```

Das vergleicht einen **Schlüssel** gegen einen **Anzeigenamen**. In den
BattleScribe-Daten sind das zwei verschiedene Dinge:

```xml
<costType id="ecfa-8486-4f6c-c249" name="pts"/>     <!-- Deklaration -->
<cost typeId="ecfa-8486-4f6c-c249" value="45.0"/>   <!-- Verweis auf die id -->
```

`cost/@typeId` verweist auf `costType/@id`, niemals auf den Namen. Im vom Fork
geladenen WHFB6-Katalog lautet die id `ecfa-8486-4f6c-c249` — die Bedingung
`c.typeId === 'pts'` ist dort **nie** wahr.

### Warum das schlimmer ist als ein falsches Ergebnis

Der als Sicherheitsnetz gedachte Zweig ist im Betrieb **toter Code**. Er greift
ausschließlich in den Testdaten der App, weil `src/solver/__fixtures__/grimdarkSystem.js:15`
abkürzend `POINTS = 'pts'` als *id* verwendet. Die Tests bestätigen damit einen
Pfad, den die Produktion nie nimmt — der beabsichtigte Ersatzwert existiert
schlicht nicht, und die grüne Suite verdeckt es.

Zusätzlich ist die `||`-Konstruktion auch dort falsch, wo sie greifen *würde*:
`find` liefert den ersten Eintrag, auf den *irgendeines* der beiden Prädikate
passt — nicht den bevorzugten. Bei einem Katalog mit lesbaren ids (Warhammer 40k
9e verwendet `id="points"`) und der Kostenreihenfolge `[points, PL]` käme bei
eingestelltem `PL` der **points**-Wert zurück.

Dieselbe Datei löst dasselbe Problem in `src/solver/rosterCounter.js:163` bereits
korrekt:

```js
ownCosts[costLimitType] ?? ownCosts[POINTS_COST_TYPE_ID] ?? 0
```

Die dafür vorgesehene Konstante `POINTS_COST_TYPE_ID` (`src/solver/rosterCounter.js:12`)
wird in `:44/:47` nicht genutzt. Ebenfalls dort: derselbe `find`-Aufruf steht
zweimal wortgleich da (`:44` und `:47`).

### Weitere Fundstellen desselben Literals

- `src/utils/rosterSerialization.js:75` und `:297` — hier **unschädlich**, weil
  davor bereits der korrekte generische Ersatz `system?.costTypes?.[0]?.id`
  steht; das `'pts'` dahinter ist unerreichbar. Trotzdem entfernen.
- `src/components/PlayMode.jsx:61` — `roster.costLimitType || 'pts'`, dieselbe
  Attrappe ohne vorgeschalteten generischen Ersatz.

### Fachlicher Hintergrund

`costType/@id` ist vom Katalog-Autor frei gewählt und **nicht standardisiert**.
Belegt sind drei verschiedene Konventionen: WHFB6-Fork und Warpath verwenden
GUIDs, Warhammer 40k 9e verwendet `id="points"`. Eine reservierte id für Punkte
gibt es nicht; das BSData-Wiki führt die Verknüpfung selbst nur als TODO. Es darf
deshalb **nie** eine id im Code festgeschrieben werden.

Quellen: [BSData Wiki – Data structure overview](https://github.com/BSData/catalogue-development/wiki/Data-structure-overview),
[wh40k-9e Warhammer 40,000.gst](https://github.com/BSData/wh40k-9e/blob/master/Warhammer%2040,000.gst).

### Lösungsansatz

1. Wahrheitsquelle für die Kostenart ist `roster.costLimitType` (eine id).
2. Fehlt sie, ist der Ersatz `system.costTypes[0].id` — die erste im Katalog
   deklarierte Kostenart. Genau das tut `rosterSerialization.js` bereits.
3. Fehlt einem Eintrag der Kostenwert dieser Art, ist das Ergebnis **0** — nie
   der Wert einer anderen Kostenart. Eine Punktzahl anzuzeigen, wo nach
   Zauberwürfeln gefragt wurde, ist kein Ersatzwert, sondern eine falsche Zahl.
4. Kein Literal `'pts'` bleibt im Code zurück.

Offen für die Triage: ob `POINTS_COST_TYPE_ID` (`:12`) damit ebenfalls entfällt.
Nach Punkt 2 ist der Ersatz katalogabgeleitet, nicht literal — die Konstante
hätte dann keinen Gegenstand mehr. Betrifft auch die korrekte Stelle `:163`.

Die **Anzeige** der Kostenbezeichnung ist bewusst nicht Teil dieses Issues,
sondern in Issue 44 erfasst.

## Acceptance Criteria
- [ ] `src/solver/rosterCounter.js:44/:47` ermitteln den Kostenwert allein über
      die eingestellte Kostenart-id; der doppelte `find`-Aufruf ist auf einen
      reduziert.
- [ ] Fehlt der Kostenwert dieser Art, ist das Ergebnis 0 — es wird kein Wert
      einer anderen Kostenart eingesetzt.
- [ ] Das Literal `'pts'` kommt in `src/` nicht mehr als Kostenart-id vor
      (`src/solver/rosterCounter.js`, `src/utils/rosterSerialization.js:75,297`,
      `src/components/PlayMode.jsx:61`) — Gegenprobe per Suche.
- [ ] Die Testdaten verwenden als Kostenart-id keinen Wert mehr, der zufällig mit
      dem Anzeigenamen übereinstimmt — sonst deckt die Suite den echten Fall
      weiterhin nicht ab. Vorschlag: die reale id `ecfa-8486-4f6c-c249`.
- [ ] Ein Test deckt einen Eintrag mit **zwei** Kostenarten in ungünstiger
      Array-Reihenfolge ab und weist nach, dass die eingestellte gewinnt.
- [ ] Ein Test deckt einen Eintrag ab, dem die eingestellte Kostenart fehlt, und
      erwartet 0.
- [ ] `npm test` grün, `npm run lint` 0 Fehler / 0 Warnungen.

## Comments
- Abgetrennt von Issue 44: dort die Anzeige-Bezeichnung, hier die Wertermittlung. Beide beruhen auf derselben Recherche zu costType/@id vs. @name.
- superseded: Aufgegangen in 47-kostenart-durchgaengig-aus-katalogdaten/01: dieselbe Anforderung, gemeinsam mit der Bezeichnung geschnitten.
