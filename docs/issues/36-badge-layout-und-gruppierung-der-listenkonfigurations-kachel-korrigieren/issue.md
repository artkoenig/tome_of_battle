Status: ready-for-agent
Type: fix
Blocked by: None

## Description
# PRD: Badge-Layout und Gruppierung der Listenkonfigurations-Kachel korrigieren

## Problem Statement / Bug Description
Zwei Fehler in `ListConfigurationCard` (main-issue 34/35), vom Nutzer per
Screenshot aus der echten App gemeldet:

1. **Badge-Überlappung im eingeklappten Zustand:** `.selection-node-header`
   (`src/index.css:832`, genutzt von `.list-config-card-header`) hat kein
   `flex-wrap`. Ist der Kategorietitel lang genug, um umzubrechen (z. B.
   „Special List Rules"), bleibt die Badge-Leiste (`.list-config-badges`)
   trotzdem in derselben Flex-Zeile und wird durch `align-items: center`
   vertikal mittig in die dadurch höhere Zeile gesetzt — sie überlappt den
   Titeltext, statt darunter zu erscheinen. Je mehr/längere Badges (ein Badge
   pro Haupteintrag mit Auswahl, Text = voller Name der gewählten Option),
   desto ausgeprägter der Fehler.
2. **Fehlende Gruppierung im aufgeklappten Zustand:** Aktuell listet die
   Karte aufgeklappt alle Optionen aller Haupteinträge flach untereinander,
   ohne die Haupteintrags-Namen als Zwischenüberschrift (so von main-issue
   34 bewusst spezifiziert: „ohne Zwischenüberschriften mit den Namen der
   Haupteinträge"). Der Nutzer hat diese Entscheidung revidiert: Bei vier
   oder mehr Haupteinträgen mit jeweils mehreren Optionen ist eine flache,
   unbeschriftete Liste nicht mehr überschaubar.

## Solution
- **Badge-Layout:** `.selection-node-header`/`.list-config-card-header`
  bekommt `flex-wrap: wrap`, sodass Titel und Badge-Leiste bei Platzmangel
  in eigene Zeilen umbrechen, statt sich zu überlappen. Betrifft nur das
  Kachel-Layout, keine Änderung an `selectedBadges`/Badge-Inhalt selbst.
- **Gruppierung:** Der aufgeklappte Zustand zeigt pro Haupteintrag den
  Haupteintrags-Namen als reinen Text-Titel (nicht klickbar, keine
  Kachel-/Badge-Optik) über dessen eigener Options-Liste (inkl. „Keine").
  Das kehrt die main-issue-34-Entscheidung „ohne Zwischenüberschriften"
  explizit um.

## User Stories / Requirements
1. Als Spieler möchte ich, dass die Kachel im eingeklappten Zustand nie
   Text und Badges überlappend darstellt, egal wie lang Kategorietitel oder
   gewählte Optionsnamen sind.
2. Als Spieler möchte ich im aufgeklappten Zustand auf einen Blick sehen,
   zu welchem Haupteintrag (z. B. „Allow experimental rules?") welche
   Optionen gehören, durch einen Textlabel je Gruppe.

## Technical Decisions
- Affected Modules: `src/index.css` (`.selection-node-header`,
  `.list-config-badges`, ggf. neue Klasse für den Gruppen-Titel),
  `src/components/editor/ListConfigurationCard.jsx` (Gruppierung im
  aufgeklappten Rendering, `radioGroups` liefert bereits pro Gruppe deren
  Haupteintrags-Kontext — der Anzeigename muss ergänzt werden, siehe unten).
- `buildConfigurationRadioGroups` (`src/solver/listConfigurationView.js`)
  liefert pro Gruppe aktuell keinen menschenlesbaren Namen des
  Haupteintrags selbst (nur `mainEntrySelectionId`/`entryDef`). Für die
  Gruppen-Überschrift muss der aufgelöste Name des Haupteintrags (aus
  `resolveEntry`) ergänzt werden.
- **Branch-Ausnahme:** Auf ausdrücklichen Wunsch des Nutzers wird dieses
  Issue nicht auf einem eigenen `issue/<slug>`-Branch/PR umgesetzt, sondern
  direkt auf `issue/listenkonfigurations-kategorien-ohne-vorherige-auswahl-als-kachel-anzeigen`
  (main-issue 35, PR #86), da PR #86 zum Zeitpunkt der Meldung noch offen
  war und beide Änderungen denselben Screenshot/dieselbe Komponente
  betreffen. Abweichung von der 1:1-Regel „1 main-issue = 1 branch = 1 PR".

## Testing Decisions
- Modules to Test: `src/solver/listConfigurationView.test.js` (Namen im
  Gruppen-Objekt), `src/components/editor/ListConfigurationCard.test.jsx`
  (Gruppen-Titel im aufgeklappten Zustand, keine Zwischenüberschrift mehr
  fälschlich fehlend).
- Test Interfaces (Seams): `buildConfigurationRadioGroups`-Rückgabewert
  (neues Namensfeld pro Gruppe), `ListConfigurationCard`-Rendering
  (aufgeklappter Zustand zeigt Gruppen-Label + zugehörige Radio-Zeilen).

## Out of Scope
- Der Inhalt/die Beschriftung der Badges im eingeklappten Zustand bleibt
  unverändert (voller Name der gewählten Option) — nur das Umbruchverhalten
  wird korrigiert.
- Keine erneute Änderung an der Katalog-vs-Selection-Klassifikation aus
  main-issue 35.

## Acceptance Criteria
- [ ] Im eingeklappten Zustand überlappen Titel und Badges nie, unabhängig
      von der Länge des Kategorienamens oder der Badge-Texte (Titelzeile und
      Badge-Leiste brechen bei Platzmangel in eigene Zeilen um).
- [ ] Im aufgeklappten Zustand zeigt die Kachel je Haupteintrag dessen
      aufgelösten Namen als reinen Text-Titel (nicht klickbar, keine
      Kachel-/Badge-Optik) direkt über dessen eigener Options-Liste
      (inkl. „Keine").
- [ ] Die Optionen bleiben pro Haupteintrag in der bisherigen Reihenfolge
      und Radio-Semantik (Klick wählt sofort, „Keine" löscht die Auswahl).
- [ ] Bestehende Tests für Klassifikation, virtuelle Gruppen und Klick-
      Interaktionen (main-issue 35) bleiben unverändert grün; neue/angepasste
      Tests decken Gruppen-Titel und Badge-Umbruch ab.

## Comments
