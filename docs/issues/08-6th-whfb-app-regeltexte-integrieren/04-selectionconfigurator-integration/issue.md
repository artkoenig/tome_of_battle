Status: resolved
Blocked by: [01, 02]

## Description

Integriere den RulesIndexDialog in den SelectionConfigurator: Klick auf einen Upgrade-Namen (z. B. Waffenoption) in der Konfigurationsliste öffnet bei bekanntem Mapping den RulesIndexDialog.

Änderungen:
- **`src/components/editor/SelectionConfigurator.jsx`**: Neuer Callback-Prop `onShowRule(ruleName)`. Jeder Upgrade-Eintrag (Option mit Beschreibung) prüft beim Klick auf den Namen via `getRuleUrl`, ob ein Mapping existiert. Bei Treffer → `onShowRule(ruleName)`. Bei `null` → kein Effekt (oder Beschreibung Expand, wie bisher).
- Parent-Komponente (vermutlich `SelectionPanel.jsx` oder `RosterEditor.jsx`): Gleicher lokaler State-Mechanismus wie bei Issue 03, ggf. denselben `RulesIndexDialog` teilen.

## Acceptance Criteria
- [x] Klick auf einen bekannten Upgrade-Namen im Configurator öffnet den RulesIndexDialog
- [x] Klick auf unbekannten Namen hat keine unerwünschten Nebeneffekte
- [x] Der Dialog-State wird mit dem aus Issue 03 geteilt (es gibt nur einen RulesIndexDialog)
- [x] Auch **gruppierte** Optionen (Magic Items/Waffen in Gruppen) öffnen den Dialog

## Comments
- Implementiert: onShowRule-Callback in SelectionConfigurator. Option-Namen prüfen via getRuleUrl, bei Treffer wird onShowRule aufgerufen. Gleicher Dialog-State aus Issue 03 wird geteilt. Testsuite grün.
- Nachgezogen: Ursprünglich griff die Verlinkung nur bei Standalone-Optionen. Gruppierte Optionen (`OptionGroup.jsx`) erhielten die Verlinkung nicht — behoben durch die gemeinsame `RuleChipIcon`-Komponente, die jetzt in Standalone- und gruppierten Optionen genutzt wird. Regressionstests in `OptionGroup.test.jsx`.
