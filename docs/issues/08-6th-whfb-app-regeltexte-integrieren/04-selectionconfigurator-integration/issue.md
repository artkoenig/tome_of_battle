Status: resolved
Blocked by: [01, 02]

## Description

Integriere den RulesIndexDialog in den SelectionConfigurator: Klick auf einen Upgrade-Namen (z. B. Waffenoption) in der Konfigurationsliste öffnet bei bekanntem Mapping den RulesIndexDialog.

Änderungen:
- **`src/components/editor/SelectionConfigurator.jsx`**: Neuer Callback-Prop `onShowRule(ruleName)`. Jeder Upgrade-Eintrag (Option mit Beschreibung) prüft beim Klick auf den Namen via `getRuleUrl`, ob ein Mapping existiert. Bei Treffer → `onShowRule(ruleName)`. Bei `null` → kein Effekt (oder Beschreibung Expand, wie bisher).
- Parent-Komponente (vermutlich `SelectionPanel.jsx` oder `RosterEditor.jsx`): Gleicher lokaler State-Mechanismus wie bei Issue 03, ggf. denselben `RulesIndexDialog` teilen.

## Acceptance Criteria
- [ ] Klick auf einen bekannten Upgrade-Namen im Configurator öffnet den RulesIndexDialog
- [ ] Klick auf unbekannten Namen hat keine unerwünschten Nebeneffekte
- [ ] Der Dialog-State wird mit dem aus Issue 03 geteilt (es gibt nur einen RulesIndexDialog)

## Comments
- Implementiert: onShowRule-Callback in SelectionConfigurator. Option-Namen prüfen via getRuleUrl, bei Treffer wird onShowRule aufgerufen. Gleicher Dialog-State aus Issue 03 wird geteilt. Testsuite grün.
