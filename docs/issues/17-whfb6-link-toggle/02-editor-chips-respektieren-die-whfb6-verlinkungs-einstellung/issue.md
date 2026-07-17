Status: ready-for-agent
Type: feature
Blocked by: [01]

## Description
Verdrahtet den in [01](../01-settings-infrastruktur-context-persistenz-zentraler-link-hook-einstellungen-dialog/issue.md) eingeführten zentralen Hook in alle Chip-/Options-Komponenten des Roster-Editors, die heute direkt `getRuleUrl()` aufrufen. Dabei wird die bisher in `UnitChips` duplizierte Mapping-Prüfung auf denselben zentralen Hook umgestellt, statt sie unabhängig zu erweitern (siehe [PRD](../issue.md)).

Bei deaktivierter Einstellung verhält sich jede betroffene Komponente so, als existiere kein Mapping: Katalog-Fallback (`Info`-Icon, BottomSheet/Tooltip) statt `BookOpen`-Link – reaktiv, ohne Reload nötig, sobald die Einstellung im Dialog (aus 01) umgeschaltet wird.

## Acceptance Criteria
- [ ] `RuleChipIcon` nutzt den zentralen Hook statt direkt `getRuleUrl()` aufzurufen
- [ ] `UnitChips` (`UnitRulesChips` und `UnitUpgradesChips`) nutzen denselben zentralen Hook statt der bisher duplizierten, eigenständigen `getRuleUrl()`-Prüfung
- [ ] `SelectionConfigurator` und `OptionGroup` (gruppierte Magic-Items/Waffen) nutzen den zentralen Hook
- [ ] `RosterEditor`s Auflösung der `RulesIndexDialog`-URL nutzt den zentralen Hook
- [ ] Bei deaktivierter Einstellung zeigen alle genannten Komponenten im Roster-Editor für jeden Namen den Katalog-Fallback, auch wenn ein Mapping existieren würde
- [ ] Umschalten der Einstellung wirkt sich sofort auf bereits sichtbare Chips aus, ohne dass die Seite neu geladen werden muss
- [ ] Bestehende Tests für `RuleChipIcon`, `OptionGroup` und die Link-Priorität bleiben grün bzw. werden um den deaktivierten Zustand ergänzt

## Comments
