Status: resolved
Type: chore
Blocked by: [01]

## Description

Macht das eine Query-Primitiv zur alleinigen Zählstelle für **jede**
Bezugsrahmen- und Flag-Kombination. Bezugsrahmen roster/force/parent/self plus
Eintrags- und Kategorie-ID als Ziel; Flags shared, includeChildSelections,
includeChildForces. Domänenregel: Kategorie-Ziele zählen **armeeweit über alle
Forces**, Eintrags-Ziele **pro Kontingent** (BSData §7.7). Dieser Slice liefert
die **zweite Test-Nahtstelle**: eine Matrix-Suite mit einem Fall je Zelle als
ausführbare Spezifikation.

## Acceptance Criteria
- [ ] Das Query-Primitiv liefert für jeden Bezugsrahmen (roster, force, parent,
      self, Eintrags-ID, Kategorie-ID) die korrekte Anzahl/Summe.
- [ ] Ein Kategorie-Ziel wird armeeweit über alle Forces gezählt, ein Eintrags-Ziel
      pro Kontingent.
- [ ] shared, includeChildSelections und includeChildForces verändern die gezählte
      Menge wie spezifiziert — auch in Kombination.
- [ ] Jede Zelle von shared × includeChildSelections × includeChildForces ×
      Bezugsrahmen-Art ist durch einen ausführbaren Testfall abgedeckt.
- [ ] Ein nicht auflösbarer Bezugsrahmen liefert 0 und eine Auflösungs-Diagnose
      statt einer falschen Zählung.

## Comments
- Query-Primitiv als alleinige Zaehlstelle fuer alle Bezugsrahmen (roster/force/parent/self, Eintrags- und Kategorie-ID) und alle Flags (shared, includeChildSelections, includeChildForces) implementiert. Vier-Eimer-Index (base/selection/force/both) macht includeChildSelections und includeChildForces unabhaengig kombinierbar; Ziel-Typ-Regel (Kategorie armeeweit, Eintrag pro Kontingent, BSData §7.7) und Auflösungs-Diagnose bei nicht aufloesbarem Scope. Zweite Test-Nahtstelle: query.matrix.test.js mit einem Fall je Zelle (48 Matrix-Zellen + Ziel-Typ-, Kosten- und Unresolved-Faelle).
