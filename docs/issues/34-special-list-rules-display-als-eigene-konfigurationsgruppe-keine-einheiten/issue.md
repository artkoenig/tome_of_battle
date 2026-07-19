Status: needs-triage
Type: feature
Blocked by: None

## Description

# PRD: Listenregeln als eigene Konfigurationsgruppe darstellen (keine Einheiten)

## Problem Statement
Die katalogseitige Kategorie „Special list rules" (z. B. „Allow experimental
rules?", „Allow special characters?", „Campaign/Scenario rules", „Mercenaries and
Regiments of Renown") hängt als **listenweite Konfiguration** an einer Armeeliste.
Diese Einträge tragen im Katalog `type="upgrade"` und `import="true"` auf
Force-Wurzel-Ebene — sie sind also dauerhafte, systemvorgegebene
Einstellungsknoten, **keine** aushebbaren Einheiten.

Heute rendert sie der Roster-Editor jedoch mit exakt derselben generischen
Kategorie-Schleife wie jede Einheiten-Kategorie (Lord, Helden, Core …): jede
Regel ist eine `UnitSelectionCard` mit Detail-/Profil-Umschalter (`ReceiptText`)
und ⋮-Menü (Kopieren/Löschen), und die Gruppe trägt einen „+"-Adder
(`CategoryUnitAdder`). Für eine dauerhafte Einstellung sind Hinzufügen, Kopieren,
Löschen und die Profilanzeige sinnlos und irreführend — die Regeln wirken wie
Einheiten, die sie nicht sind.

**Aktuelles Verhalten:** Listenregeln erscheinen als Einheiten-Karten mit
„+"-Adder, Profil-Knopf und ⋮-Menü.
**Gewünschtes Verhalten:** Listenregeln erscheinen als aufgeräumte
Konfigurationsgruppe unter ihrem Hauptknoten — ohne die zwei Karten-Knöpfe, ohne
„+"-Adder — bei erhaltenem Options-Konfigurator und Badge-Anzeige.

## Solution
Die Unterscheidung „Einheit vs. Listenregel" wird **system-agnostisch aus den
Katalogdaten** abgeleitet: Eine Wurzel-Selektion, deren aufgelöster Katalog-Entry
`type` **nicht** `unit` ist (praktisch `type="upgrade"`), gilt als *Listenregel*.
Dies steht im Einklang mit ADR 0003 (Gruppierung nie über hartkodierte
Kategorienamen, sondern datengetrieben) und benötigt **keinen** `systemQuirks.js`-
Eintrag und **keine** Namensprüfung.

Das Roster-Datenmodell bleibt **unverändert**: Listenregeln bleiben normale
`force.selections` (`upgrade`-Selektionen). Es entsteht kein neues Roster-Feld,
kein Umbau am `.ros`-Export (ADR 0011 unberührt). Die Änderung ist rein
darstellungs- und interaktionsseitig.

Im „Listenregel-Modus" werden dieselben Komponenten wiederverwendet
(`UnitSelectionCard` + `SelectionConfigurator` + Badge-Chips), jedoch:
- **ohne** den Detail-/Profil-Umschalter und das ⋮-Menü,
- **ohne** „+"-Adder der Gruppe,
- **mit** erhaltenem Klick-auf-Karte → Options-Konfigurator (Kampagnen-Haken etc.),
- **mit** unveränderter Badge-Anzeige der gewählten Optionen.

Alle Listenregeln erscheinen gebündelt unter ihrem Hauptknoten „Special list
rules" (die bestehende, katalog-benannte Kategorie-Gruppe dient als dieser
Hauptknoten; keine neue verschachtelte Baumstruktur).

**Im Spielmodus (`PlayMode`) werden die Listenregel-Karten vollständig
ausgeblendet.** Der Spielmodus zeigt die kampffeldrelevanten Einheiten; die
listenweite Konfiguration gehört dort nicht hin. Es greift dasselbe Prädikat:
Selektionen, die als Listenregel erkannt werden (`type !== "unit"`), werden aus
der gruppierten Anzeige des Spielmodus herausgefiltert — sowohl im
kategorisierten als auch im „Sonstige Auswahlen"-Pfad.

## User Stories / Requirements
1. Als Listenersteller möchte ich Listenregeln klar von Einheiten unterschieden
   sehen, damit ich nicht den Eindruck habe, sie hinzufügen, kopieren oder löschen
   zu müssen.
2. Als Listenersteller möchte ich die Optionen einer Listenregel (z. B. die
   Kampagnen-Haken) weiterhin per Klick auf die Karte im Konfigurator setzen.
3. Als Listenersteller möchte ich meine gewählten Optionen weiterhin als Badges
   auf der Regel-Karte sehen.
4. Als Listenersteller möchte ich, dass am Listenregel-Hauptknoten kein
   „+"-Hinzufügen-Knopf erscheint, da diese Regeln dauerhaft vorhanden sind.
5. Als Wartender des Codes möchte ich, dass die Einheit/Regel-Unterscheidung
   ausschließlich aus dem Katalog-`type` folgt und für jedes künftig importierte
   System ohne Codeänderung greift.
6. Als Spieler möchte ich im Spielmodus nur die kampffeldrelevanten Einheiten
   sehen; die Listenregel-Karten sollen dort ausgeblendet sein.

## Technical Decisions
- **Affected Modules (Verhalten, nicht Dateiliste):**
  - Die Kategorie-Rendering-Schleife des Roster-Editors (unterdrückt „+"-Adder
    und schaltet Karten in den Listenregel-Modus).
  - Die Einheiten-/Auswahl-Karte (`UnitSelectionCard`) — neuer Darstellungsmodus,
    der Detail-Umschalter und ⋮-Menü ausblendet, Konfigurator und Badges behält.
  - Ein reines Prädikat im Solver zur Einheit/Regel-Erkennung aus dem
    aufgelösten Entry-`type`.
  - Die Gruppierungs-/Filterlogik des Spielmodus (`PlayMode`) — schließt
    Listenregel-Selektionen aus der Anzeige aus (kategorisierter und
    unkategorisierter Pfad).
- **Architektur-Entscheidungen:**
  - Erkennung strikt datengetrieben über Katalog-`type` (`type !== "unit"` ⇒
    Listenregel). Bestätigt an den echten Definitive-Edition-Daten: alle vier
    Regeln `type="upgrade"`, echte Einheiten `type="unit"`. Anwendung des
    bestehenden Prinzips aus **ADR 0003** — kein neuer ADR, keine Namens-/
    ID-Hartkodierung, kein `systemQuirks.js`-Eintrag.
  - Roster-Modell und `.ros`-Serialisierung bleiben unverändert (**ADR 0011**
    unberührt); die Listenregeln bleiben gewöhnliche `upgrade`-Selektionen.
- **Data Models:** keine Änderung am Roster-Schema. Die Erkennung liest nur den
  transient aufgelösten Katalog-Entry-`type`, kein neues persistiertes Feld.

## Testing Decisions
- **Modules to Test:** das Erkennungs-Prädikat (Solver), die Auswahl-Karte im
  Listenregel-Modus, die Kategorie-Gruppe des Roster-Editors.
- **Test Interfaces (Seams):**
  1. Reines Prädikat im Solver (z. B. `isListRuleSelection` / `isUnitEntry`),
     direkt unit-testbar über den Entry-`type`.
  2. `UnitSelectionCard` (Komponententest): im Listenregel-Modus fehlen
     Detail-Umschalter und ⋮-Menü; Klick öffnet weiterhin den Konfigurator;
     Badges bleiben.
  3. `RosterEditor` (Komponententest): die Listenregel-Gruppe zeigt keinen
     „+"-Adder und bündelt die Karten unter ihrem Hauptknoten.
  4. `PlayMode` (Komponententest): Listenregel-Selektionen erscheinen nicht in
     der Anzeige des Spielmodus; echte Einheiten bleiben unverändert sichtbar.

## Out of Scope
- Keine Änderung am Roster-Datenmodell, an IndexedDB oder am `.ros`-Import/Export.
- Kein neuer `systemQuirks.js`-Eintrag und keine Namens-/ID-basierte
  Sonderbehandlung einer bestimmten Kategorie.
- Keine Änderung an der Darstellung echter Einheiten-Kategorien (Lord, Helden,
  Core …) oder am generischen Karten-Verhalten außerhalb des Listenregel-Modus.
- Keine neue verschachtelte Baum-/Unterknoten-Struktur; der bestehende
  Kategorie-Header dient als Hauptknoten.
- Keine Änderung an der Validierungslogik der Regeln (z. B. Fehlermeldungen wie
  „Please enable Allow special characters?").

## Acceptance Criteria
- [ ]

## Comments
