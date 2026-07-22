Status: ready-for-agent
Type: feature
Blocked by: [02]

## Description
Vollständige Extraktion aller verbleibenden hartkodierten App-Chrome-Texte in
die Sprachdateien (Spec im Main-Issue 58-i18n). Betroffen sind alle
Komponenten mit sichtbaren Texten — Listenverwaltung, Editor, Importer,
Dialoge, Toasts, BottomSheets — einschließlich Attribut-Texten (`aria-label`,
`title`, `placeholder`, `alt`) und parametrisierten Import-/
Serialisierungs-Fehlermeldungen (`importMessages`, Roster-Serialisierung).
Danach existiert kein deutscher UI-String mehr im Komponenten- und
Utility-Code; die App ist in beiden Sprachen vollständig bedienbar.

Nicht übersetzt werden: Katalog-Inhalte (Katalogsprache, Pass-through),
Log-/Konsolen-Ausgaben, Code-Kommentare. Die Validator-Meldungen des Solvers
sind Issue 04 (das parallel läuft — die Schnittstelle dorthin nicht anfassen).

Deutsche Texte bleiben wortgleich erhalten (reine Extraktion, keine
Umformulierung); die englischen Übersetzungen entstehen neu.

## Acceptance Criteria
- [ ] Kein hartkodierter nutzersichtbarer App-Chrome-String mehr in
      `src/components/**`, `src/utils/**`, `src/App.jsx` (Nachweis z. B. per
      Umlaut-/Wortlisten-Grep über JSX-Textknoten und Attribut-Strings).
- [ ] Die App ist in Deutsch und Englisch vollständig bedienbar; kein
      sichtbarer Schlüssel-Rohtext, keine Sprachmischung im App-Chrome.
- [ ] Deutsche Ausgabe ist wortgleich zum Ist-Stand (bestehende Tests laufen
      mit gepinntem Deutsch unverändert grün).
- [ ] Paritätstest weiterhin grün (alle neuen Schlüssel in beiden Sprachen).
- [ ] Mindestens ein Smoke-Test rendert eine zentrale Ansicht auf Englisch und
      findet englische Texte.

## Comments
