Status: ready-for-agent
Type: refactor
Blocked by: [07]

## Description

**Geruch:** Leaky Abstraction — und ein Kommentar, der die Unwahrheit sagt.

Die Solver-Fassade trägt in ihrem Kopfkommentar den Anspruch, die restliche
Anwendung importiere ausschließlich über sie. Tatsächlich umgehen **elf
Importstellen** in den Komponenten und Hooks die Fassade und greifen direkt auf
den Regel-Evaluator, den Optionen-Sammler, die Solver-Konstanten und die
System-Eigenheiten zu. Alle vier Module werden von der Fassade gar nicht erst
re-exportiert.

Zwei konkrete Schäden: Der Kommentar führt jeden in die Irre, der sich auf ihn
verlässt. Und die Fassade kann ihren Zweck — die Innereien des Solvers
austauschbar zu halten — nicht erfüllen, solange die Hälfte der Aufrufer daran
vorbeigreift.

**Vorgeschlagene Behebung — eine Entscheidung, kein Kompromiss:** Entweder die
vier Module über die Fassade exponieren und die Umgehung mechanisch verhindern
(Lint-Regel für eingeschränkte Importpfade), oder den Exklusivitätsanspruch
ersatzlos aus dem Kommentar streichen und die Fassade ehrlich als
Bequemlichkeitsbündel führen. Empfohlen wird das Erste — die Schichtung ist im
Rest der Codebasis intakt und verdient Durchsetzung.

Setzt Kind-Issue 07 voraus: die dort geschaffene gemeinsame Konstantenquelle
bestimmt mit, was die Fassade überhaupt exponieren muss.

## Acceptance Criteria
- [ ] Es ist entschieden und umgesetzt, ob die Fassade exklusiv ist oder nicht
- [ ] Bei Durchsetzung: alle Importe aus den Komponenten und Hooks laufen über
      die Fassade, und eine Lint-Regel verhindert das direkte Ansprechen der
      Solver-Innereien
- [ ] Bei Aufgabe: der Exklusivitätsanspruch ist aus dem Kopfkommentar entfernt
      und durch eine zutreffende Beschreibung ersetzt
- [ ] Der Kopfkommentar der Fassade beschreibt in jedem Fall den tatsächlichen
      Zustand
- [ ] `npm run lint` und `npm test` bleiben grün; kein verändertes Verhalten

## Comments
