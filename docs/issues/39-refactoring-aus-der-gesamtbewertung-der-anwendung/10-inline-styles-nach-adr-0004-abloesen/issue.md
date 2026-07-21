Status: ready-for-agent
Type: refactor
Blocked by: None

## Description

**Geruch:** Drift von einer aktiven Architekturentscheidung.

ADR-0004 §1 formuliert ein striktes Inline-Style-Verbot mit einer einzigen
Ausnahme: laufend berechnete Werte. Tatsächlich finden sich **180 Inline-Styles
in 15 Dateien**, mit den Schwerpunkten im Roster-Editor, im Dashboard, in den
Auto-Fill-Vorschlägen, in den Spiel-Details, in der Spielansicht und im
Importer. Die drei größten Dateien decken bereits rund 44 Prozent ab.

Die große Mehrheit sind statische Layoutwerte — Flex-Ausrichtungen, Abstände,
Textabschneidung —, keine dynamisch berechneten Größen. Der Schaden ist der von
der ADR selbst beschriebene: die zentrale Design-Anpassung, welche die
Stylesheet-Schicht ermöglichen soll, greift für diese 180 Stellen nicht.

Dies ist ausdrücklich **kein Hinweis auf eine überholte ADR**: die Entscheidung
ist aktiv und wird in neueren Dateien auch befolgt. Es handelt sich um Drift.

**Vorgeschlagene Behebung:** Utility-Klassen für die wiederkehrenden Muster
(Flex-Zeile, abgeschnittener Titel, Standardabstände) in der zentralen
Stylesheet-Schicht anlegen, dann dateiweise ablösen — beginnend bei den drei
größten Dateien.

## Acceptance Criteria
- [ ] Für die wiederkehrenden Layoutmuster existieren benannte Klassen in der
      zentralen Stylesheet-Schicht
- [ ] Die statischen Inline-Styles der betroffenen Dateien sind abgelöst
- [ ] Verbleibende Inline-Styles betreffen ausschließlich laufend berechnete
      Werte und sind als solche erkennbar
- [ ] Das Erscheinungsbild ist unverändert; belegt durch einen Screenshot der
      betroffenen Ansichten vor und nach der Änderung
- [ ] `npm run lint` und `npm test` bleiben grün

## Comments

Berührt dieselben Dateien wie der offene Pull Request zur
UI-Internationalisierung — erst nach dessen Merge bearbeiten.

Umfangreich, aber nicht schwierig: die Aufgabe ist dateiweise planbar und kann
in mehreren Durchgängen erledigt werden.
- Sperre aufgehoben (2026-07-21): Der urspruengliche Kommentar verlangte, den Merge des i18n-Pull-Requests (#85) abzuwarten, da beide dieselben Dateien beruehren. Entscheidung des Maintainers: die UI-Internationalisierung wird nach Abschluss des Refactorings neu aufgerollt, statt den bestehenden PR vorher zu mergen. Damit entfaellt die Wartebedingung und dieses Kind-Issue kann bearbeitet werden.
