Status: ready-for-agent
Type: fix
Blocked by: [01]

## Description

Die **Bezeichnung** der Kostenart kommt unverändert aus dem Katalog. Baut auf den
Fixtures aus Kind-Issue 01 auf, weil erst die einen Kostentyp mit dem realen
Namen `" Casting Dice"` prüfbar machen.

### Ausgangslage

Zwei Stellen lesen die Bezeichnung bereits aus dem Katalog, übersetzen sie danach
aber:

- `src/components/RosterEditor.jsx:13-15` und `:71-73` — als benannte Konstanten
  `POINT_COST_TYPE_ALIASES` / `POINT_COST_TYPE_LABEL` mit erklärendem Kommentar.
- `src/components/RosterDashboard.jsx:159-161` — dieselbe Logik als kopierte
  Bedingung roh im JSX.

Weitere Stellen fragen den Katalog **gar nicht erst** und schreiben die Einheit
fest:

- `src/components/editor/OptionGroup.jsx:164` und `:166` — „Pkt." in der
  Gruppen-Limitanzeige. Kind-Issue 43/04 hatte die `costTypeLabel`-Prop hier
  zurückgebaut, weil die Komponente sie entgegennahm, ohne sie je zu lesen; der
  Rückbau löschte keine Information, der Fehler bestand schon vorher.
- `src/solver/rosterValidator.js:690` und `:698` — „Pkt." in Validierungsmeldungen.
- `src/solver/rosterValidator.js:559` und `:732` — „Punkte" in Validierungsmeldungen.

Die Meldungen des Validators sind der Grund, weshalb der Geltungsbereich nicht
auf die Oberfläche beschränkt bleiben darf: sie entstehen eine Schicht tiefer und
wären bei einer reinen UI-Prüfung durchs Raster gefallen.

### Entscheidung: ersatzlos keine Übersetzung

**Der Maintainer hat entschieden, die Alias-Übersetzung zu entfernen.** Die
Katalog-Bezeichnung wird unverändert angezeigt; `POINT_COST_TYPE_ALIASES` und
`POINT_COST_TYPE_LABEL` entfallen vollständig.

Die deutsche Oberfläche zeigt danach **`pts` statt `Pkt.`** Das ist gewollt und
**keine Regression** — nicht zurückbauen.

### Zu beachten

Die Namen tragen im Katalog **führende Leerzeichen** (`" Casting Dice"`,
`" Dispel Dice"`; bei wh40k-9e `" PL"`) und müssen für die Anzeige getrimmt
werden. Das Trimmen ist die einzige zulässige Veränderung der Bezeichnung.

Ob die Bezeichnung erneut als Prop durchgereicht oder an Ort und Stelle
abgeleitet wird, ist eine Entwurfsentscheidung — der Rest des Editors reicht sie
durch, was für Konsistenz spricht.

## Acceptance Criteria
- [ ] Die Bezeichnung wird unverändert aus `system.costTypes[].name` übernommen,
      lediglich getrimmt — keine Alias-Übersetzung mehr.
- [ ] `POINT_COST_TYPE_ALIASES` und `POINT_COST_TYPE_LABEL` sind entfernt; die
      duplizierte Variante in `src/components/RosterDashboard.jsx:160-161` ist
      mit entfallen.
- [ ] Die Ableitung „Kostenart-id → Bezeichnung" existiert genau einmal als
      geteilte Hilfsfunktion.
- [ ] Die Gruppen-Limitanzeige (`src/components/editor/OptionGroup.jsx:164,166`)
      zeigt die Bezeichnung des Spielsystems.
- [ ] Die Validierungsmeldungen in `src/solver/rosterValidator.js`
      (`:559`, `:690`, `:698`, `:732`) verwenden die Bezeichnung des
      Spielsystems.
- [ ] `src/` enthält keine festgeschriebene Kostenart-Bezeichnung mehr —
      Gegenprobe per Suche, Oberfläche *und* Solver.
- [ ] Ein Test deckt einen Kostentyp ab, der nicht Punkte ist, samt führendem
      Leerzeichen im Namen.
- [ ] `npm test` grün, `npm run lint` 0 Fehler / 0 Warnungen.
- [ ] Screenshots von Editor, Dashboard und Spielmodus belegen die geänderte
      Beschriftung.

## Comments
- Umfang erweitert nach einem Fund aus 47/01: src/solver/constraintScope.js:23-24 schreibt POINTS_COST_FIELD='pts' und LEGACY_POINTS_COST_TYPE_ID='ecfa-8486-4f6c-c249' fest. Gegenprobe gegen den geladenen Fork: field="pts" kommt in .gst und .cat NULL mal vor; field="ecfa-8486-4f6c-c249" kommt haeufig vor (Bretonnia 13, Chaos 66, Dwarfs 19, Empire 14, Lizardmen 10), ist aber in costTypes deklariert und wird daher bereits vom letzten Zweig der Funktion erfasst. Beide Aliase sind fuer die realen Daten also redundant bzw. tot. Vorsicht: sie waren defensiv fuer Daten gedacht, die eine Kostenart nicht deklarieren — vor dem Entfernen ist zu pruefen, ob isCostField ohne sie fuer undeklarierte Felder noch richtig antwortet.
