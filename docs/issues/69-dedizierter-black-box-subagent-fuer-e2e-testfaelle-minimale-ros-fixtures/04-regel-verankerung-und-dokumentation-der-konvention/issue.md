Status: resolved
Type: chore
Blocked by: [03]

## Description
Verankert die neue Konvention dauerhaft, sodass eine kuenftige Session sie ohne
Rueckfrage korrekt anwendet.

Es wird eine Trigger-Regel in der Projektkonfiguration hinterlegt: **bittet der
Maintainer um die Erstellung eines E2E-Testfalls, wird die Arbeit an den
Black-Box-Testfall-Autor delegiert** — nicht im Hauptgespraech erledigt. Dazu
kommt eine Begleit-Dokumentation, die Rolle, Allow-List, den Manifest-Vertrag,
den Liefergegenstand und die Grenze zum runner-/`.test.js`-Teil beschreibt, im
Stil der uebrigen Agenten-Dokumentation des Projekts. Die datengetriebene
E2E-Architektur (manifest-getriebener Runner als einzige Quelle der Wahrheit,
Black-Box-Autorenschaft) wird als Architektur-Entscheidung festgehalten und in die
bestehende Test-/Automations-Dokumentation eingebettet.

Die Verankerung wird gegen die bestehende Dokumentation auf Widerspruchsfreiheit
geprueft (Testkatalog-Pflegeregel, Test-ADR), damit keine widerspruechlichen
Aussagen entstehen.

Nicht im Scope: der Runner, der Agent und die Migration selbst (Child-Issues
01-03).

## Acceptance Criteria
- [ ] Eine Trigger-Regel in der Projektkonfiguration delegiert die Erstellung
      eines E2E-Testfalls verbindlich an den Black-Box-Autor.
- [ ] Eine Begleit-Dokumentation beschreibt Rolle, Allow-List, Manifest-Vertrag,
      Liefergegenstand und die Grenze zum Runner/`.test.js`-Teil.
- [ ] Die datengetriebene E2E-Architektur ist als Architektur-Entscheidung
      dokumentiert und in die bestehende Test-/Automations-Dokumentation
      eingebettet.
- [ ] Die neue Dokumentation ist widerspruchsfrei zur bestehenden (Testkatalog-
      Pflegeregel, Test-ADR, CLAUDE.md).

## Comments
- Konvention verankert: Delegations-Trigger in CLAUDE.md/.agents/AGENTS.md (E2E-Testfall -> e2e-testcase-author), Begleit-Doku docs/agents/e2e-testcase-author.md, ADR 0033 (manifest-getriebener Runner als SSOT, Black-Box-Autorenschaft) plus Registrierung in adr/README.md. Konsistenzpass: ADR 0006 und Testkatalog-Pflegeregel auf den neuen Fluss angeglichen (kein handgeschriebener src/evaluator/e2e.*.test.js mehr), Querverweise gesetzt. lint + typecheck gruen.
