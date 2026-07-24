Status: resolved
Type: refactor
Blocked by: [04]

## Description
Letzter Slice: die kategorie­bezogene Anzeige zieht ihr effektives Maximum aus
dem Solver, und der system­spezifische Vererbungs-Quirk (eine Kategorie erbt die
Obergrenze einer anderen — heute Heroes ← Characters) wird ausschließlich über
das deklarative Quirk-Muster (ADR 0003) beantwortet, nicht in der Oberfläche
nachgebaut. Behebt die heutige Uneinigkeit zwischen Sidebar und Sektions-Kopf.

Beobachtbares Verhalten: Das effektive Kategorie-Max ist überall in der
Oberfläche gleich, und der Vererbungs-Quirk gilt nur für das System, für das er
deklariert ist.

## Acceptance Criteria
- [ ] Das effektive Maximum einer Kategorie wird in Sidebar und Sektions-Kopf identisch angezeigt.
- [ ] Der Kategorie-Vererbungs-Quirk (Heroes erbt den Characters-Cap) greift nur für das System, für das er deklariert ist, und nicht pauschal für andere Systeme.
- [ ] Beide Oberflächen leiten das Kategorie-Maximum aus dem Solver ab und berechnen es nicht selbst.

## Comments
- Neuer Solver-Baustein categoryLimits.js (getCategoryDisplayLimits) als einzige Quelle des wirksamen Kategorie-Min/Max; RosterSidebar und RosterCategorySection leiten beide daraus ab. Der hartkodierte Heroes<-Characters-Fallback in RosterSidebar ist entfernt und durch den systemgebundenen Quirk (getInheritedCategoryMaxSource) ersetzt; rosterValidator teilt sich dieselbe Quirk-Anwendung (getInheritedCategoryMaxConstraint).
