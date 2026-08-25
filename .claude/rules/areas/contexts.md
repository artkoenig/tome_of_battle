---
paths:
  - "src/contexts/**"
---

# contexts — der Schnitt nach Fachlichkeit

Vier Bounded Contexts (ADR-0042): `armylist` (Schreibmodell + Datenfassade), `ruleengine`
(Reinraum-Engine, ACL, Lesemodell), `catalog` (Systembibliothek, Katalogrevisionen),
`rulebook` (Regeltext-Index). Jeder Kontext ist eine Schublade, aus der man nicht
seitwärts greift.

- **Kein Kontext importiert einen anderen** — `kontext-kein-fremder-kontext` in
  `.cast/rules.json`, blockierend. Was zwei Kontexte teilen, gehört nach `src/shared/**`
  (Fan-out 0) oder nirgendwohin. Die einzige Ausnahme ist die eine Tür des Lesemodells,
  `ruleengine/readmodel/index.js`, die von überall importiert werden darf.
- **`src/platform/**` erreicht ein Kontext nur über seinen Port**:
  `armylist/ports/storagePort.js` und `catalog/ports/catalogRepository.js` sind die
  einzigen Module unter `src/contexts/`, die die Plattform nennen dürfen
  (`kontext-nicht-auf-plattform`). Sie enthalten nur `export { … } from '…/platform/…'` —
  ein fehlender Name wird dort ergänzt, nie direkt importiert. Ein `vi.mock` auf ein
  Plattformmodul wirkt durch den Port hindurch, weil er nur re-exportiert.
- Die Engine wird von außen **nur** über `ruleengine/evaluator.js` angesprochen
  (`evaluator-nur-ueber-fassade` in cast, `no-restricted-imports` in `.oxlintrc.json`).
  In `.oxlintrc.json` gewinnt der **spätere** Override: der Block für
  `src/contexts/ruleengine/engine/**` muss hinter dem für `src/contexts/ruleengine/**`
  stehen, sonst verbietet die Fassaden-Regel den Engine-Modulen ihre eigenen Nachbarn.
- `npm run cast` ist die Probe für jede dieser Grenzen und läuft in `forge-lint` mit. Die
  Ausnahmen unter `allowed` gelten **global**, nicht nur für die gleichnamige Regel: eine
  weit gefasste Ausnahme (`ruleengine/** -> ruleengine/**`) schaltet stillschweigend auch
  `nur-die-acl-ruft-die-engine` und `lesemodell-nur-ueber-fassade` ab. Ausnahmen deshalb
  auf Schicht-Paare schneiden, nicht auf Verzeichnisbäume.
- Tests liegen gespiegelt unter `src/tests/contexts/<kontext>/…`, nicht neben dem Modul.
  Lauf: `forge-test --run src/tests/contexts`.
- Pfad-Zeichenketten in Kommentaren: `src/contexts/*/application/` schreibt in einem
  Blockkommentar ein `*/` und beendet ihn — im Fließtext eines `.js` immer ohne Glob
  formulieren.
