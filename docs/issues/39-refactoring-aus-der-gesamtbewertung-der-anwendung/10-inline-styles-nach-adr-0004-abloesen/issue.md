Status: resolved
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
- Alle 181 Inline-Styles in 17 Dateien nach ADR-0004 abgeloest: eine dokumentierte Utility-Schicht (flex-row/flex-col/gap-N/no-shrink/push-end u.a.) plus benannte Komponentenklassen in src/index.css; boolesche Zustaende (Fehler, vernichtet, gesperrt, Unter-Einheit) laufen jetzt ueber Modifier-Klassen. Uebrig bleibt einzig die laufend berechnete Tooltip-Position in GothicTooltip.jsx - die von der ADR ausdruecklich erlaubte Ausnahme. Die doppelte Profilzellen-Einfaerbung aus Editor und Spielmodus liegt jetzt in src/components/profileCellClasses.js mit eigenen Unit-Tests.
- Abweichung vom Kriterium 'Erscheinungsbild unveraendert' — bewusst so entschieden (2026-07-21, Maintainer): Zwei Schriftgroessen wurden auf die semantische Skala nach ADR-0004 Paragraph 3 abgebildet und sind dadurch nicht pixelgleich. (1) '1.2rem' -> var(--fs-subheading), Kategorie-Ueberschrift im Spielmodus: auf dem Desktop identisch, auf Mobilgeraeten 1.2 -> 1.05rem. (2) '0.9rem' -> var(--fs-body), Breakdown-Listen im Bottom Sheet: 0.9 -> 0.95rem auf ALLEN Viewports, nicht nur mobil. Die Treue zur ADR wiegt hier schwerer als die pixelgenaue Erhaltung; die Abweichung bleibt bestehen und ist kein offener Mangel. Ebenfalls festgehalten: der Screenshot-Beleg war nicht erzeugbar, da public/catalogs/whfb6/ im Repo fehlt — abgesichert wurde stattdessen ueber den Puppeteer-E2E-Lauf und einen zeilenweisen Kaskadenabgleich.
