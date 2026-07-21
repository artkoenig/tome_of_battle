Status: ready-for-agent
Type: fix
Blocked by: None

## Description

Die Anwendung leitet die Kostenart an mehreren Stellen aus festgeschriebenen
Zeichenketten ab statt aus den Katalogdaten — beim **Wert** (`'pts'` als
vermeintliche id) wie bei der **Bezeichnung** (`'Pkt.'`). Dieses Haupt-Issue
fasst beides zusammen; es ersetzt die Issues 44 und 46, die dieselben Dateien
angefasst hätten.

### Der fachliche Kern

`costType/@id` und `costType/@name` sind zwei verschiedene Dinge:

```xml
<costType id="ecfa-8486-4f6c-c249" name="pts"/>     <!-- Deklaration -->
<cost typeId="ecfa-8486-4f6c-c249" value="45.0"/>   <!-- Verweis auf die id -->
```

`cost/@typeId` verweist auf `costType/@id`, niemals auf den Namen. Die `id` ist
vom Katalog-Autor **frei gewählt und nicht standardisiert**: der WHFB6-Fork und
Warpath verwenden GUIDs, Warhammer 40k 9e verwendet `id="points"`. Eine
reservierte id für Punkte gibt es nicht; das BSData-Wiki führt die Verknüpfung
selbst nur als TODO.

Daraus folgt die Regel, die dieses Issue durchsetzt: **weder eine id noch ein
Name wird im Code festgeschrieben.**

Quellen: [BSData Wiki – Data structure overview](https://github.com/BSData/catalogue-development/wiki/Data-structure-overview),
[wh40k-9e Warhammer 40,000.gst](https://github.com/BSData/wh40k-9e/blob/master/Warhammer%2040,000.gst).

### Der geladene Katalog führt mehrere Kostenarten

Der Fork (ADR 0017/0018) deklariert drei — der Fehler ist also gegen echte Daten
testbar und nicht bloß theoretisch:

```xml
<costTypes>
  <costType id="ecfa-8486-4f6c-c249" name="pts"/>
  <costType id="fcec-2340-6368-a2ba" name=" Casting Dice"/>
  <costType id="6001-b2bf-4529-c07d" name=" Dispel Dice"/>
</costTypes>
```

Zu beachten: die Namen tragen **führende Leerzeichen** und müssen für die Anzeige
getrimmt werden.

### Entscheidung: keine Übersetzung der Bezeichnung

Heute lesen `src/components/RosterEditor.jsx:71-73` und
`src/components/RosterDashboard.jsx:159-161` die Bezeichnung zwar aus dem
Katalog, ersetzen sie danach aber: heißt sie `pts`, `points` oder `punkte`, wird
`Pkt.` angezeigt.

**Der Maintainer hat entschieden, diese Übersetzung ersatzlos zu entfernen.** Die
Oberfläche zeigt künftig `pts` statt `Pkt.` — das ist gewollt und **keine
Regression**. Damit entfallen `POINT_COST_TYPE_ALIASES` und
`POINT_COST_TYPE_LABEL` vollständig.

### Warum ein Haupt-Issue statt zwei

Beide Teile fassen `rosterCounter.js`, `rosterValidator.js`, `RosterEditor.jsx`,
`RosterDashboard.jsx`, `PlayMode.jsx` und die Fixtures an. Entscheidend ist die
Fixture-Umstellung aus Kind-Issue 01: die Testdaten führen `'pts'` bislang
abkürzend als *id*, weshalb die Suite den realen Fall nie abgedeckt hat. Diese
Umstellung berührt praktisch jeden Solver-Test — und Kind-Issue 02 braucht genau
diese neuen Fixtures, um einen Kostentyp wie `" Casting Dice"` prüfen zu können.
Zwei getrennte PRs hätten dieselben Dateien zweimal angefasst.

Herkunft: Neubewertung gegen `architecture-principles` /
`code-generation-principles` vom 2026-07-21, Befunde 1 und 3 von 8.
Ersetzt Issue 44 und Issue 46.

## Acceptance Criteria
- [ ] Weder eine Kostenart-id noch eine Kostenart-Bezeichnung ist irgendwo in
      `src/` festgeschrieben — Gegenprobe per Suche, Oberfläche *und* Solver.
- [ ] Die Ableitung „Kostenart-id → Bezeichnung" existiert genau einmal als
      geteilte Hilfsfunktion.
- [ ] Die Testdaten verwenden realistische, GUID-förmige Kostenart-ids.
- [ ] Ein Test deckt einen Kostentyp ab, der nicht Punkte ist — samt führendem
      Leerzeichen im Namen.
- [ ] `npm test` grün, `npm run lint` 0 Fehler / 0 Warnungen.
- [ ] Screenshots von Editor, Dashboard und Spielmodus belegen die geänderte
      Beschriftung.

## Comments
