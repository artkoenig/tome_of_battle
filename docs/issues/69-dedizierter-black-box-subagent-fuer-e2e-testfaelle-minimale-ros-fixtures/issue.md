Status: needs-triage
Type: chore
Blocked by: None

## Description
Die E2E-Absicherung des Evaluators soll auf eine **datengetriebene** Basis
gestellt und um einen **Black-Box-Autor** ergaenzt werden. Zwei zusammengehoerige
Teile mit einem gemeinsamen Vertrag (dem Manifest-Format):

### Teil A — Generalisierter, manifest-getriebener Test-Runner
Ein einziger, versionierter Runner durchlaeuft **alle** unter `docs/testing/`
definierten Szenarien, generiert daraus zur Laufzeit die Testfaelle, wertet jedes
Roster gegen die Evaluator-Fassade `evaluate` aus und prueft das Ergebnis gegen
die je Fall deklarierte Erwartung. Die generierten Testfaelle sind **fluechtig**
(nur zur Laufzeit, nicht als Quelldateien persistiert) — versioniert sind nur der
Runner und die Szenario-Daten.

Damit der Runner ueberhaupt etwas Fachliches pruefen kann, bekommt jedes Szenario
eine **maschinenlesbare Erwartung** (Quelle der Wahrheit statt Prosa): ein
Manifest je `docs/testing/<szenario>/`, das (1) die Katalog-Inputs (`.gst` + `.cat`)
und (2) je Roster die erwarteten Bericht-Assertions deklariert — welche
Constraint-Grenz-Id mit welchem `actual`/`bound` feuert und welche Grenz-Ids
abwesend sein muessen. Heute existiert diese Erwartung nur als Prosa in den
Szenario-READMEs und als hartverdrahtete Konstanten in den handgeschriebenen
`e2e.*.ros.test.js`.

Die **bestehenden handgeschriebenen E2E-Tests werden durch den Runner abgeloest**:
ihre Szenarien werden in das Manifest-Format ueberfuehrt, danach werden die
abgeloesten Testdateien entfernt. Eine Quelle der Wahrheit, kein Duplikat.

### Teil B — Dedizierter Black-Box-Subagent als Testfall-Autor
Wenn der Maintainer um die Erstellung eines E2E-Testfalls bittet, wird die Arbeit
an einen dedizierten, projektspezifischen Subagent delegiert, der **bewusst blind
fuer den App-Quellcode ist**. Der Sinn: ein E2E-Testfall muss sich aus der
Datenformat-Spezifikation und den echten Katalogdaten ableiten, nicht aus der
Implementierung des Evaluators — sonst spiegelt der Test nur die vorhandenen Bugs
der Engine wider statt das fachlich erwartete Verhalten. Dieses Muster wird heute
bereits informell praktiziert (`docs/testing/vampire-bloodlines/README.md` beginnt
woertlich mit "Black-Box-Test (kein Blick in den App-Quellcode)").

**Erlaubte Lesequellen des Agents (Allow-List) — und nur diese:**
- die Datenformat-Spezifikation (`docs/battlescribe-data-format.md`),
- die vendored XSD (`src/parser/schema/Catalogue.xsd`) und die ADRs 0003, 0011,
  0016, 0031,
- die echten Katalogdaten-Fixtures (`src/evaluator/__fixtures__/whfb6-definitive/`),
- die bestehenden Szenarien als Formatvorlage (`docs/testing/**`).

**Verboten:** jeder Blick in den App-/Evaluator-Quellcode (Rest von `src/`,
insbesondere `src/evaluator/*.js` ausser den `__fixtures__`). Weil die
Katalogdaten selbst unter `src/` liegen, wird der Ausschluss als **Allow-List**
formuliert, nicht als pauschale `src/`-Sperre.

**Durchsetzung (Maintainer-Entscheidung):** Tool-Restriktion + strikt
dokumentierte Rolle im Agent-Prompt (nur lesende/schreibende Basiswerkzeuge, kein
Bash; App-Code ausdruecklich verboten). Bewusst **kein** harter Hook-Gate.

**Liefergegenstand des Agents je Auftrag:** (1) minimale `.ros`-Fixtures unter
`docs/testing/<szenario>/rosters/`, (2) die Szenario-`README.md` (abgeleitete
Regeln + erwartetes Verhalten, Format der bestehenden Szenarien) und (3) das
**maschinenlesbare Manifest** aus Teil A, das der Runner konsumiert. Der Runner
selbst und jede `.test.js` gehoeren **nicht** zum Liefergegenstand des Agents
(sie beruehren Quellcode).

**Nicht im Scope:** Aenderungen an der Evaluator-Engine selbst; ein durchsetzender
PreToolUse-Hook; das Schreiben des Runners oder von `.test.js` durch den Agent.

## Acceptance Criteria
- [ ] Ein einziger versionierter Runner entdeckt alle `docs/testing/`-Szenarien,
      generiert die Testfaelle zur Laufzeit und persistiert keine generierten
      Testdateien.
- [ ] Jedes Szenario traegt ein maschinenlesbares Manifest mit Katalog-Inputs und
      je Roster den erwarteten Bericht-Assertions (Grenz-Id + actual/bound bzw.
      Abwesenheit); der Runner prueft genau diese.
- [ ] Die bisher handgeschriebenen `.ros`-basierten E2E-Tests sind auf das
      Manifest-Format migriert und die abgeloesten Testdateien entfernt; die Suite
      bleibt gruen.
- [ ] Bittet der Maintainer um einen E2E-Testfall, wird die Erstellung an den
      dedizierten Black-Box-Subagent delegiert, nicht im Hauptgespraech erledigt.
- [ ] Der Agent erfuellt seine Aufgabe allein aus der Allow-List (Spezifikation,
      XSD, ADRs, Katalog-Fixtures, bestehende Szenarien) ohne App-/Evaluator-Code
      und liefert je Auftrag `.ros` + Szenario-README + Manifest.
- [ ] Die Agent-Rolle verbietet den App-/Evaluator-Quellcode ausdruecklich und
      benennt die erlaubten Lesequellen als Allow-List.
- [ ] Die Konvention ist so dokumentiert (Trigger, Rolle, Allow-List, Manifest-
      Vertrag, Grenze zum Runner), dass eine kuenftige Session sie ohne Rueckfrage
      korrekt anwendet.

## Comments
