---
status: active
branch: claude/issues-letzter-pr-ma1b62
pr:
---

# Detailtexte kommen aus dem Bericht, nicht aus einem Namensvergleich

## Goal

Der letzte Rest der ADR-0034-Migration: `src/ui/components/editor/upgradeDetails.jsx`
nimmt das rohe Spielsystem entgegen und sucht darin nach einer Regel, deren Name dem
der Aufwertung ähnelt — kleingeschrieben, getrimmt, notfalls per Teilstring, per
letzten zehn Zeichen und per fest verdrahtetem `'waaagh'`-Sonderfall. Vier Komponenten
hängen daran. `useUnitChips.js` trägt dieselbe Suche eine Schicht höher.

Beides ersetzt `capability.infoElements`. Dass der Ersatz trägt, ist bewiesen: in
`useSelectionConfigurator.js` ist genau dieser Lookup mit Issue 0163 ersatzlos
entfallen.

Der Durchlauf entzieht sich jeder maschinellen Regel, weil der Katalog als Prop
hereinkommt und nicht als Import. Er verschwindet nur, indem die Ableitung in ein
ViewModel wandert und die Komponente eine fertige Elementliste rendert.

## Wo der erste Lauf hängenblieb

Der Rückfall „kein Regeltext am Slot, aber eine gleichnamige Regel im Katalog"
wurde nicht abgeschafft, sondern nur eine Schicht tiefer geschoben:
`src/ui/viewmodels/editor/upgradeDetailElements.js:113` ruft weiterhin
`findRuleByName(system, …)`. Damit trägt das ViewModel den Namensvergleich, den
die Komponente losgeworden ist — und `useUnitChips` teilt ihn nicht. Für eine
Aufwertung ohne eigenen Regeltext liefert `hasLore` dort `false`, der Chip
fällt auf `no-desc`, `hasInfo` wird leer und der Klick auf die Details ist tot
(`UnitChips.jsx:29`). Das ist AC4.

Der Rückfall gehört **in den Bericht**, nicht in ein ViewModel: die
Info-Projektion des Slots (`src/domain/evaluator/infoProjection.js`) füllt
`capability.infoElements` bereits mit `kind: 'rule'`. Trägt sie die
gleichnamige Regel des eigenen Katalogs dort mit ein, bekommen Detailblock und
Chips sie aus derselben Quelle, `upgradeDetailElements` braucht kein `system`
mehr, und im ganzen `src/ui/` bleibt kein Namensvergleich stehen. Die Buchquelle
dieser Regel bleibt weiterhin aussen vor — sie hängt an keinem Träger des Slots.

## Acceptance criteria

- AC1 Die Detailtexte einer Aufwertung entstehen in einem ViewModel aus `capability.infoElements`; keine Datei unter `src/ui/components/` liest `sharedRules` oder `catalogues`. | verify: ! grep -rqE 'sharedRules|\.catalogues' src/ui/components
- AC2 `renderUpgradeDetails` bekommt kein `system` mehr übergeben; die Namensähnlichkeits-Regeln sind ersatzlos entfallen. | verify: ! grep -rqi 'waaagh' src/ui
- AC3 `useUnitChips` durchsucht keine `sharedRules` mehr; sein Regeltext stammt aus dem Bericht. | verify: ! grep -rq 'sharedRules' src/ui/viewmodels
- AC3a Kein Modul unter `src/ui/` sucht eine Regel über ihren Namen: `findRuleByName` hat dort keinen Aufrufer mehr, und `upgradeDetailElementsOf` nimmt weder `system` noch `catalogueId` entgegen. | verify: ! grep -rq 'findRuleByName' src/ui
- AC4 Angezeigte Detailtexte, Regeln und Chips sind für den eingefrorenen Korpus unverändert — auch dort, wo die Aufwertung selbst keine `rules` trägt und die Regel bisher über den Namen gefunden wurde. | verify: forge-test --run src/ui
- AC5 Alle vier Wrapper sind grün, und `node e2e/ui.test.js` läuft durch.

## Out of scope

- Die doppelte Kostenart-Lesung (`domain/roster/costTypeLabels.js` neben `domain/evaluation/costDisplays.js`, beide in `useRosterSidebar.js` benutzt) — sie hat mit Issue 0158 ihren eigenen Vorgang.
- `domain/roster/rosterSerialization.js` importiert `domain/evaluation/` und erreicht den Evaluator damit mittelbar. Das ist eine Entscheidung über den Reinraum (ADR-0030/0037), kein Anzeigethema.
- Die Attrappe `src/ui/hooks/useRoster.js`, die nur noch Tests kennen.
- Ein Versionssprung: die Anzeige ändert sich nicht, es gibt keinen Freigabegrund.
