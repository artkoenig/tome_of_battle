Status: resolved
Type: chore
Blocked by: [01]

## Description
Ein dedizierter, projektspezifischer Subagent uebernimmt kuenftig die Erstellung
von E2E-Testfaellen fuer den Evaluator — bewusst **blind fuer den App-/Evaluator-
Quellcode**, damit sich die Testfaelle aus der Datenformat-Spezifikation und den
echten Katalogdaten ableiten und nicht aus der Engine-Implementierung (sonst
zementiert der Test vorhandene Engine-Bugs statt des fachlich erwarteten
Verhaltens).

Der Agent leitet die zu pruefenden Regeln allein aus seiner **Allow-List** ab:
der Datenformat-Spezifikation, der vendored XSD und den zugehoerigen ADRs, den
echten Katalogdaten-Fixtures und den bestehenden Szenarien als Formatvorlage.
Jeder Blick in den App-/Evaluator-Quellcode ist ihm untersagt; weil die
Katalogdaten selbst unter `src/` liegen, ist der Ausschluss als Allow-List
formuliert, nicht als pauschale `src/`-Sperre. Durchgesetzt wird das ueber
Werkzeug-Beschraenkung (nur lesende/schreibende Basiswerkzeuge, kein Bash) und
eine strikt formulierte Rolle — bewusst ohne durchsetzenden Hook.

Je Auftrag liefert der Agent ein vollstaendiges Testszenario im Format aus
Child-Issue 01: die minimalen `.ros`-Roster, die die beschriebene Regel ausloesen,
die begleitende Szenario-README mit den aus den Daten abgeleiteten Regeln und dem
erwarteten Verhalten, sowie das maschinenlesbare Manifest, das der Runner
konsumiert. Der Runner selbst und jede `.test.js` gehoeren nicht zu seinem
Liefergegenstand.

Nicht im Scope: die Migration bestehender Szenarien; die Verankerung der
Delegations-Regel in der Projektkonfiguration (Child-Issue 04).

## Acceptance Criteria
- [ ] Es existiert eine projektspezifische Subagent-Definition fuer das Autoren
      von E2E-Testfaellen, die nur lesende/schreibende Basiswerkzeuge erhaelt
      (kein Bash) und deren Rolle den App-/Evaluator-Quellcode ausdruecklich
      verbietet und die erlaubten Lesequellen als Allow-List benennt.
- [ ] Die Rolle beschreibt den Liefergegenstand je Auftrag vollstaendig: minimale
      `.ros`-Roster, Szenario-README und das Manifest im Format aus Issue 01.
- [ ] Der Agent kann aus einer fachlichen Regelbeschreibung ein vollstaendiges,
      vom Runner konsumierbares Szenario erzeugen, ohne App-/Evaluator-Code zu
      lesen (an mindestens einem Beispiel belegt).

## Comments
- Projektspezifische Subagent-Definition .claude/agents/e2e-testcase-author.md angelegt: Werkzeuge Read/Write/Glob/Grep (kein Bash), Allow-List-Rolle (Datenformat-Spec, XSD+ADRs 0003/0011/0016/0031, whfb6-definitive-Fixtures, docs/testing als Vorlage), ausdruecklicher Ausschluss von src/evaluator/*.js, vollstaendiger Liefergegenstand (.ros/README/scenario.json) inkl. Manifest-Vertrag und Herleitung der actual/bound aus der Katalog-XML.
- Nachtrag: Der Agent wurde inzwischen real ausgeuebt — er hat im Review-Gate die fuenf Armee-Szenarien blind (nur aus Katalogdaten) autoriert; deren Manifeste reconcilen gruen gegen die Engine (41/41). Damit ist AC 3 nicht nur beschrieben, sondern am tatsaechlichen Agentenlauf belegt.
