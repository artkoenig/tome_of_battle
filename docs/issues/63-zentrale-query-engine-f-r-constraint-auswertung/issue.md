Status: claimed
Type: refactor
Blocked by: None

## Description

# PRD: Zentrale Query-Engine für Constraint-Auswertung

## Problem Statement

Die Auswertung von BSData-Regeln — Grenzen (Constraints), Bedingungen
(Conditions) und Wiederholungen (Repeats), zusammen die drei Ausprägungen einer
**Query** — ist über den Solver verstreut und teils in der Oberfläche ein
zweites Mal nachgebaut. Die Auflösung des **Bezugsrahmens** einer Query („welche
Selektionen zählt dieser Scope?") existiert mehrfach und wird strukturell
verschieden beantwortet (einmal über einen vorberechneten Zähl-Index, einmal über
einen Live-Baumlauf). Folgen: eine Prozent-Grenze zählt Zähler und Nenner
uneinheitlich; das effektive Kategorie-Max erscheint an verschiedenen Stellen der
Oberfläche unterschiedlich; „im Aushebe-Dialog wählbar" und „nach dem Ausheben
legal" können für die nur in der UI nachgebauten Fälle auseinanderfallen; ein
systemspezifischer Sonderfall (Heroes erbt den Characters-Cap) ist in der
Oberfläche pauschal statt system-gebunden nachgebaut. Jede künftige Änderung an
einer Constraint-Klasse muss an mehreren Stellen nachgezogen werden und driftet
sonst.

## Desired Behavior / Outcome

Es gibt genau **eine** Stelle, die eine Query in eine Zahl übersetzt, und genau
**ein** Ergebnis, aus dem sowohl die Validierung als auch die Oberfläche lesen.
Maßgeblich ist die **BSData-Spec** (Datenformat-Doku §7.6/§7.7, vendored XSD):
wo heutige, voneinander abweichende Auswertungen der Spec widersprechen, folgt
das Verhalten der Spec — auch wenn sich dadurch einzelne heutige
Validierungsergebnisse ändern. Die Oberfläche wertet keine Constraint mehr selbst
aus, sondern rendert nur noch, was der Solver ermittelt hat; „wählbar" bedeutet
verlässlich „legal nach dem Ausheben" über **alle** Constraint-Klassen (ADR-0022
gilt unverändert und jetzt lückenlos).

## User Stories / Requirements

1. Als **Listenbauer** will ich, dass eine als „wählbar" angezeigte Einheit/Option
   nach dem Ausheben auch tatsächlich legal ist — über jede Art von Grenze —, damit
   ich keine ungültigen Listen baue, die erst nachträglich auffallen.
2. Als **Listenbauer** will ich dieselbe Obergrenze (z. B. ein Kategorie-Cap) überall
   in der Oberfläche gleich angezeigt bekommen, damit ich mich auf keine
   widersprüchlichen Zahlen verlasse.
3. Als **Listenbauer** will ich, dass eine armeeweite oder kontingentweite
   Pflichteinheit als Verstoß gemeldet wird, wenn sie in meiner Liste fehlt.
4. Als **Maintainer** will ich, dass eine Änderung an einer Constraint-Klasse an
   genau einer Stelle wirkt und automatisch bis in die Oberfläche durchschlägt,
   damit keine zweite Regel-Implementierung nachgezogen werden muss und driftet.

## Constraints & Settled Decisions

- **Architektur:** zentrale Query-Engine (ein scope-agnostisches Zähl-Primitiv,
  Scope als Parameter, reiches Ergebnisobjekt mit Ursachen, definitionsseitige
  Constraint-Aufzählung, beschränkte Stabilisierung, UI-Verhaltensmodell aus dem
  Solver). Siehe **ADR-0029**.
- **Umfang:** volle Konsolidierung von der Auswertung bis in die Oberfläche
  (Solver-Kern zuerst, UI-Ableitung danach).
- **Korrektheits-Maßstab:** Format-Korrektheit (BSData-Spec ist das Oracle), nicht
  Verhaltensparität mit dem heutigen Validator. Latente Bugs werden dabei
  mitkorrigiert.
- **Ursachen:** Validierungsmeldungen tragen ihre Ursache(n) unverändert nach
  ADR-0027; das reiche Ergebnisobjekt liefert sie von selbst.
- Relevante ADRs: [ADR-0029](../../adr/0029-zentrale-query-engine-fuer-constraint-auswertung.md),
  [ADR-0022](../../adr/0022-ui-verfuegbarkeit-leitet-sich-aus-dem-validator-ab.md),
  [ADR-0003](../../adr/0003-battlescribe-domain-rules.md),
  [ADR-0023](../../adr/0023-solver-fassade-als-exklusive-schnittstelle.md),
  [ADR-0027](../../adr/0027-validierungs-ursachen-am-fehlerobjekt.md).

## Testing Decisions

- **Zu prüfendes Verhalten:** Validierungsmeldungen entsprechen der BSData-Spec für
  eine Szenario-Menge, die die heute divergierenden Fälle einschließt (Prozent-
  Grenzen, Gruppen-/Kategorie-Limits mit bedingten Modifiern, armeeweite Pflicht,
  system-gebundener Kategorie-Vererbungs-Quirk); Übereinstimmung von „wählbar" und
  „legal nach Ausheben"; Konsistenz von radio-vs-checkbox / „Pflicht" / „wie viele
  noch" / Kategorie-Max über alle Oberflächen.
- **Test-Schnittstellen (Seams):** primär die Solver-Fassade (Validierungsergebnis
  inkl. Verstöße, Ursachen und UI-Verhaltensmodell; Aushebe-Verfügbarkeit) mit
  ganzen Rostern als Szenarien; zusätzlich das neue scope-agnostische Zähl-Primitiv
  samt seinen drei Query-Adaptern als reine Unit-Schnittstelle. UI-Komponenten nur
  daraufhin, dass sie das Verhaltensmodell konsumieren, statt Constraints selbst
  auszuwerten.

## Out of Scope

- Portierung/Migration bereits gespeicherter Roster auf ein geändertes Verhalten
  (ausdrücklich nicht gefordert).
- Inkrementelle/reaktive Neuberechnung (Delta-Zählungen) — bewusst als spätere
  Option vermerkt, nicht Teil dieses Vorhabens.
- Neue Constraint-/Query-Typen oder Format-Erweiterungen über die bestehende
  vendored XSD hinaus.
- Ein Versions-Bump (dies ist ein `refactor` ohne nutzersichtbaren Release-Grund).

## Acceptance Criteria
- [ ] Für eine Szenario-Menge von Rostern — einschließlich der heute divergierenden Fälle — entsprechen die Validierungsmeldungen der BSData-Spec (§7.6/§7.7).
- [ ] Eine Prozent-Grenze wird gegen eine Referenzmenge geprüft, die im selben Bezugsrahmen gezählt wird wie ihr Zähler.
- [ ] „Im Aushebe-Dialog wählbar" bedeutet für **alle** Constraint-Klassen „nach dem Ausheben legal".
- [ ] Radio-vs-Checkbox, „Pflicht", „wie viele noch erlaubt" und das effektive Kategorie-Max stimmen über Aushebe-Dialog, Options-Gruppe, Autofill-Vorschläge, Sidebar und Sektions-Kopf überein (nachweisbar an einem Szenario mit bedingtem Modifier auf ein Gruppen-/Kategorie-Limit).
- [ ] Eine armeeweite oder kontingentweite Pflicht-Grenze schlägt an, wenn der geforderte Eintrag in der Liste fehlt.
- [ ] Der Kategorie-Vererbungs-Quirk (Heroes erbt Characters-Cap) greift nur für das System, für das er deklariert ist, und wird überall in der Oberfläche identisch angezeigt.
- [ ] Eine Validierungsmeldung trägt weiterhin ihre Ursache(n) nach ADR-0027, auch für die nun zentral ausgewerteten Fälle.
- [ ] Keine Oberflächen-Komponente wertet eine Constraint selbst aus; sie rendert ausschließlich das vom Solver gelieferte Verhaltensmodell.

## Comments
