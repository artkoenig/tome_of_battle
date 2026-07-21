Status: ready-for-agent
Type: chore
Blocked by: [02]

## Description

Dokumentiert die mit 01 und 02 eingeführte Statik-Toolchain in einer neuen ADR.
Blockiert durch 02, weil die ADR die dann fertige Toolchain und die exakten
Rollen beschreibt.

Umfang dieser Scheibe:
- Neue ADR unter `docs/adr/` (nächste freie Nummer, Format wie bestehende ADRs):
  - **Rollenverteilung** der drei Statik-Werkzeuge: oxlint (schnelle,
    dateilokale Regeln + Fassaden-Import-Regel), Knip (dateiübergreifend toter
    Code/Exports/Deps), dependency-cruiser (Schichtung, Fassade als Regel,
    Zyklen, verwaiste Module). Warum drei Werkzeuge statt einem, wo sie sich
    abgrenzen und wo sie sich bewusst überlappen (Fassade: oxlint + depcruise).
  - **Gate-Strategie**: Start **warn-only** in CI, mit dokumentiertem Plan,
    später auf **blockierend** hochzuziehen, sobald der Alt-Bestand bereinigt
    ist. Festhalten, dass das Aufräumen der Befunde in eigenen Folge-Issues
    passiert.
- Eintrag der neuen ADR in `docs/adr/README.md` (Index).
- Querverweis-Hinweis in **ADR 0006** (Testing/Automation) auf die erweiterte
  Statik-Toolchain, ohne dessen Kernaussagen zu duplizieren.

## Acceptance Criteria
- [ ] Neue ADR existiert unter `docs/adr/`, folgt dem Format der bestehenden
      ADRs (Status, Datum, Kontext, Entscheidung, Konsequenzen) und benennt
      Rollenverteilung sowie Gate-Strategie explizit.
- [ ] `docs/adr/README.md` listet die neue ADR im Index.
- [ ] ADR 0006 verweist auf die erweiterte Toolchain, ohne Aussagen zu
      duplizieren, und widerspricht ihr nicht.
- [ ] Die ADR nennt den geplanten Übergang warn-only → blockierend und die
      Abgrenzung „Tools einführen ≠ Befunde beheben".

## Comments
