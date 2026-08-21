---
paths:
  - "docs/testing/**"
---

# E2E-Szenarien des Evaluators

Ein Szenario ist ein Verzeichnis aus `rosters/*.ros`, `README.md` und `scenario.json`. Die
`scenario.json` ist das Manifest, das der Runner (`src/domain/evaluator/e2e.testcatalog.test.js`)
abarbeitet; das README ist die **Herleitung** dazu und keine Prosa-Beigabe — jeder Soll-Wert im
Manifest muss dort aus den Katalogdaten begruendet sein (ADR 0033).

- Geschrieben wird hier **ausschliesslich aus `.cat`/`.gst`-Daten**, nie aus dem Engine-Quellcode.
  Neue Szenarien schreibt der `e2e-testcase-author`-Subagent; wer eine bestehende Erwartung in
  einem Implementierungslauf nachziehen muss, haelt dieselbe Leseliste ein
  (`.claude/agents/e2e-testcase-author.md`): Format-Spec, `Catalogue.xsd`, die Fixture-Kataloge,
  vorhandene Szenarien — sonst spiegelt der Test den Bug statt ihn zu fangen.
- Der Feldvertrag des Manifests steht vollstaendig in `.claude/agents/e2e-testcase-author.md`
  (Abschnitt zum `scenario.json`-Schema) — dort nachsehen, nicht raten.
- **Ein weggelassenes Feld ist keine Behauptung.** In `expect.capabilities` wird nur gepinnt, was
  die Katalogdaten eindeutig hergeben; was unklar ist, gehoert in den README-Abschnitt „bewusst
  nicht behauptet" statt geraten ins Manifest.
- `count: 0` in `expect.messages` ist die einzige maschinelle Form fuer „das meldet nicht".
  „Dieser Slot existiert nicht" laesst sich gar nicht ausdruecken und bleibt Prosa-Negativfall.
- Ein Slot auf einen **verlinkten** Wurzel-Eintrag wird ueber `targetDefId` + `anchorKind` +
  `frameDefId` benannt, nicht ueber `defId`: mehrere Armeebuecher verlinken dieselbe geteilte
  Definition, die Link-Id ist je Buch verschieden, die Ziel-Id ist allen gemeinsam.
- Bevor eine Bibliotheks-Einheit (Mercenaries u. a.) als Angebot unter einem Armee-Kontingent
  gepinnt wird: pruefen, ob **dieses** Armeebuch selbst einen Wurzel-`entryLink` auf die Ziel-Id
  fuehrt. Seit Issue 0159 verankert der Link eines fremden Buchs nichts mehr — ein Grep ueber alle
  `.cat` findet den Link, sagt aber nichts darueber, wer ihn besitzt.
- `hidden` von Verweis und Ziel wirken **oder**-verknuepft. Eine geteilte Definition mit
  `hidden="true"` ist ein verborgenes Angebot, obwohl jeder `entryLink` darauf `hidden="false"`
  traegt — ein verborgener Slot wird materialisiert und markiert, nie weggelassen.
- Regel-Ids (`VCC-R…`, `OCS-R…`) werden zwischen den READMEs per relativem Link zitiert. Wer eine
  Regel umnummeriert oder ersetzt, zieht die Verweise im Schwester-README nach.
- Ausgefuehrt wird das alles von `forge-test --run src/domain/evaluator`; ein geaendertes Manifest
  braucht keine weiteren Checks, solange kein `src/`-Code angefasst wurde.
- Rote Szenarien, die absichtlich rot bleiben, stehen in `docs/testing/campaign-state.json`;
  `worklist.json`/`covered-cells.json` bewegen sich nur bei einem **neuen** Zellenschluessel.
