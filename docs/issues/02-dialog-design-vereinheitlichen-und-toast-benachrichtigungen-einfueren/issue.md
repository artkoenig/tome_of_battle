Status: resolved
Blocked by: None

# PRD: Einheitliches Dialog- und Toast-System

## Problem Statement / Bug Description
Die Anwendung verwendet derzeit native Browser-Dialoge (`window.alert`, `window.confirm`), welche sich visuell und funktional nicht in das PWA-Design (Gothic-/Tabletop-Thema) einfügen. Diese Dialoge stören die Immersion und blockieren den Browser.

## Solution
1. **Toast-Benachrichtigungen**: Alle informativen, rein bestätigenden Dialoge werden durch das in der App vorhandene Gothic-Toast-System ersetzt. Toasts unterstützen nun verschiedene Typen (`success`, `error`, `info`), wobei Fehler-Toasts eine rote Border und roten Text nutzen.
2. **BottomSheet-Modale**: Alle interaktiven Bestätigungen (Ja/Nein-Auswahl, wie z.B. das Löschen von Armeelisten oder Spielsystemen) werden durch custom Dialog-Modale unter Verwendung der `BottomSheet`-Komponente im `desktopMode="modal"` ersetzt.

## User Stories / Requirements
1. Als Benutzer möchte ich beim Löschen einer Armeeliste oder eines Spielsystems eine Bestätigung im atmosphärischen App-Design erhalten, um eine konsistente UX zu erleben.
2. Als Benutzer möchte ich informative Fehler- und Erfolgsmeldungen als Toasts am unteren Bildschirmrand sehen, statt dass mein Browser durch blockierende Popups angehalten wird.
3. Als Entwickler möchte ich über einfache Methoden wie `showToast(message, type)` oder lokale BottomSheet-Modale Dialoge steuern, ohne komplexe globale Provider einführen zu müssen.

## Technical Decisions
- **Modul-Betroffenheit**: `src/App.jsx`, `src/components/Importer.jsx`, `src/index.css`.
- **Toast-Erweiterung**: Der Zustand `toast` in `App.jsx` wird von String auf `{ message, type }` geändert. Die Styling-Klassen `.gothic-toast` erhalten Subklassen für `.toast-error` (rote Border/Text) und `.toast-success` / `.toast-info` (goldene Border/Text).
- **Referenz-ADR**: [ADR 0010: Einheitliches Dialog- und Toast-System](file:///Users/artkoenig/Workspace/army_builder/docs/adr/0010-einheitliches-dialog-und-toast-system.md)

## Testing Decisions
- **Seams / Test-Schnittstellen**:
  - `src/components/Importer.test.jsx`: Anpassung der Löschtests, um das Klicken der Abbrechen- und Löschen-Buttons im BottomSheet zu simulieren anstelle des Mockings von `window.confirm`.

## Out of Scope
- Umgestaltung von Formular-Eingaben oder komplexen Eingabemodalen (diese nutzen bereits spezifische Modalkomponenten).

## Comments
- Implementiert die ConfirmationDialog-Komponente als zentriertes Modal und erweitert das Toast-System für informative Meldungen. Alle window.alert und window.confirm Aufrufe wurden entfernt.
