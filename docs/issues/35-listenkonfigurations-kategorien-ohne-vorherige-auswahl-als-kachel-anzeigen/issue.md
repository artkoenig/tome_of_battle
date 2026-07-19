Status: resolved
Type: fix
Blocked by: None

## Description
# PRD: Listenkonfigurations-Kategorien ohne vorherige Auswahl als Kachel anzeigen

## Problem Statement / Bug Description
Der Heerlager-Editor rendert eine Kategorie nur dann als aufklappbare
`ListConfigurationCard` (main-issue 34, Child-Issue 02), wenn für diese
Kategorie bereits mindestens eine Auswahl auf dem Roster liegt
(`isListConfigurationCategory` prüft `force.selections`, nicht die
Katalogdefinition der Kategorie). Ist eine reine
Listenkonfigurations-Kategorie (siehe CONTEXT.md) noch komplett leer — etwa
„Special List Rules" in der WHFB6 Definitive Edition direkt nach dem
Import/Anlegen einer neuen Liste — fällt der Editor stattdessen auf den
generischen Kategorie-Pfad zurück: Header + `CategoryUnitAdder`
(„<Kategoriename> AUSHEBEN"-Dialog). Das ist fachlich falsch: „Special List
Rules" enthält ausschließlich listenweite Regel-Schalter (z. B. „Allow
experimental rules?", „Allow special characters?", „Campaign/Scenario
rules", „Mercenaries and Regiments of Renown"), keine rekrutierbaren
Einheiten — der Begriff „ausheben" (rekrutieren) passt fachlich nicht, und
die Optik/Interaktion weicht unnötig von der Kachel-Darstellung ab, die für
genau diesen Fall existiert.

Erwartetes Verhalten: Die Kategorie „Special List Rules" (Name = der
Kachel-Titel) rendert immer als aufklappbare `ListConfigurationCard` — auch
mit 0 Auswahlen. Aufgeklappt zeigt die Kachel alle vier Haupteinträge der
Kategorie direkt (inkl. ihrer Unteroptionen, z. B. bei „Campaign/Scenario
rules"), jeweils mit „Keine" als aktivem Default, ohne dass der Nutzer vorher
den Aushebe-Dialog bemühen muss.

## Solution
Die Klassifikation „ist diese Kategorie eine reine
Listenkonfigurations-Kategorie?" wird von einer reinen
Selection-Betrachtung auf eine Katalog-Betrachtung umgestellt:

- Der strukturelle Kern von `isListConfiguration` (Typ `upgrade`, Teilbaum
  durchgehend profil- und kostenlos) wird so nutzbar, dass er sowohl auf
  eine bereits gewählte Roster-Selection als auch auf eine rohe
  Katalog-Eintragsdefinition anwendbar ist (siehe CONTEXT.md,
  aktualisierter Glossareintrag „Listenkonfiguration" sowie neuer Eintrag
  „Listenkonfigurations-Kategorie").
- Die Enumeration „welche Einträge gehören laut Katalog zu dieser
  Kategorie" wird nicht neu erfunden, sondern folgt demselben
  Sichtbarkeits-/Primär-Kategorie-Mechanismus, den `CategoryUnitAdder.jsx`
  bereits für den Aushebe-Dialog verwendet (aktuell sichtbare,
  primär-kategorisierte Katalog-Einträge).
- `isListConfigurationCategory` liefert `true`, sobald jeder aktuell
  sichtbare Katalog-Eintrag der Kategorie eine Listenkonfiguration ist —
  unabhängig davon, ob schon etwas gewählt wurde. Eine Kategorie mit
  mindestens einem echten Einheiten-Eintrag bleibt beim bisherigen Verhalten
  (Aushebe-Dialog).
- `buildConfigurationRadioGroups` baut für Haupteinträge ohne existierende
  Roster-Selection eine virtuelle Radiogruppe im „Keine"-Zustand aus der
  Katalogdefinition, statt eine echte Selection vorauszusetzen.
- Wählt der Nutzer zum ersten Mal eine Option eines noch nicht gewählten
  Haupteintrags, entsteht die Top-Level-Selection für diesen Haupteintrag
  und die gewählte Option wird in einem Schritt gesetzt — der Endzustand
  ist identisch zu dem, was heute entsteht, wenn die Selection bereits
  existiert und eine Option gewechselt wird.
- „Armeeweite Auswahl" und „Sonstiges" (die beiden anderen Aufrufstellen von
  `isListConfigurationCategory` in `RosterEditor.jsx`) bleiben unverändert
  beim bisherigen, selection-basierten Verhalten — für sie gibt es keine
  feste Katalog-Kategorie, aus der sich der vollständige Eintrags-Umfang im
  Voraus ablesen ließe.

## User Stories / Requirements
1. Als Spieler, der eine neue Liste anlegt oder importiert, möchte ich die
   Kategorie „Special List Rules" sofort als aufklappbare Kachel mit ihrem
   echten Kategorienamen sehen, ohne vorher einen Aushebe-Dialog benutzen zu
   müssen, damit die Bedienung zur fachlichen Bedeutung passt (Regel-Schalter
   sind keine Einheiten).
2. Als Spieler möchte ich beim ersten Aufklappen der Kachel alle
   Haupteinträge der Kategorie direkt als klickbare Radio-Zeilen sehen
   (inkl. „Keine" und aller Unteroptionen, z. B. bei „Campaign/Scenario
   rules"), damit ich sofort auswählen kann.
3. Als Spieler möchte ich, dass ein Klick auf eine Options-Zeile eines noch
   nicht gewählten Haupteintrags die Auswahl sofort auf dem Roster setzt
   (ohne Zwischenschritt über den Aushebe-Dialog).
4. Als Entwickler möchte ich, dass Kategorien mit mindestens einer echten
   Einheit weiterhin unverändert über `CategoryUnitAdder` funktionieren,
   damit bestehendes Verhalten für normale Einheiten-Kategorien nicht
   bricht.

## Technical Decisions
- Affected Modules: `src/solver/listConfiguration.js`,
  `src/solver/listConfigurationView.js`, `src/hooks/useRoster.js`,
  `src/components/RosterEditor.jsx`, `src/components/editor/
  ListConfigurationCard.jsx`.
- Technical Clarifications / Architectural Decisions:
  - Die Katalog-Enumeration für die Reinheitsprüfung folgt derselben
    Sichtbarkeits-/Primär-Kategorie-Logik wie `CategoryUnitAdder.jsx`
    (`isEntryPrimaryInCategory` + `isSelectionEntryHidden`), um keine
    zweite, abweichende Enumerationslogik einzuführen (ADR 0003, keine
    kategorie-/katalogspezifische Sonderlogik).
  - Die strukturelle Kostenfrei-/Profilfrei-Prüfung bleibt auf der
    statischen, aufgelösten Eintragsdefinition (`resolveEntry`) wie im
    bestehenden `isListConfiguration` — keine Auswertung laufzeitbedingter
    Modifier für die Klassifikation selbst, konsistent zum bisherigen
    Verhalten.
  - Nur aktuell sichtbare Katalog-Einträge zählen für die
    Reinheitsprüfung (konsistent mit `CategoryUnitAdder`,
    `isCategoryLinkHidden`, `hasPrimaryCatalogItems`). Eine
    Listenkonfigurations-Kategorie enthält per Domänendefinition ohnehin
    keine echten Einheiten (siehe CONTEXT.md), der Fall „aktuell
    verdeckte echte Einheit" ist somit in der Praxis nicht relevant.
  - Für den „ersten Klick"-Fall wird `useRoster.js` um eine Operation
    ergänzt, die Anlegen der Top-Level-Selection und Setzen der gewählten
    Option atomar in einem Roster-Update durchführt (Wiederverwendung der
    bestehenden `createSelectionFromDef`-Logik aus `addUnit`, die
    Pflichtkinder wie bisher automatisch mandatiert, aber keine
    Radio-Option vorbelegt).
- API Contracts / Data Models: Keine Änderung am Roster-Datenmodell
  (`force.selections`-Form bleibt gleich); die neue Top-Level-Selection für
  einen Haupteintrag entsteht mit derselben Struktur, die `addUnit` heute
  für jede andere Einheit erzeugt.

## Testing Decisions
- Modules to Test: `src/solver/listConfiguration.test.js`,
  `src/solver/listConfigurationView.test.js`, `src/components/
  RosterEditor.test.jsx`, `src/hooks/useRoster.js` (über
  `RosterEditor.test.jsx`).
- Test Interfaces (Seams):
  1. Katalogbasiertes Klassifikationsmerkmal für rohe Katalog-Einträge
     (Ergänzung zu `isListConfiguration`).
  2. `isListConfigurationCategory` — liefert `true` bei 0 Selections, wenn
     die Katalogdefinition der Kategorie ausschließlich
     Listenkonfigurationen enthält; bestehender „is false for an empty
     category"-Test wird an das neue Verhalten angepasst.
  3. `buildConfigurationRadioGroups` — virtuelle Radiogruppen im
     „Keine"-Zustand für Haupteinträge ohne existierende Selection.
  4. Neue Roster-Mutation in `useRoster.js` — Anlegen + Options-Auswahl in
     einem Schritt, End-to-End über Klick-Interaktion mit
     `ListConfigurationCard` in `RosterEditor.test.jsx` geprüft.
  5. `RosterEditor.jsx`-Kategorieschleife — nutzt die neue Klassifikation;
     „Armeeweite Auswahl" und „Sonstiges" bleiben bei der alten,
     selection-basierten Prüfung.

## Out of Scope
- Änderungen an „Armeeweite Auswahl" und „Sonstiges" (die beiden anderen
  Aufrufstellen von `isListConfigurationCategory` in `RosterEditor.jsx`) —
  für sie gibt es keine feste Katalog-Kategorie, die sich analog enumerieren
  ließe.
- Gemischte Kategorien (echte Einheiten + Listenkonfigurationen im selben
  `categoryLink`) — laut Domänendefinition enthält eine
  Listenkonfigurations-Kategorie ohnehin keine echten Einheiten; die
  bestehende Reinheitsprüfung bleibt als Absicherung bestehen, hat aber
  keinen bekannten Anwendungsfall in echten Katalogdaten.
- Laufzeitbedingte Divergenz zwischen Katalogdefinition und tatsächlichem
  Roster-Zustand durch dynamische Modifier (z. B. ein Modifier, der Kosten
  eines normalerweise listenkonfigurativen Eintrags bedingt erhöht) — die
  Klassifikation bleibt wie bisher rein strukturell/statisch.
- Änderungen an `CategoryUnitAdder.jsx` selbst (bleibt für echte
  Einheiten-Kategorien unverändert im Einsatz).

## Acceptance Criteria
- [ ] Eine Kategorie, deren aktuell sichtbare Katalog-Einträge ausschließlich
      Listenkonfigurationen sind (katalogbasiertes Klassifikationsmerkmal,
      siehe CONTEXT.md „Listenkonfigurations-Kategorie"), rendert in
      `RosterEditor.jsx` immer als aufklappbare `ListConfigurationCard` — auch
      bei 0 Auswahlen auf dem Roster. Der `CategoryUnitAdder`-Aushebe-Dialog
      erscheint für eine solche Kategorie nicht mehr.
- [ ] Eine Kategorie mit mindestens einem echten Einheiten-Eintrag im Katalog
      bleibt unverändert beim bisherigen `CategoryUnitAdder`-Pfad.
- [ ] „Armeeweite Auswahl" und „Sonstiges" bleiben unverändert bei der
      bisherigen, selection-basierten Prüfung.
- [ ] Im aufgeklappten Zustand zeigt die Kachel für jeden Haupteintrag der
      Kategorie eine Radiogruppe (inkl. „Keine" und aller Unteroptionen, z. B.
      bei „Campaign/Scenario rules") — auch wenn für diesen Haupteintrag noch
      keine Roster-Selection existiert (virtueller „Keine"-Zustand).
- [ ] Ein Klick auf eine Options-Zeile eines noch nicht gewählten
      Haupteintrags legt dessen Top-Level-Selection an und setzt die gewählte
      Option in einem Schritt; der entstehende Roster-Zustand ist identisch zu
      dem, der heute entsteht, wenn dieselbe Option bei bereits existierender
      Selection gewählt wird.
- [ ] Ein Klick auf „Keine" bei einem bereits gewählten Haupteintrag entfernt
      dessen Auswahl wie bisher.
- [ ] Bestehende Tests für den selection-basierten Pfad
      (`listConfiguration.test.js`, `PlayMode.jsx`-Filterung) bleiben
      unverändert grün; `listConfigurationView.test.js`s „is false for an
      empty category"-Test wird an das neue Verhalten angepasst.

## Comments
- Klassifikation von isListConfigurationCategory auf katalogbasiert erweitert (isListConfigurationEntry, isListConfigurationCategoryFromEntries), Enumeration aus CategoryUnitAdder extrahiert (getVisibleCatalogueEntriesForCategory), virtuelle Radiogruppen in buildConfigurationRadioGroups, atomare addUnitWithSubSelection fuer die erste Optionswahl. Special-List-Rules-artige Kategorien rendern jetzt immer als ListConfigurationCard, auch ohne vorhandene Auswahl. Armeeweite Auswahl/Sonstiges unveraendert. Vier-Achsen-Verifikation durchgelaufen: Standards 0 Blocker, Spezifikation 0 fehlende Kriterien, Tests 761/761 gruen plus volle Puppeteer-E2E-Suite gruen, Doku-Luecken (ADR 0003, README, UI-Renderer-Audit) behoben. CONTEXT.md um 'Listenkonfigurations-Kategorie' ergaenzt.
