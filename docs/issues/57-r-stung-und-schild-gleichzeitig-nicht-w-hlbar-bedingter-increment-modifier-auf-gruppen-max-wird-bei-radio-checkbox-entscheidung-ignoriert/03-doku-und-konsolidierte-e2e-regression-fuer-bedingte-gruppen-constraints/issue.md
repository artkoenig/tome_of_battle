Status: resolved
Type: fix
Blocked by: [02]

## Description
Abschluss-Slice. Sichert das in Issue 02 hergestellte Verhalten dauerhaft ab und
dokumentiert das Datenmuster.

1. **Doku:** `docs/battlescribe-data-format.md` um das Muster „bedingter Modifier
   auf ein Gruppen-Max/Min, gekoppelt an eine andere Auswahl oder einen Scope"
   ergänzen — inkl. der abgeleiteten UI-Regel „Max-hebbar ⇒ Mehrfachauswahl mit
   Zähler" und der Abgrenzung zum bereits dokumentierten `increment`+`<repeat>`
   -Muster. Falls durch die Umstellung ADR-relevante Entscheidungen berührt sind,
   die betroffenen ADRs konsistent halten.
2. **Konsolidierte E2E-Regression:** Ein zusammenhängender Test entlang des echten
   Nutzerpfads, der alle Verhaltensklassen an minimalen Fixture-Daten (bzw. der
   vorhandenen Fixture) abdeckt, sodass eine Rückkehr des Bugs sicher auffällt.

Die feingranularen Unit-/Verhaltenstests der Klassen entstehen in Issue 02;
dieses Issue bündelt sie zu einer klaren Regressionsaussage und schließt die
Doku-Lücke.

## Acceptance Criteria
- [ ] `docs/battlescribe-data-format.md` beschreibt das neue Muster (bedingter
      Modifier auf Gruppen-Max/Min) und die Regel „Max-hebbar ⇒ Mehrfachauswahl",
      klar abgegrenzt vom `increment`+`<repeat>`-Muster.
- [ ] Ein E2E-Regressionstest deckt entlang des realen Nutzerpfads ab:
      Rüstung+Schild wählbar (heben), zweite Auswahl verhindert (senken auf 1),
      Gruppe deaktiviert (senken auf 0), fix-`max=1` bleibt Radio,
      `increment`+`<repeat>` bleibt Mehrfach.
- [ ] Etwaige durch die Umstellung berührte ADRs sind konsistent gehalten.
- [ ] `npm test`, Lint und Typecheck grün.

## Comments
- Doku: neues Muster in docs/battlescribe-data-format.md §9.8 (bedingter Modifier auf Gruppen-Max/Min + Regel 'Max-hebbar => Mehrfachauswahl'), klar abgegrenzt vom increment+repeat-Muster (§9.7). ADR 0003 konsistent gehalten (max=1-Radio-Regel um die Max-hebbar-Ausnahme erweitert). Konsolidierte Regression: src/components/editor/OptionGroup.groupConstraints.regression.test.jsx rendert die reale OptionGroup gegen die UNGEMOCKTE Solver-Fassade und deckt alle 5 Klassen ab (heben/senken/deaktivieren/fix-max=1-Radio/increment+repeat-Stepper). Kein Puppeteer, da die eingefrorene Fixture den senkenden und den Deaktivierungs-Fall nicht trägt und laut ADR 0006/README nicht verunreinigt werden darf.
