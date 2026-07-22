Status: ready-for-agent
Type: feature
Blocked by: None

## Description

Fundament-Slice für Issue 58 (reine Darstellung). Heute rendern drei Stellen
Validierungsmeldungen je eigenem Markup mit ad-hoc gestylten Klassen; es gibt
keine gemeinsame Komponente und keinen verbindlichen Schweregrad-Kontrakt.

Diese Slice führt **eine gemeinsame Anzeige-Komponente** ein, die alle drei
Renderstellen ersetzt (Validierungs-/Lagerbericht-Panel, Einheitenkarte,
Kategorie-Abschnitt), und legt einen **verbindlichen Darstellungs-Kontrakt je
Schweregrad** (error/warning/info) fest — Farbe, Icon und Ton, überall gleich.

Bewusst **noch keine Wortlaut-Änderung**: Die Komponente zeigt zunächst die
bestehenden Meldungstexte unverändert an (App- wie Autor-Meldungen). Es ändert
sich nur das einheitliche Aussehen. Autor-Meldungen bleiben wortgetreu.

Der Schweregrad-Kontrakt ist schwer reversibel, sobald Komponenten darauf bauen,
und ADR 0004 definiert dafür heute keine Konvention — daher wird die Entscheidung
als **neue ADR (0026)** festgehalten (konkrete Token-Werte hier fixiert).

## Acceptance Criteria
- [ ] Eine einzige, wiederverwendbare Komponente rendert eine Validierungsmeldung
      und wird an allen drei bisherigen Renderstellen verwendet; die bisherigen
      ad-hoc `<div>`+Icon+CSS-Blöcke sind entfernt.
- [ ] error/warning/info werden an allen Stellen einheitlich dargestellt
      (Farbe + Icon je Schweregrad), gemäß dem neuen Kontrakt.
- [ ] Die angezeigten Meldungstexte sind unverändert gegenüber vorher (kein
      Reword) — App- und Autor-Meldungen erscheinen wortgleich wie zuvor.
- [ ] Neue ADR 0026 dokumentiert den Schweregrad-Darstellungs-Kontrakt
      (Token für Farbe/Icon/Ton je error/warning/info) und ist im ADR-Index
      (docs/adr/README.md) verlinkt.
- [ ] Komponententests decken die Darstellung je Schweregrad ab; volle Suite grün.

## Comments
