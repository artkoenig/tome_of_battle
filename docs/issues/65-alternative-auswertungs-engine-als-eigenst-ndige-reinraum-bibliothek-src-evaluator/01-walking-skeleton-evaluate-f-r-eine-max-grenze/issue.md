Status: resolved
Type: chore
Blocked by: None

## Description

Erster End-to-End-Tracer-Bullet. Legt das isolierte Modul `src/evaluator/` an
(eigene Fassade als einzige Außenschnittstelle; harte Import-Trennung zu
`src/solver/` in beide Richtungen; Import aus `src/parser/` erlaubt; nur
test-importierter Zustand von `no-orphans` toleriert) und den dünnstmöglichen
`evaluate(katalog, roster) → Bericht`-Pfad: eigener minimaler XML-Leser →
Evaluationsbaum (noch ohne Phantomknoten) → minimaler Zählindex/Query →
Auswertung **einer** MAX-Grenze auf Selektionsanzahl. Reine Bibliothek, keine
App-Verdrahtung. Grundlage: `docs/evaluator-architecture.md`, ADR-0030.

## Acceptance Criteria
- [ ] `evaluate(katalog, roster)` ist als reine Funktion über die Fassade
      aufrufbar und liefert für einen minimalen Katalog + Roster einen Bericht.
- [ ] Ein Roster, das eine MAX-Grenze auf Selektionsanzahl überschreitet, erzeugt
      eine Verletzung mit Ist-Wert, effektivem Grenzwert, Delta und Bezugsinstanz.
- [ ] Ein Roster innerhalb dieser MAX-Grenze erzeugt dafür keine Verletzung.
- [ ] Der Evaluator importiert weder aus `src/solver/` noch wird er von dort
      importiert; Zugriff von außen nur über die Fassade (statisch geprüft,
      Lint/depcruise grün).
- [ ] `evaluate()` hat keine Seiteneffekte und liest/schreibt keinen App-Zustand,
      keine UI und kein IndexedDB.

## Comments
- Walking-Skeleton der Reinraum-Engine src/evaluator/: Fassade evaluator.js (evaluate(catalogXml, roster)) mit duennem End-to-End-Pfad eigener XML-Leser -> Resolver -> Join/Evaluationsbaum (ohne Phantome) -> Zaehlindex/Query-Primitiv -> Constraint-Schicht (nur MAX auf Selektionsanzahl, ROSTER-Scope) -> Bericht mit Verletzungstripel. Harte Import-Trennung zu src/solver/ in beide Richtungen und Fassaden-Zwang maschinell in .oxlintrc.json (error) und .dependency-cruiser.cjs (error) durchgesetzt und per Probe-Import verifiziert. 6 Tests gruen, Gesamtsuite gruen.
