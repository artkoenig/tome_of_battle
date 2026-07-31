---
status: backlog
branch:
pr:
---

# Katalog-Attribut sortIndex für Sektions-/Optionsreihenfolge auf der Einheitenkarte nutzen

## Intent

Katalogdaten (`.cat`/`.gst`) enthalten ein Attribut `sortIndex` auf
`selectionEntry`, `selectionEntryGroup` und `entryLink` (bestätigt u.a. in der
Vampire-Counts-6th-definitive-Fixture; kein Teil der offiziellen
`Catalogue.xsd`, aber verbreitete Community-Konvention für die vom
Katalogautor empfohlene Anzeigereihenfolge). Es wird heute nirgends gelesen
oder verwendet — weder von `src/parser/xmlParser.js` (Attribut-Whitelist ohne
`sortIndex`, kein `SORT_INDEX` im `AttributeName`-Enum in
`battlescribeSchema.generated.js`) noch vom Evaluator-Reader
`src/evaluator/catalogReader.js` (liest ebenfalls nur eine feste
Attributliste, kein `sortIndex`).

Konkret betroffen ist die Reihenfolge auf der Einheitenkarte im Editor
(`SelectionConfigurator.jsx` + `OptionGroup.jsx`):

- **Sektionsreihenfolge** (`SelectionConfigurator.buildSections()`): Sektionen
  wie "General", "Magische Gegenstände", "Ausrüstung" entstehen heute in der
  Reihenfolge, in der `childSlotsOf(capabilities, framePath)` sie liefert. Das
  ist NICHT reine XML-Dokumentreihenfolge, sondern die Reihenfolge aus
  `src/evaluator/catalogReader.js#readSelectionChildren`, die nach
  Elementtyp gruppiert (erst alle `selectionEntry`, dann alle
  `selectionEntryGroup`, dann alle `entryLink`, dann `categoryLink`), jeweils
  intern in Dokumentreihenfolge. Diese Reihenfolge zieht sich unverändert
  durch `evalTree.js` → `report.js` → `capabilities`-Map bis zu
  `childSlotsOf` in `src/evaluation/slotLookups.js` (Map-Insert-Reihenfolge =
  Baumreihenfolge, laut Code-Kommentar dort bewusst unverändert übernommen).
- **Optionsreihenfolge innerhalb einer Sektion** (`OptionGroup.jsx` Zeile
  ~149): sortiert heute bewusst absteigend nach Punktkosten
  (`.slice().sort((a,b) => pointsOf(b)-pointsOf(a))`).

Gewünschtes Verhalten: Wo der Katalogautor `sortIndex` gesetzt hat, soll er
die Anzeigereihenfolge auf der Einheitenkarte bestimmen — sowohl für die
Sektionen selbst als auch für die Optionen innerhalb einer Sektion.

### Recherche-Befunde (Fakten, keine Entscheidungen)

- `sortIndex` ist in echten Katalogen ein kleiner nicht-negativer Integer als
  String (Werte 0–6 in allen geprüften Fixtures), aber **lückenhaft**
  gesetzt: z.B. Mercenaries.cat hat 968 selectionEntry/Group/entryLink-Elemente
  insgesamt, nur 64 tragen `sortIndex`; Vampire Counts.cat: 6 von 3098.
- `sortIndex` teilt sich einen gemeinsamen Nummerierungsraum über Geschwister
  unterschiedlichen Typs hinweg: belegt am Beispiel "Venators" in
  Mercenaries.cat — ein `entryLink` (Barding, `sortIndex="3"`) und eine
  `selectionEntryGroup` ("Command group", `sortIndex="2"`) sind echte
  Geschwister und teilen sich dieselbe Zählfolge, obwohl sie in getrennten
  XML-Wrapper-Tags stehen (`<entryLinks>` vs. `<selectionEntryGroups>`).
- Weder `src/parser/xmlParser.js` noch `src/evaluator/catalogReader.js`
  weisen aktuell einen synthetischen Index/Order-Wert beim Parsen zu; die
  einzige implizite Ordnung ist die Array-Position innerhalb der jeweils
  typspezifischen Arrays (`selectionEntries`, `selectionEntryGroups`,
  `entryLinks` getrennt).
- Kein ADR committet sich auf eine bewusste Anzeigereihenfolge für
  Auswahllisten; ADR 0003/0011 behandeln "Dokumentreihenfolge" nur für
  Modifier-Anwendungssemantik bzw. Roster-Flattening, nicht für UI-Listen —
  das Feld ist also architektonisch offen.

Acceptance criteria:

1. `sortIndex` wird von `src/evaluator/catalogReader.js` gelesen (nicht von
   `src/parser/xmlParser.js`, dessen geparste Objekte die betroffenen
   UI-Stellen nicht konsumieren) und als rein deskriptives Datenfeld (kein
   Gültigkeits-Urteil) durch `evalTree.js`/`report.js` bis auf die
   `capabilities`/Slot-Objekte durchgereicht, die `childSlotsOf` liefert.
2. Fehlt `sortIndex` an einem Element oder ist es nicht numerisch, gilt das
   als "kein sortIndex" — kein Fehler, keine Diagnose-Warnung, kein Ablehnen
   des Katalogs. Vorhandene Werte werden von String zu Zahl konvertiert.
3. `sortIndex` ordnet ausschließlich Geschwister unter demselben
   Eltern-Frame/derselben Sektion — keine globale oder Cross-Parent-Ordnung.
   Geschwister unterschiedlichen Elementtyps (z.B. ein `entryLink` und eine
   `selectionEntryGroup` unter demselben Rahmen) teilen sich denselben
   Nummerierungsraum und werden gemeinsam einsortiert.
4. In `SelectionConfigurator.buildSections()` werden Sektionen (Gruppen-Anker
   wie "General"/"Magische Gegenstände"/"Ausrüstung" sowie eigenständige
   Options-Zeilen ohne Gruppe) primär aufsteigend nach `sortIndex`
   einsortiert (Gruppen-Sektionen nutzen den `sortIndex` der zugrundeliegenden
   `selectionEntryGroup`, eigenständige Optionszeilen den `sortIndex` ihrer
   `selectionEntry`/`entryLink`-Capability). Sektionen ohne `sortIndex` werden
   danach angehängt, in ihrer bisherigen, aus dem Bericht/Slot-Ablauf
   abgeleiteten Reihenfolge (unverändert gegenüber heute).
5. In `OptionGroup.jsx` ersetzt `sortIndex` die bisherige reine
   Kostensortierung: Optionen mit `sortIndex` erscheinen zuerst, aufsteigend
   sortiert. Optionen ohne `sortIndex` werden danach angehängt und
   untereinander weiterhin absteigend nach Punktkosten sortiert (bestehende
   Regel bleibt für sie in Kraft) — nicht die rohe, unsortierte
   Bericht-Reihenfolge.
6. `CategoryUnitAdder.jsx` bleibt unverändert bei reiner Kostensortierung.
   Die Anzeigestellen bereits gewählter Roster-Einträge in
   Hinzufüge-/Roster-Reihenfolge (`RosterCategorySection.jsx`/
   `UnitCardList.jsx`, `ForceEditorSection.jsx`, `PlayUnitDetails.jsx`,
   `UnitChips.jsx`) bleiben unverändert — keine Katalog-Rückverknüpfung für
   die Anzeige bereits gewählter Einträge.

## Plan

## Tasks

## Decisions

- **Scope: nur die Konfigurationsansicht der Einheitenkarte.** Betrifft
  Sektionen und Optionen in `SelectionConfigurator.jsx`/`OptionGroup.jsx`.
  Ausdrücklich nicht die Kategorie-Kandidatenliste (`CategoryUnitAdder.jsx`)
  und nicht die Anzeige bereits gewählter Roster-Einträge in
  Hinzufüge-Reihenfolge — letztere bräuchten einen zusätzlichen Rückbezug
  Roster-Selection → Katalogdefinition, der explizit nicht Teil dieses
  Issues ist. Quelle: Antwort des Maintainers im Klärungsinterview ("mir
  geht es vor allem um die Sortierung innerhalb der Einheitenkarten und der
  Hauptkategorien einer Liste" → präzisiert auf Sektionen/Optionen der
  Einheitenkarte, nicht auf Roster-Anzeigereihenfolge).
- **`sortIndex` ersetzt die Kostensortierung in `OptionGroup.jsx`** für
  Optionen, die ihn tragen, statt nur als Tie-Breaker bei
  Kostengleichstand zu wirken. Quelle: Antwort des Maintainers ("sortIndex
  ersetzt die Kostensortierung (empfohlen)").
- **Fallback für Elemente ohne `sortIndex`:** ans Ende anhängen, dort
  weiterhin absteigend nach Kosten sortiert (Optionen) bzw. in bisheriger
  Bericht-/Slot-Reihenfolge (Sektionen) — nicht in roher, unsortierter
  Reihenfolge belassen. Quelle: Antwort des Maintainers ("Optionen nach
  absteigenden kosten sortieren", bestätigt in einer Folgenachricht:
  "Innerhalb einer Sektion ... absteigend nach kosten sortieren").
- **Gelesen wird über `src/evaluator/catalogReader.js`, nicht
  `src/parser/xmlParser.js`.** Quelle: Recherche (Researcher-Subagent) — die
  betroffenen UI-Stellen (`SelectionConfigurator`/`OptionGroup`) konsumieren
  `childSlotsOf`, das aus dem Evaluator-Bericht stammt, dessen Baumstruktur
  von `catalogReader.js#readSelectionChildren` gelesen wird; die separat
  geparsten Objekte aus `xmlParser.js` fließen dort nicht ein.

## Log

- Recherche (zwei Researcher-Subagent-Läufe) bestätigte: `sortIndex` kommt
  in echten Katalogen vor, ist außerhalb der XSD, wird nirgends im
  Produktivcode gelesen; volle Bestandsaufnahme aller Listen-Renderstellen
  unter `src/components/editor/`, `src/components/play/` und `src/roster/`
  durchgeführt (Datei:Zeile, iteriertes Array, vorhandene Sortierung je
  Stelle) sowie die Datenfluss-Kette `catalogReader.js` →
  `evalTree.js`/`report.js` → `slotLookups.js#childSlotsOf` nachvollzogen.
- Klärungsinterview (`/metis:grill`) lief in vier Runden: (1) Scope
  Kandidatenlisten vs. Roster-Anzeige, (2) Präzisierung "Einheitenkarte" =
  Editor-Optionsliste vs. bereits gewählte Ausrüstung, (3) sortIndex vs.
  Kostensortierung in `OptionGroup.jsx`, (4) Fallback-Reihenfolge für
  Elemente ohne `sortIndex`. Kriterien stabilisierten sich nach Runde 4.

## Checkpoints

### Before implementation

### Before the PR

## Retro
