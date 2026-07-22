Status: resolved
Type: refactor
Blocked by: None

## Description
Die App verwendet für den Schließen-Button in Dialogen/Modals und im BottomSheet
zwei getrennte, uneinheitliche Implementierungen:

- **Icon**: Alle Schließen-Buttons zeigen das lucide-react-Icon `<X size={18}/>`,
  außer im "Neues Heer"-Modal, das stattdessen einen rohen Textbuchstaben `X`
  rendert (falsche Schriftart/-stärke, kein Icon).
- **Accessible Label**: uneinheitlich über die Komponenten hinweg — mal
  `aria-label="Schließen"`, mal nur `title="Schließen"`, mal gar kein Label.
- **Optik/CSS**: Zwei parallele, unterschiedlich gestylte CSS-Klassen
  (`.modal-close` für Dialoge, `.bottomsheet-close-btn` fürs BottomSheet) —
  Letztere hat einen runden Hover-Hintergrund, Erstere nicht.

Ziel: ein einziges, konsistentes Schließen-Button-Muster (Icon, Accessible
Label, Optik/Hover-Verhalten) für alle Dialoge und das BottomSheet.

## Acceptance Criteria
- [ ] Jeder Schließen-Button in einem Dialog/Modal oder BottomSheet zeigt das
      lucide-react `X`-Icon (kein roher Textbuchstabe mehr).
- [ ] Jeder Schließen-Button hat konsistent `aria-label="Schließen"`.
- [ ] Modal- und BottomSheet-Schließen-Buttons nutzen dieselbe CSS-Basis
      (ein gemeinsames Klassen-Muster statt zweier paralleler Definitionen)
      und verhalten sich optisch identisch (u.a. Hover-Zustand).
- [ ] Bestehende Tests, die sich auf die bisherigen Selektoren (`getByTitle`,
      `getByText('X')` o.ä.) verlassen, sind angepasst und grün.

## Comments
- Implementiert: gemeinsame CSS-Klasse .dialog-close-btn (src/styles/04-panels-and-controls.css) ersetzt .modal-close/.modal-close--flush (14-modals.css) und .bottomsheet-close-btn (23-popover-and-bottomsheet.css, 24-bottomsheet-mobile.css). Alle fuenf Schliessen-Buttons (SettingsDialog, RulesIndexDialog, ConfirmationDialog, NewRosterModal, BottomSheet) nutzen jetzt einheitlich das lucide X-Icon, aria-label="Schliessen" und title="Schliessen". NewRosterModal zeigte zuvor rohen Text "X" statt Icon. Vier-Achsen-Verifikation (testing skill) gruen: Standards (lint/typecheck PASS, 2 Befunde als out-of-scope eingestuft), Spec (alle 4 Akzeptanzkriterien erfuellt), Tests (1188/1188 vitest + Puppeteer-E2E gruen), Docs (keine Abweichung). Optionale JSX-Duplikation (gemeinsame CloseButton-Komponente) bewusst nicht umgesetzt, User-Entscheidung.
- Hinweis: Seit 58-i18n ist das aria-label der Schließen-Buttons übersetzt (t('common.close')) — 'Schließen' gilt für die deutsche UI-Sprache, englisch 'Close'. Konsolidierung selbst unverändert.
