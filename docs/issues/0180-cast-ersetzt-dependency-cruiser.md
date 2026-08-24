---
status: active
branch: claude/cast-soll-depcruise-ersetzen-ye1o4q
pr:
---

# cast ersetzt dependency-cruiser als Struktur-Prüfung

## Goal

Die Struktur-Prüfung des Importgraphen (Schichtung, Reinraum-Fassade, Zyklen, Waisen), heute von
dependency-cruiser getragen, läuft über das `cast`-Plugin. Überall, wo dependency-cruiser heute
verdrahtet ist — `forge-lint`, CI, der Zustandsbericht unter `scripts/project-state/` — spricht
danach cast, mit denselben Schweregraden (`warn`/`error`) wie heute, und dependency-cruiser ist aus
dem Projekt entfernt.

`cast` ist ein Claude-Code-Plugin-Binary (aufgelöst über `command -v cast`, sonst
`${CLAUDE_PLUGIN_ROOT}/bin/cast`), kein npm-Paket — anders als dependency-cruiser lässt es sich
nicht per `npm ci` installieren. **Angenommene Konsequenz** (im Zweifel so zu handhaben, nicht
erneut zu erfragen): ein CI-Schritt, der `cast` aufruft, ist in einem GitHub-Actions-Runner ohne das
Plugin nicht lauffähig; die bisherige `dependency-cruiser`-CI-Prüfung ist bereits `continue-on-error`
und damit rein informativ. Ersetzt wird sie durch nichts Gleichwertiges in CI — die Prüfung bleibt
lokal/Agent-seitig über `forge-lint`. Der bestehende CI-Schritt darf nicht auf ein gelöschtes
npm-Script zeigen; wie er endet (entfernt, oder durch einen dokumentierenden Hinweis ersetzt), ist
Sache der Umsetzung.

`cast` kennt in `.cast/rules.json` keinen eigenen Regeltyp für Zyklen oder Waisen (anders als
dependency-cruisers `to: { circular: true }` bzw. `from: { orphan: true }`) — dafür macht `cast
scan`/`cast report` Zyklen und unaufgelöste Importe im Graphen direkt sichtbar, ohne Schweregrad.
**Angenommene Konsequenz:** die zwei entsprechenden dependency-cruiser-Regeln (`no-circular`,
`no-orphans`, beide bereits `warn`-only) werden nicht 1:1 als `.cast/rules.json`-Regel nachgebaut,
sondern durch die dazu passende cast-Ausgabe ersetzt; das gehört in die neue ADR, nicht stillschweigend
zu verschwinden.

## Acceptance criteria

- AC1: Jede pfadbasierte dependency-cruiser-Regel aus dem heutigen `forbidden`-Array — die eine
  Schicht-, Fassaden- oder Reinraum-Grenze beschreibt (nicht `no-circular`/`no-orphans`, siehe oben)
  — existiert als gleichnamige `.cast/rules.json`-Regel mit demselben Schweregrad wie heute.
  | verify: `node -e "const r=require('./.cast/rules.json').forbidden; const want={'ableitungen-nur-in-viewmodels':'error','viewmodel-keine-komponente':'error','komponente-kein-bericht':'error','viewmodel-keine-datenschicht':'error','ui-nicht-auf-daten':'error','daten-kein-rueckgriff':'error','fachlogik-kein-rueckgriff':'error','keine-i18n-unter-ui':'error','evaluator-keine-roster-abhaengigkeit':'error','roster-keine-evaluator-abhaengigkeit':'error','roster-keine-evaluation-abhaengigkeit':'error','evaluation-keine-roster-abhaengigkeit':'error','evaluator-nur-ueber-fassade':'error','schichtung-parser-kein-rueckgriff':'warn'}; for(const [n,sev] of Object.entries(want)){const rule=r.find(x=>x.name===n); if(!rule) throw new Error('missing '+n); if(rule.severity!==sev) throw new Error(n+' severity '+rule.severity+' != '+sev)}"`
- AC2: `forge-lint` prüft die Struktur über cast statt über `npm run depcruise` und ist auf dem
  heutigen Stand des Codes weiterhin grün (kein neuer, durch den Werkzeugwechsel entstandener
  Fehlschlag). | verify: `! grep -q depcruise .forge/config.json && forge-lint`
- AC3: Der CI-Workflow ruft dependency-cruiser nicht mehr als Struktur-Check auf (der bisherige,
  informative `continue-on-error`-Schritt entfällt ersatzlos — siehe Annahme oben). `package.json`
  bleibt in diesem Zuschnitt unangetastet: die Scripts `depcruise`/`analyze` und die
  `dependency-cruiser`-devDependency bleiben bestehen, weil `scripts/project-state/gates.js`
  weiterhin `npm run depcruise` aufruft, bis AC5/AC6 das umstellen. | verify: `! grep -q "npm run depcruise" .github/workflows/ci.yml`
- AC4: ADR 0024 ist fortgeschrieben (Status auf „Superseded" o. ä., Verweis auf die neue ADR), und
  eine neue ADR unter `docs/adr/` dokumentiert die Entscheidung für cast — inklusive der beiden
  oben festgehaltenen Annahmen (CI bleibt ohne Struktur-Gate, kein 1:1-Ersatz für
  `no-circular`/`no-orphans`) — und ist in `docs/adr/README.md` gelistet.
  | verify: `grep -qi superseded docs/adr/0024-statik-toolchain-oxlint-knip-dependency-cruiser.md`
- AC5: `scripts/project-state/` (der Zustandsbericht-Generator, sein `depcruise`-Gate und die
  Graph-Analyse) liest den Importgraphen über `cast scan` statt über `npx depcruise --output-type
  json`. | verify: `! grep -rqE "npx depcruise|output-type json" scripts/project-state/generate.js scripts/project-state/gates.js`
- AC6: Jetzt, wo nichts im Projekt mehr dependency-cruiser aufruft, ist es vollständig entfernt —
  keine `devDependency`, keine `.dependency-cruiser.cjs`.
  | verify: `! grep -q '"dependency-cruiser"' package.json && test ! -f .dependency-cruiser.cjs`

## Out of scope

- Aufräumen bestehender Struktur-Befunde (`warn`-Regeln, die heute schon Treffer melden) — dieses
  Vorhaben führt nur das Werkzeug, nicht das Beheben seiner Funde (Muster aus ADR 0024).
- Ein CI-Gate, das cast tatsächlich ausführt — siehe Annahme oben; das ist eine eigene, ungeklärte
  Frage (Distribution des Plugin-Binaries außerhalb einer Claude-Code-Session), kein Teil dieses
  Issues.
- `knip` und oxlint bleiben unverändert.
