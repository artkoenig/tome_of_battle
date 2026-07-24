Status: ready-for-agent
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
- [ ] Ein Katalog, dessen Modifikatoren von Zählungen abhängen (und umgekehrt),
      konvergiert zu stabilen effektiven Werten, und der Bericht spiegelt den
      konvergierten Stand.
- [ ] Jede Runde wendet Modifikatoren auf eine frische Basiskopie an (keine
      Kumulierung über Runden).
- [ ] Ein zyklischer/oszillierender Katalog, der innerhalb der Rundenobergrenze
      nicht konvergiert, erzeugt eine Nichtkonvergenz-Diagnose im Bericht.
- [ ] Bei Nichtkonvergenz liefert der Bericht dennoch die Ergebnisse der letzten
      Runde, statt zu scheitern oder zu hängen.

## Comments
