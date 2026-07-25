Status: resolved
Type: chore
Blocked by: [04]

## Description

Weil Zählen von effektiven Werten abhängt und Modifikatoren von Zählungen, wird
**iterativ bis zur Konvergenz** ausgewertet. Jede Runde baut effektive Werte neu
von der Basis auf und baut den Index neu; ändert eine Runde keine zählrelevanten
effektiven Werte mehr, ist der Fixpunkt erreicht. Eine **harte Rundenobergrenze**
begrenzt die Schleife; wird sie erreicht, gilt der Stand der letzten Runde plus
eine **Nichtkonvergenz-Diagnose** — kein stilles Falschrechnen (Annahmen A2/A3).

## Acceptance Criteria
- [x] Ein Katalog, dessen Modifikatoren von Zählungen abhängen (und umgekehrt),
      konvergiert zu stabilen effektiven Werten, und der Bericht spiegelt den
      konvergierten Stand.
- [x] Jede Runde wendet Modifikatoren auf eine frische Basiskopie an (keine
      Kumulierung über Runden).
- [x] Ein zyklischer/oszillierender Katalog, der innerhalb der Rundenobergrenze
      nicht konvergiert, erzeugt eine Nichtkonvergenz-Diagnose im Bericht.
- [x] Bei Nichtkonvergenz liefert der Bericht dennoch die Ergebnisse der letzten
      Runde, statt zu scheitern oder zu hängen.

## Comments
- Fixpunktschleife (src/evaluator/fixpoint.js): iteriert buildIndex -> applyAllModifiers (frische Basiskopie je Runde) bis countRelevantEqual (effektive Kosten+Kategorien), harte Obergrenze MAX_FIXPOINT_ROUNDS=5, NO_CONVERGENCE-Diagnose bei Nichtkonvergenz mit Beibehaltung des letzten Rundenstands. evaluator.js baut danach den finalen Index aus dem konvergierten Stand. 4 neue Tests, volle Suite gruen.
