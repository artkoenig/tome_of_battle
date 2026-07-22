Status: ready-for-agent
Type: fix
Blocked by: None

## Description
Prefactor-Slice. Stellt die Solver-Bausteine bereit, auf denen die
Auswahl-/Recruit-Umstellung (Geschwister-Issue 02) aufsetzt. Keine sichtbare
Verhaltensänderung in der App — nur neue, unit-getestete Helfer.

Zwei Fähigkeiten:
1. **Effektiver Constraint-Wert bequem verfügbar.** Der kanonische Helfer
   `getModifiedConstraintValue` (`src/solver/modifierEvaluator.js`) existiert
   bereits und wird von den Validatoren genutzt. Sicherstellen/ergänzen, dass das
   effektive Min/Max einer Gruppen- **und** einer Options-Constraint an den
   Aufrufstellen der UI-/Recruit-Schicht mit dem jeweils passenden Kontext
   berechnet werden kann — inkl. eines Wegs, den Kontext dort bereitzustellen, wo
   heute keiner vorliegt (z. B. `selectionFactory.js`).
2. **„Max-hebbar"-Erkennung.** Eine reine Funktion, die für eine Gruppe (bzw.
   deren Max-Constraint) statisch bestimmt, ob **irgendein** Modifier ihren
   Max-Wert über 1 heben kann — unabhängig davon, ob dessen Bedingung aktuell
   erfüllt ist. Grundlage für die Regel „Max-hebbar ⇒ Mehrfachauswahl", die den
   Teufelskreis auflöst (ohne Schild wäre das aktuelle effektive Max 1 → sonst
   wieder Radio → Schild nie wählbar). Muss `increment`/`set` (Zielwert > 1) auf
   die Max-Constraint erkennen und das bereits behandelte `increment`+`<repeat>`
   -Muster sauber davon abgrenzen.

Domänen-/Architektur-Vorgaben der ADRs (Solver-Fassade, Schichtung) einhalten;
Facade-Grenzen nicht umgehen.

## Acceptance Criteria
- [ ] Es existiert eine unit-getestete, reine Funktion, die für eine
      Gruppen-Max-Constraint bestimmt, ob ein Modifier ihren Wert über 1 heben
      kann (true für den Rüstung+Schild-`increment`, für ein `set 2`; false für
      eine fix-`max=1`-Gruppe ohne solchen Modifier).
- [ ] Das `increment`+`<repeat>`-Muster (mehrere gleiche Items) wird korrekt als
      eigener, bereits behandelter Fall abgegrenzt und nicht mit dem neuen
      „Max-hebbar"-Signal vermengt.
- [ ] Das effektive Min/Max einer Gruppen- und einer Options-Constraint lässt
      sich an den künftigen Aufrufstellen mit korrektem Kontext ermitteln; wo
      bisher kein Kontext vorliegt, ist ein Weg vorgesehen, ihn durchzureichen.
- [ ] Unit-Tests decken die neuen Helfer inkl. der realen Katalog-Struktur
      (Gruppe `max=1` + bedingter `increment` gekoppelt an Schwester-Auswahl) ab.
- [ ] Keine Verhaltensänderung an bestehenden Screens; `npm test`, Lint und
      Typecheck grün.

## Comments
