Status: claimed
Type: fix
Blocked by: None

## Description

Zwei kleine, voneinander unabhängige Solver-Korrekturen, die als getrennte
Haupt-Issues mehr Zeremonie als Arbeit gekostet hätten. Ersetzt Issue 48 und
Issue 45.

### Was hier zusammengefasst ist

- **Kind 01** (aus Issue 48): Eine Kostenlimit-Constraint auf einer
  Auswahlgruppe entscheidet *ob* sie eine Kostengrenze ist aus `con.field`,
  summiert die Kosten aber über `roster.costLimitType`. Nennt die Constraint
  eine andere Kostenart als die eingestellte, wird die falsche Zahl geprüft.
- **Kind 02** (aus Issue 45): `reconcileImportedSelectionIds` verändert das
  übergebene Roster in-place und gibt ein `boolean` zurück, während die
  Nachbarfunktion auf demselben Import-Pfad den entgegengesetzten Vertrag
  erfüllt.

### Warum zusammen

Beide sind klein, beide liegen im Solver, beide haben vollständig geklärte
Akzeptanzkriterien und **keine gemeinsamen Dateien** — Kind 01 fasst
`rosterValidator.js` an, Kind 02 `rosterSync.js` und `App.jsx`. Sie sind
deshalb parallel implementierbar und tragen kein Konfliktrisiko gegeneinander.
Der einzige Berührungspunkt ist der Kommentarkopf in
`src/solver/__fixtures__/grimdarkSystem.js`, den nur Kind 02 anfasst.

### Beide Triage-Fragen sind vor der Umsetzung beantwortet

Die abgelösten Issues ließen je eine Frage offen; beide sind recherchiert und in
den Kind-Issues festgehalten:

- **48:** Führt ein realer Katalog eine Gruppen-Constraint auf einer
  Nicht-Punkte-Kostenart? **Nein** — Gegenprobe über alle `.cat`/`.gst` des
  WHFB6-Forks ergibt ausschließlich `selections` und die Punkte-Kostenart. Der
  Fehler ist latent; der Test baut auf Fixtures auf.
- **45:** Muss der `boolean` erhalten bleiben, weil er das Speichern steuert?
  **Nein** — `src/App.jsx:324` wertet ihn gar nicht aus. Er entfällt ersatzlos,
  Idempotenz wird über Referenzgleichheit geprüft.

Herkunft: Neubewertung gegen `architecture-principles` /
`code-generation-principles` vom 2026-07-21 (Befund 2) sowie Nebenbefund aus
Kind-Issue 47/02. Setzt Issue 47 und ADR 0003 §3a fort.

## Acceptance Criteria
- [ ] Eine Kostenlimit-Constraint misst die Kostenart, die sie selbst nennt —
      auf Gruppen-Ebene wie auf Eintrags-Ebene.
- [ ] Der Import-Pfad in `src/App.jsx` folgt durchgehend einer Konvention:
      Roster rein, neues Roster raus, keine Mutation.
- [ ] Kein Verhalten ändert sich, das nicht durch ein Akzeptanzkriterium eines
      Kind-Issues gedeckt ist.
- [ ] `npm test` grün, `npm run lint` 0 Fehler / 0 Warnungen.

## Comments
