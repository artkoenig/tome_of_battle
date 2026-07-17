Status: ready-for-agent
Type: feature
Blocked by: [01]

## Description
Verdrahtet den in [01](../01-settings-infrastruktur-context-persistenz-zentraler-link-hook-einstellungen-dialog/issue.md) eingeführten zentralen Hook in den Spielmodus, unabhängig und parallel zu [02](../02-editor-chips-respektieren-die-whfb6-verlinkungs-einstellung/issue.md) (kein gemeinsamer Datei-Overlap). Betroffen sind `PlayMode`s Auflösung der `RulesIndexDialog`-URL und die drei Chip-Gruppen, die `PlayUnitDetails` rendert.

Bei deaktivierter Einstellung verhält sich der Spielmodus identisch zum Roster-Editor: Katalog-Fallback statt Link, reaktiv ohne Reload. Der „Regelbuch"-Button (öffnet das gesamte Regelbuch in neuem Tab) ist laut [PRD](../issue.md) explizit **out of scope** und bleibt unverändert.

## Acceptance Criteria
- [ ] `PlayMode`s Auflösung der `RulesIndexDialog`-URL nutzt den zentralen Hook aus 01
- [ ] Die drei Chip-Gruppen in `PlayUnitDetails` nutzen den zentralen Hook (über den `onShowRule`-Mechanismus)
- [ ] Bei deaktivierter Einstellung zeigen alle Chips im Spielmodus für jeden Namen den Katalog-Fallback, auch wenn ein Mapping existieren würde
- [ ] Umschalten der Einstellung wirkt sich sofort auf bereits sichtbare Chips im Spielmodus aus, ohne Reload
- [ ] Der „Regelbuch"-Button in `PlayMode` bleibt unverändert sichtbar und funktionsfähig, unabhängig vom Zustand der Einstellung
- [ ] Bestehende Tests für `PlayUnitDetails`/`PlayMode` bleiben grün bzw. werden um den deaktivierten Zustand ergänzt

## Comments
