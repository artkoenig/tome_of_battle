# Angebots-Anker entstehen als Blätter in einer zweiten Baumphase außerhalb der Fixpunktschleife

- **Status:** Accepted
- **Datum:** 2026-07-26
- **Beteiligte:** Artjom König
- **Zugehörige ADRs (falls vorhanden):** schließt die beiden in **ADR-0035**
  ausdrücklich offen gelassenen Punkte („wählbar im Bezugsrahmen muss präzise
  bestimmt werden" und „ist zu **messen**"); baut auf ADR-0034 (Bericht als
  alleinige Quelle) und ADR-0030 (Reinraum-Engine) auf.

## Kontext und Problemstellung

ADR-0035 entscheidet, dass Verfügbarkeit **abgelesen** wird: der Bericht führt
einen Fähigkeitsdatensatz nicht nur für belegte Slots, sondern für jede im
Bezugsrahmen wählbare Definition und für Kategorie-Knoten. Zwei Fragen lässt es
bewusst offen, weil sie sich ohne Umsetzung nicht redlich beantworten lassen:

1. **Was heißt „wählbar im Bezugsrahmen"?** Zu weit gefasst bläht es den Baum
   sinnlos auf, zu eng gefasst fehlen Optionen in der Oberfläche.
2. **Trägt die Auswertung den Zuwachs?** ADR-0035 behauptet, die
   Fixpunktschleife trage ihn nicht, weil ein Anker keine Instanz trägt und in
   keine Zählung eingeht — und verlangt ausdrücklich eine **Messung** statt einer
   Behauptung.

Diese ADR beantwortet beide, die zweite mit Zahlen.

## Entscheidungsfaktoren (Drivers)

- **Der Zuwachs darf die iterierte Auswertung nicht belasten.** Die
  Fixpunktschleife läuft bis zur Konvergenz mehrfach; alles, was in ihr liegt,
  wird vervielfacht.
- **Die Abgrenzung muss aus den Katalogdaten folgen**, nicht aus einer
  gepflegten Liste, die still veralten kann.
- **Ein Angebot ist kein Bestand.** Was nicht gewählt ist, darf keine Verletzung
  erzeugen — sonst meldet die Anwendung Regelverstöße über Dinge, die gar nicht
  in der Liste stehen.
- **Kein Sonderweg neben dem bestehenden Mechanismus.** Slice 03 hat den
  Nach-Durchlauf für Anker bereits gebaut; ein zweiter Weg für dieselbe Sache
  wäre genau die Doppelung, die ADR-0034 verbietet.

## Betrachtete Optionen

- **Option 1 — Anker beim Baumbau miterzeugen.** Baumphase 1 hängt Angebot und
  Bestand in einem Durchgang an; die Fixpunktschleife sieht beide.
- **Option 2 — Zweite Baumphase nach der Konvergenz.** Phase 1 baut nur den
  Bestand, die Schleife konvergiert darauf, danach hängt Phase 2 die
  Angebots-Anker als Blätter an und der bestehende Nach-Durchlauf gibt ihnen ihre
  wirksamen Werte.
- **Option 3 — Angebot außerhalb des Baums berechnen.** Eine eigene Rechenstelle
  ermittelt je Rahmen die wählbaren Definitionen und ihre Grenzen, ohne sie in
  den Auswertungsbaum aufzunehmen.

## Entscheidungsergebnis

Gewählte Option: **Option 2.**

**Bestimmung von „wählbar im Bezugsrahmen"** — abgeleitet aus den Katalogdaten,
in zwei Fällen:

- **Rahmen Kontingent:** die Wurzeldefinitionen des Datensatzes
  (`selectionEntry`/`entryLink` auf oberster Ebene, aus jedem Katalog und dem
  Spielsystem), gefiltert an der Kategorienliste des Kontingents: mindestens eine
  **Basis**-Kategorie der Definition muss unter den `categoryLink`-Zielen des
  Kontingents stehen. Eine Definition ganz ohne Basis-Kategorie wird immer
  angeboten.
- **Rahmen belegte Auswahl:** die Optionen unterhalb ihrer Definition — durch
  `selectionEntryGroup`s und durch einen `entryLink`, dessen aufgelöstes Ziel
  eine Gruppe ist, beliebig tief absteigend, **beim ersten Eintrag anhaltend**.

Maßgeblich ist die **Basis**-Kategorie, nicht die wirksame: eine per Modifikator
zugewiesene Kategorie hängt an einer Instanz, ein Angebots-Anker hat aber keine.

**Angebots-Anker sind immer Blätter.** Eine Option einer Option erscheint nicht
im äußeren Rahmen — sie wird sichtbar, sobald ihre Trägerauswahl belegt ist und
damit selbst zum Rahmen wird. Das hält den Baum auf einer Ebene je Rahmen und
macht das Anhalten beim ersten Eintrag zur einzigen nötigen Abbruchregel.

**Sie liegen außerhalb der Fixpunktschleife.** Phase 2 läuft nach der
Konvergenz; die Anker bekommen ihre wirksamen Werte im Nach-Durchlauf aus
ADR-0035 bzw. Slice 03. Zulässig ist das aus demselben Grund, aus dem der
Nach-Durchlauf überhaupt zulässig ist: ein Anker trägt keine Instanz, geht in
keine Zählung ein und kann den ausgewerteten Zustand deshalb nicht verändern — er
empfängt Werte, er erzeugt keine.

**Ein Anker erzeugt keine Verletzung.** Ein Constraint-Ergebnis trägt, ob es
berichtspflichtig ist; am Angebots-Anker speist es allein den
Fähigkeitsdatensatz.

### Die Messung, die ADR-0035 verlangt hat

Gemessen an echten Katalogdaten (`scripts/measure-evaluator.js`, Median über 15
Läufe), vor und nach der Einführung der Angebots-Anker:

| Fall | Knoten vorher → nachher | Iterierte Auswertung | Nach-Durchlauf |
|---|---|---|---|
| klein, 1 Armee-Katalog | 23 → **139** | 1,3 → **0,9 ms** | 0,0 → **1,5 ms** |
| VC + Mercenaries | 49 → **319** | 1,4 → **1,1 ms** | 0,0 → **2,2 ms** |
| 3 Armee-Kataloge | 42 → **304** | 1,0 → **0,8 ms** | 0,0 → **2,4 ms** |

**Der Baum wächst um das Sechs- bis Siebenfache, die iterierte Auswertung bleibt
flach.** Der gesamte Zuwachs fällt im Nach-Durchlauf an — genau dort, wo er nach
der Konstruktion anfallen soll, und einmalig statt je Runde. Die Annahme aus
ADR-0035 ist damit belegt, nicht mehr nur behauptet.

Unverändert bleibt der beherrschende Posten: die Aufbereitung der Katalogdaten
macht 99,1–99,5 % der Gesamtdauer aus. Der Aufwand der Auswertung ist gegenüber
dem Parsen nicht messbar relevant — **die Frage nach der Form der Fassade
entscheidet sich am Parsen, nicht am Baum.**

### Konsequenzen (Auswirkungen)

- **Positiv:** Der Zuwachs des Baums kostet einen einmaligen Durchlauf statt
  eines Faktors auf jede Fixpunktrunde — empirisch belegt.
- **Positiv:** Die Abgrenzung des Angebots folgt aus den Katalogdaten
  (Basis-Kategorien, Gruppenstruktur); es gibt keine Pflegeliste.
- **Positiv:** Der bestehende Nach-Durchlauf wird mitbenutzt statt verdoppelt.
- **Negativ:** Der Baumbau zerfällt in zwei Phasen. Wer die Engine liest, muss
  wissen, dass der Baum nach `buildEvalTree` noch nicht vollständig ist.
- **Negativ:** Die Basis-Kategorie als Filter ist eine bewusste Näherung. Eine
  Definition, die ihre Kategorie erst per Modifikator erhielte, wird im
  Kontingent nicht angeboten. Der erweiterte Fixture-Korpus belegt diesen Fall
  inzwischen dreifach — jeweils gegen das Kontingent „War of Vengeance (DW1-AB)"
  (`d18e-88cd-44b8-f527`) des Buches Dwarfs (2005): die Wurzel-`entryLink`s
  „Ruglud's Armoured Orcs" (`8a22-be92-5feb-16e8`, Orcs and goblins), „Mengil
  Manhide's Manflayers" (`bbaf-7b5e-6800-7d50`, Dark Elves) und „Tichi Huichi's
  Raiders" (`a532-46a4-3c3c-d689`, Lizardmen). Jeder von ihnen zeigt auf einen
  geteilten Mercenaries-Eintrag mit den Basis-Kategorien „Regiment of Renown"
  und „Rare", die das Kontingent nicht verlinkt, und trägt einen **unbedingten**
  `modifierGroup`, der `add category = Special` und `remove category = Rare`
  ausführt — effektiv Special, in der Basis Rare, und der Basis-Kategorie-Filter
  lässt ihn aus dem Angebot dieses Kontingents fallen. Die Entscheidung (Option
  2, Basis-Kategorien) bleibt davon unberührt; der Befund ist in Issue 0148
  (INC-4) für den Maintainer festgehalten.
- **Neutral:** Die Verletzungsliste bleibt unverändert — die grüne E2E-Suite ist
  der Nachweis.

## Vor- und Nachteile der Optionen

### Option 1 — Anker beim Baumbau miterzeugen

- **Gut, weil** es nur einen Baumbau gäbe und der Baum nach `buildEvalTree`
  vollständig wäre.
- **Schlecht, weil** die Fixpunktschleife dann über den sechs- bis siebenfachen
  Knotenbestand liefe — je Runde, nicht einmal.
- **Schlecht, weil** ein Anker in den Konvergenzvergleich geriete und dort eine
  Nichtkonvergenz vortäuschen könnte, obwohl er nichts erzeugt.

### Option 2 — Zweite Baumphase nach der Konvergenz

- **Gut, weil** der Zuwachs nachweislich einmalig anfällt.
- **Gut, weil** sie den in Slice 03 gebauten Nach-Durchlauf schlicht mitbenutzt.
- **Gut, weil** Angebot und Bestand denselben Knotenbegriff und damit denselben
  Fähigkeitsdatensatz teilen.
- **Schlecht, weil** der Baumbau in zwei Schritte zerfällt.

### Option 3 — Angebot außerhalb des Baums berechnen

- **Gut, weil** der Auswertungsbaum schlank bliebe.
- **Schlecht, weil** dann zwei Rechenstellen dieselbe Frage beantworteten und
  auseinanderlaufen könnten — dieselbe Ablehnung, die ADR-0035 schon gegen einen
  zweiten Berichtszweig ausgesprochen hat.
- **Schlecht, weil** Grenzen und Sichtbarkeit eines angebotenen Eintrags dort
  erneut ausgewertet werden müssten, obwohl der Nach-Durchlauf das bereits kann.
