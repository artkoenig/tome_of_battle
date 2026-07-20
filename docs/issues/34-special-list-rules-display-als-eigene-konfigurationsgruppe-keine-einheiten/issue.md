Status: resolved
Type: feature
Blocked by: None

## Description

# PRD: Listenregeln als eigene Konfigurationsgruppe darstellen (keine Einheiten)

## Problem Statement
Die katalogseitige Kategorie „Special list rules" (z. B. „Allow experimental
rules?", „Allow special characters?", „Campaign/Scenario rules", „Mercenaries and
Regiments of Renown") hängt als **listenweite Konfiguration** an einer Armeeliste.
Diese Einträge tragen im Katalog `type="upgrade"` (mit `import="true"`) auf
Force-Wurzel-Ebene — sie sind **keine** aushebbaren Einheiten, sondern
listenweite Einstellungen. Die App importiert Wurzel-`entryLink`s jedoch **nicht**
automatisch: auf einer frischen Liste ist die Gruppe „Special list rules" daher
leer und trägt — wie jede Einheiten-Kategorie — einen „+"-Adder. Die Regeln
werden heute also wie Einheiten per „+" hinzugefügt und per ⋮-Menü gelöscht (die
ursprüngliche Aufnahme des Nutzers zeigte „4", weil er sie zuvor hinzugefügt
hatte).

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
den `type` `upgrade` trägt (also weder `unit` noch `model` — keine
kampffeldrelevante Einheit), gilt als *Listenregel*.
Dies steht im Einklang mit ADR 0003 (Gruppierung nie über hartkodierte
Kategorienamen, sondern datengetrieben) und benötigt **keinen** `systemQuirks.js`-
Eintrag und **keine** Namensprüfung.

Damit die Regeln **dauerhaft und ohne „+"** erscheinen, werden sie beim Anlegen
*und* Laden einer Liste **automatisch materialisiert**: fehlt eine Listenregel
einer Force, wird sie idempotent als Selektion ergänzt (Solver-Helfer
`materializeListRules`, in `useRoster` über den Undo-neutralen `replace`-Pfad
angewandt — dieselbe Art system-getriebener Normalisierung wie
`syncRosterSelectionsWithSystem`). Dadurch ist die Gruppe stets vollständig, der
„+"-Adder entfällt zu Recht, und ein Entfernen ist nicht nötig.

Das Roster-/`.ros`-**Schema** bleibt strukturell unverändert: materialisierte
Listenregeln sind gewöhnliche `upgrade`-Selektionen wie zuvor manuell
hinzugefügte — kein neues Feld. Neu ist allein, dass sie **automatisch statt vom
Nutzer** angelegt werden; das ist eine bewusste, dokumentierte Ausnahme zum
Grundsatz von **ADR 0011** (das Roster hält Nutzer-Entscheidungen), da
Listenregeln verpflichtende, listenweite Einstellungen sind.

Im „Listenregel-Modus" werden dieselben Komponenten wiederverwendet
(`UnitSelectionCard` + `SelectionConfigurator` + Badge-Chips), jedoch:
- **ohne** den Detail-/Profil-Umschalter und das ⋮-Menü,
- **ohne** „+"-Adder der Gruppe,
- **mit** erhaltenem Klick-auf-Karte → Options-Konfigurator (Kampagnen-Haken etc.),
- **mit** unveränderter Badge-Anzeige der gewählten Optionen.

Alle Listenregeln erscheinen gebündelt unter ihrem Hauptknoten „Special list
rules" (die bestehende, katalog-benannte Kategorie-Gruppe dient als dieser
Hauptknoten; keine neue verschachtelte Baumstruktur). Die Gruppe ist
**ausklappbar** (Chevron in der Kopfzeile), und die Regel-Karten tragen **keinen
gezackten Rand** (die `torn-edge`-Zierde bleibt echten Einheiten vorbehalten).
Die Erkennung einer Listenregel-Kategorie erfolgt bereits vor der
Materialisierung katalog-basiert (`isListRuleCategory` über die mit dem
„+"-Adder geteilte Aufzählung `collectPrimaryCategoryEntries`), sodass beim
ersten Render kein „+"-Adder aufblitzt.

**Im Spielmodus (`PlayMode`) werden die Listenregel-Karten vollständig
ausgeblendet.** Der Spielmodus zeigt die kampffeldrelevanten Einheiten; die
listenweite Konfiguration gehört dort nicht hin. Es greift dasselbe Prädikat:
Selektionen, die als Listenregel erkannt werden (`type === "upgrade"`), werden aus
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
  - Die Roster-Initialisierung (`useRoster`) — materialisiert fehlende
    Listenregeln idempotent beim Anlegen/Laden (Solver-Helfer
    `materializeListRules`).
- **Architektur-Entscheidungen:**
  - Erkennung strikt datengetrieben über Katalog-`type` (`type === "upgrade"` ⇒
    Listenregel; `unit`/`model` sind kampffeldrelevante Einheiten). Bestätigt an
    den echten Definitive-Edition-Daten: alle vier
    Regeln `type="upgrade"`, echte Einheiten `type="unit"`. Anwendung des
    bestehenden Prinzips aus **ADR 0003** — kein neuer ADR, keine Namens-/
    ID-Hartkodierung, kein `systemQuirks.js`-Eintrag.
  - Listenregeln werden **automatisch materialisiert** (dauerhaft präsent), statt
    vom Nutzer per „+" ausgehoben zu werden — bewusste, dokumentierte Ausnahme zu
    **ADR 0011** (siehe Solution). Schema und `.ros`-Serialisierung bleiben
    strukturell unverändert; die Regeln sind gewöhnliche `upgrade`-Selektionen.
- **Data Models:** keine Schema-Änderung, kein neues persistiertes Feld. Neu ist
  nur, dass Listenregel-`upgrade`-Selektionen automatisch (idempotent) in
  `force.selections` gesät werden. Die Erkennung liest den transient aufgelösten
  Katalog-Entry-`type`.

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
  5. `materializeListRules` (Solver, direkt unit-testbar): ergänzt fehlende
     Listenregeln unter ihrer Primärkategorie, ist idempotent (keine Dubletten)
     und materialisiert keine echten Einheiten.

## Out of Scope
- Keine **Schema**-Änderung am Roster/`.ros` und kein neues Roster-Feld
  (materialisierte Listenregeln sind gewöhnliche `upgrade`-Selektionen). Die
  Auto-Materialisierung selbst ist Teil dieser Änderung.
- Kein neuer `systemQuirks.js`-Eintrag und keine Namens-/ID-basierte
  Sonderbehandlung einer bestimmten Kategorie.
- Keine Änderung an der Darstellung echter Einheiten-Kategorien (Lord, Helden,
  Core …) oder am generischen Karten-Verhalten außerhalb des Listenregel-Modus.
- Keine neue verschachtelte Baum-/Unterknoten-Struktur; der bestehende
  Kategorie-Header dient als Hauptknoten.
- Keine Änderung an der Validierungslogik der Regeln (z. B. Fehlermeldungen wie
  „Please enable Allow special characters?").

## Acceptance Criteria
- [x] Ein reines Solver-Prädikat erkennt eine Wurzel-Selektion mit aufgelöstem
      Katalog-`type == upgrade` als Listenregel (direkt unit-getestet; echte
      Einheiten = `unit`/`model` werden nicht als Listenregel erkannt).
- [x] Beim Anlegen und Laden einer Liste sind alle Listenregeln der Force
      automatisch & dauerhaft präsent (idempotent materialisiert,
      `materializeListRules`); die Gruppe ist nie leer und trägt keinen
      „+"-Adder — verifiziert im echten Foliant (Bretonnia, Definitive Edition:
      4 Regeln, 0 Pkt., keine neuen Validierungsfehler).
- [x] Im Roster-Editor zeigt eine Listenregel-Karte weder den Detail-/Profil-
      Umschalter (`ReceiptText`) noch das ⋮-Menü — und **keinen gezackten unteren
      Rand** (die `unit-card-torn-edge`-Zierde bleibt echten Einheiten vorbehalten).
- [x] Die „Special list rules"-Gruppe ist **ausklappbar**: ein Chevron in der
      Kopfzeile, Klick blendet die Regel-Karten ein/aus (Standard: ausgeklappt).
- [x] Im Roster-Editor zeigt die Listenregel-Gruppe keinen „+"-Adder.
- [x] Klick auf eine Listenregel-Karte öffnet weiterhin den Options-Konfigurator
      — jedoch **ohne** die Überschrift „Optionen & Ausrüstung konfigurieren"
      (für Regeln unpassend); die dort gewählten Optionen erscheinen weiterhin als
      Badges auf der Karte.
- [x] Echte Einheiten-Kategorien (Lord, Helden, Core …) bleiben unverändert:
      Detail-Umschalter, ⋮-Menü und „+"-Adder bleiben dort erhalten.
- [x] Im Spielmodus (`PlayMode`) erscheinen Listenregel-Selektionen nicht — weder
      im kategorisierten Pfad noch unter „Sonstige Auswahlen"; echte Einheiten
      bleiben dort sichtbar.
- [x] Roster-Datenmodell und `.ros`-Import/-Export bleiben unverändert (kein neues
      persistiertes Feld).
- [x] Alle Unit-/Komponententests grün (`npm test`).

## Comments
- Umgesetzt: Solver-Praedikat isListRuleSelection (Katalog-type === upgrade, ADR 0003 gewahrt), re-exportiert ueber solver/validator.js. UnitSelectionCard-Listenregel-Modus (kein Detail-/Profil-Knopf, kein Aktionsmenue; Badges & Konfigurator bleiben, Details dauerhaft offen). RosterEditor: '+'-Adder fuer die Listenregel-Gruppe unterdrueckt. PlayMode: Listenregeln aus kategorisiertem UND 'Sonstige Auswahlen'-Pfad gefiltert. Roster-Modell/.ros unveraendert (ADR 0011). Vier-Achsen-Pruefung: Standards sauber, Tests gruen (730), Spezifikations-/Docs-Befunde (Testabdeckung 'Sonstige'-Pfad + Wortlaut type===upgrade) behoben. Version 1.3.0 (minor, feature).
- Nachbesserung nach Screenshot-Verifikation & Vier-Achsen-Pruefung: (1) Auto-Materialisierung der Listenregeln (dauerhaft praesent, kein '+'/Loeschen); (2) Gruppe ausklappbar (Chevron); (3) gezackter Kartenrand entfernt; (4) DRY: geteilte Aufzaehlung collectPrimaryCategoryEntry; (5) robuste Idempotenz ueber aufgeloeste Entry-ID; (6) '+'-Flash behoben via isListRuleCategory. 739 Tests gruen, Lint sauber, ein-/ausgeklappt im echten Foliant (Bretonnia Definitive Edition) verifiziert. Version 1.3.0 (minor, feature).
- Zusatz: SelectionConfigurator blendet die Ueberschrift 'Optionen & Ausruestung konfigurieren' fuer Listenregeln aus (isListRule durchgereicht). Test + Screenshot-Verifikation.
