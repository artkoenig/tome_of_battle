Status: resolved
Type: fix
Blocked by: [01]

## Description
Der Heerlager-Editor (`RosterEditor.jsx`) rendert aktuell jede Selection
gleich, egal ob Einheit oder Listenkonfiguration (siehe `CONTEXT.md`,
Klassifikationsmerkmal aus Child-Issue 01): eine listenweite Regel-Option wie
„Allow experimental rules?" erscheint dort optisch nicht von einer echten
Einheit unterscheidbar — Kosten-Badge nur zufällig unterdrückt, weil 0 Pkt.,
leerer Profil-Umschalter, Kopieren-/Löschen-Aktionen wie bei einer Einheit.

Für jede Kategorie, deren Selections ausschließlich Listenkonfigurationen
sind, rendert der Editor stattdessen eine einzige aufklappbare Karte:

- Kartentitel = der echte, dynamische Name der Kategorie (kein erfundener
  Sammelbegriff, kein „x von y aktiv"-Zähler).
- Eingeklappt zeigt die Karte die aktuell gewählten Optionen als Badges — im
  selben visuellen Stil wie die bestehenden `upgrade-badge`/`rule-badge`-Chips
  auf Einheitenkarten, mit der Info-Akzentfarbe statt Gold. Ein Haupteintrag
  ohne Auswahl („Keine") erzeugt keine Badge.
- Aufgeklappt listet die Karte die Optionen aller Haupteinträge der Kategorie
  direkt untereinander als klickbare Radio-Zeilen (inkl. „Keine" je
  Haupteintrag) — ohne die Namen der Haupteinträge als Zwischenüberschriften.
  Ein Klick auf eine Zeile wählt sie direkt (setzt die Roster-Selection), ohne
  einen separaten Konfigurations-Dialog zu öffnen.
- Kein Kosten-Slot, keine Kopieren-/Löschen-Aktionen.

Kategorien mit echten Einheiten bleiben unverändert (`UnitSelectionCard`).

## Acceptance Criteria
- [ ] In `RosterEditor.jsx` rendert eine Kategorie, deren Selections
      ausschließlich als Listenkonfiguration klassifiziert sind (Merkmal aus
      Issue 01), eine aufklappbare Karte statt einer oder mehrerer
      `UnitSelectionCard`s.
- [ ] Der Kartentitel entspricht dem echten, dynamischen Kategorienamen aus
      den Katalogdaten.
- [ ] Im eingeklappten Zustand zeigt die Karte je Haupteintrag mit einer
      Auswahl ungleich „Keine" eine Badge mit dem Namen der gewählten Option;
      ein Haupteintrag auf „Keine" erzeugt keine Badge; kein „x von y"-Zähler
      ist sichtbar.
- [ ] Im aufgeklappten Zustand listet die Karte alle Optionen aller
      Haupteinträge der Kategorie (inkl. „Keine" je Haupteintrag) direkt
      untereinander als Radio-Zeilen, ohne Zwischenüberschriften mit den
      Namen der Haupteinträge.
- [ ] Ein Klick auf eine Options-Zeile setzt sie sofort als aktive Auswahl
      der Roster-Selection (inklusive Wechsel weg von „Keine" oder zurück zu
      „Keine") — ohne einen SelectionConfigurator-Dialog zu öffnen.
- [ ] Die Karte zeigt keinen Kosten-Slot und keine Kopieren-/Löschen-Aktionen.
- [ ] Kategorien mit ausschließlich echten Einheiten-Selections rendern
      unverändert als `UnitSelectionCard`s.
- [ ] Der Aushebe-Dialog (`CategoryUnitAdder.jsx`) bleibt unverändert.

## Comments
- Editor rendert eine Kategorie mit ausschließlich Listenkonfigurationen als einzelne aufklappbare ListConfigurationCard: eingeklappt Info-akzentuierte Badges der gewählten Optionen, aufgeklappt flache Radio-Zeilen (inkl. 'Keine' je Haupteintrag), Klick setzt die Roster-Selection direkt ohne Konfigurator-Dialog, kein Kosten-Slot/Kopieren/Löschen. Reine Einheiten-Kategorien und CategoryUnitAdder unverändert. Klassifikation via isListConfiguration (Child-Issue 01).
