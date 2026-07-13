# 0010: Einheitliches Dialog- und Toast-System

- **Status:** Accepted
- **Datum:** 2026-07-13
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs (falls vorhanden):** [ADR 0004: Styling Conventions](0004-styling-conventions.md), [ADR 0005: React Lifecycle and Performance](0005-react-lifecycle-and-performance.md)

## Kontext und Problemstellung

Die Anwendung verwendet derzeit native Browser-Dialoge wie `window.alert` und `window.confirm`. Diese brechen die Benutzeroberfläche und passen stilistisch nicht zum atmosphärischen Gothic-/Tabletop-Design. Um ein konsistentes und immersives App-Erlebnis zu schaffen, sollen diese durch anwendungseigene UI-Elemente ersetzt werden. Informative Meldungen (ohne Entscheidung) sollen als Toasts angezeigt werden, während Bestätigungsdialoge (mit Entscheidungen) im App-Design als modale Dialoge dargestellt werden sollen.

## Entscheidungsfaktoren (Drivers)

- **Design-Konsistenz:** Einheitlicher Look & Feel passend zum Gothic-Thema.
- **Usability:** Keine störenden, blockierenden Browser-Popups.
- **Wartbarkeit und Einfachheit:** Vermeidung von übermäßig komplexem globalen State-Management.
- **Performance:** Minimierung unnötiger Re-Renders.

## Betrachtete Optionen

- **Option 1: Globale Dialog- und Toast-Provider (React Context)**
  Ein globaler React-Context verwaltet den Zustand für Toasts und Dialoge. Beliebige Komponenten können über Hooks wie `useToast()` oder `useConfirm()` Benachrichtigungen und Modals triggern.
- **Option 2: Lokaler React-State & Root-Toasts (Gewählte Option)**
  Wir nutzen das bestehende Toast-System in `App.jsx` und erweitern es um einen Typ (`error` / `success` / `info`), um Fehlermeldungen (roter Rand) visuell abzuheben. Bestätigungsmodale werden direkt über lokalen Zustand (z. B. `rosterToDelete`, `systemToDelete`) in den jeweiligen Ansichten deklariert und steuern die existierende `BottomSheet`-Komponente im `desktopMode="modal"`.

## Entscheidungsergebnis

Gewählte Option: **Option 2**, weil sie extrem einfach, robust und performant ist. 
- Da alle `alert`-Meldungen in `App.jsx` ausgelöst werden, reicht die Verwendung der in `App.jsx` vorhandenen Methode `showToast` vollkommen aus, ohne einen komplexen globalen Context einzuführen.
- Bestätigungsdialoge sind stark an den Kontext des jeweiligen Löschvorgangs gebunden. Die Deklaration eines lokalen `BottomSheet` in `App.jsx` (für Listenlöschung) und in `Importer.jsx` (für Systemlöschung) entspricht genau der bestehenden Implementierung in `UnitSelectionCard.jsx`. Dies fördert die Kohärenz des Codes, ist leicht zu testen und vermeidet "Leaky Abstractions" oder globalen Overhead.

### Konsequenzen (Auswirkungen)

- **Positiv:**
  - Perfekte optische Integration in das Gothic-Design (Goldene Ränder für Info/Success, rote Ränder für Fehler).
  - Keine störenden Browser-Alerts mehr.
  - Extrem geringe technische Komplexität.
  - Direkte Testbarkeit der Modals in Unittests, da sie Teil des regulären React-Komponentenbaums sind.
- **Negativ:**
  - Falls zukünftig tiefe Kindkomponenten Bestätigungsdialoge benötigen, müssen Callbacks oder Props nach oben gereicht werden (oder zu dem Zeitpunkt refaktoriert werden). Dies ist laut YAGNI-Prinzip derzeit jedoch nicht notwendig.

## Vor- und Nachteile der Optionen

### Option 1: Globale Dialog- und Toast-Provider (React Context)

- **Gut, weil** beliebige Komponenten tief in der Hierarchie Toasts und Dialoge ohne Prop-Drilling auslösen können.
- **Schlecht, weil** es die Komplexität durch zusätzliche Provider erhöht und potenziell unnötige Re-Renders über den gesamten Komponentenbaum auslöst, wenn sich der Toast-Zustand ändert.

### Option 2: Lokaler React-State & Root-Toasts (Gewählte Option)

- **Gut, weil** extrem leichtgewichtig, keine zusätzlichen Bibliotheken oder komplexer Context-Overhead benötigt werden. Es nutzt bestehende Muster und Komponenten (`BottomSheet`), die sich im Projekt bereits bewährt haben.
- **Gut, weil** es perfekte Kontrolle über den Render-Bereich bietet (lokal begrenzte Re-Renders).
- **Schlecht, weil** für tiefe Komponenten Props oder Callbacks nach oben gereicht werden müssen.
