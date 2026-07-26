---
name: evaluator-constraint-explorer
description: Findet heraus, ob es Constraint-Kombinationen in den Katalogen gibt, die vom Evaluator noch nicht behandelt werden. Nutze diesen Skill, wenn der User verlangt, nach fehlenden oder unbehandelten Constraint-Kombinationen in der neuen Engine zu suchen, oder wenn er den Evaluator gegen reale Katalogdaten (ergofang/definitive edition) auf Lücken testen möchte.
user-invocable: true
---

# Evaluator Constraint Explorer

Dieser Skill durchsucht den Code der neuen Engine (`evaluator`) und die Katalogdateien (ergofang und definitive edition), um Constraint-Kombinationen zu finden, die noch nicht unterstützt oder fehlerhaft behandelt werden.

## Anweisungen

1. **Worktree Isolation**: Erstelle oder betrete einen dedizierten git worktree für diese Aufgabe, bevor du mit der Analyse oder den Code-Änderungen beginnst.
2. **Gründliche Code-Analyse**: Analysiere den Source Code des Evaluators (`src/evaluator/`). Finde heraus, wie Constraints derzeit verarbeitet werden.
   - Bilde eine fundierte These über eine mögliche Lücke (eine bestimmte Constraint-Kombination, die vermutlich noch nicht unterstützt wird).
   - **Zentrales Gebot:** Diese These **muss** auf einer echten, gründlichen Analyse des Evaluator-Codes beruhen! Stelle keine Vermutungen oder Schätzungen anhand anderer Quellen an.
3. **Katalog-Check**: Suche in den vorhandenen Katalogdateien (`ergofang`, `definitive edition`), nach konkreten, realen Vorkommen der vermuteten Constraint-Kombination.
4. **Test-Erstellung (Delegation)**:
   - Nutze den Subagenten `e2e-testcase-author` (den "tester-agent"), um einen Test basierend auf deiner These und den echten Katalogdaten zu bauen.
   - **Zielsetzung des Tests:** Der Test muss so entworfen werden, dass er **FAILED**, wenn deine These korrekt ist (die Engine den Fall also wirklich nicht behandeln kann).
5. **Testausführung**:
   - Führe *nur* die E2E-Tests für die neue Engine aus, die auf `.ros` Dateien basieren.
6. **Auswertung**:
   - **Wenn der Test fehlschlägt (FAILED):** Deine Annahme war richtig. Der Evaluator hat hier eine Lücke. **Stoppe** und melde deinen Erfolg an den Nutzer.
   - **Wenn der Test erfolgreich ist (PASSED):** Deine Annahme war falsch (der Evaluator kann das doch schon). **Räume den Test wieder ab** (lösche alle Dateien, die der tester-agent dafür angelegt hat) und fange wieder bei Schritt 2 an, um weiterzusuchen.
