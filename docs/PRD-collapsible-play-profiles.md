# PRD: Zusammenklappbare Profile in der Spielansicht

## Problem Statement

Die Spielansicht (`PlayMode`) zeigt pro Einheitenkarte (`PlayUnitDetails`) alle Profiltabellen (Modell-Stat-Blöcke, Item-Profile) sowie Upgrade/Rule-Badges stets vollständig sichtbar an. Das führt bei vielen Einheiten zu viel vertikalem Overhead – der Spieler muss scrollen, um einen Überblick über seine Armee zu bekommen. Anders als im Editor (`UnitSelectionCard`) gibt es keine Möglichkeit, die Detailansicht temporär zu reduzieren.

## Solution

Die Profiltabellen in `PlayUnitDetails` werden in einen zusammenklappbaren Bereich verlegt. Ein Toggle-Button (gleiches `ReceiptText`-Icon wie im Editor) klappt die Profile ein und aus.

Im Unterschied zum Editor bleiben die Upgrade-Badges (`UnitUpgradesChips`) und Regel-Badges (`UnitRulesChips`) **immer sichtbar** – sie sind nicht Teil des collapsible-Bereichs. Nur die Stat-Profil-Tabellen werden versteckt.

## User Stories / Requirements

1. **Als Spieler** möchte ich **die Profiltabellen einer Einheit einklappen können**, um den vertikalen Platz auf dem Spielfeld-Bildschirm zu reduzieren und schneller zwischen Einheiten zu navigieren.
2. **Als Spieler** möchte ich **die Upgrade- und Regel-Badges auch bei eingeklappten Profilen sehen**, damit ich sofort erkenne, welche Ausrüstung und Sonderregeln eine Einheit hat, ohne sie aufklappen zu müssen.
3. **Als Spieler** möchte ich **denselben Toggle-Button wie im Editor** vorfinden (`ReceiptText`-Icon), damit die Bedienung konsistent ist.
4. **Als Spieler** sollen die **Profile standardmäßig eingeklappt** sein, damit der Startbildschirm aufgeräumt ist.
5. **Als Spieler** soll **jede Sub-Unit** (z. B. Reittiere) **einen eigenen Toggle** haben, konsistent zur Eltern-Einheit.

## Technische Entscheidungen

- **Betroffene Module:**
  - `src/components/play/PlayUnitDetails.jsx` – neuer `isDetailsOpen`-State, Toggle-Button und bedingte Anzeige der Profiltabellen
  - `src/index.css` – neue Klasse `.play-unit-profiles.collapsed` (oder äquivalent) für den collapsible Bereich
  - Ggf. `src/components/PlayMode.jsx` – keine Änderung nötig (Props werden einfach durchgereicht)

- **Technische Klarstellungen:**
  - Toggle-Position: rechts neben dem Wundzähler (`play-unit-header-controls`), direkt nach dem Plus-Button
  - Toggle-Icon: `ReceiptText` aus `lucide-react` (muss zu den Imports hinzugefügt werden)
  - `isDetailsOpen`-State pro `PlayUnitDetails`-Instanz (default `false`)
  - Keine Animation/Transition – sofortiges Umschalten per `display: none/block` via CSS-Klasse
  - Der collapsible Bereich umfasst **nur** die Profiltabellen (`modelGroup`- und `itemGroups`-Rendering), nicht die Upgrade/Rule-Chips und nicht die Sub-Units
  - Sub-Units sind rekursive `PlayUnitDetails`-Instanzen und erhalten dadurch automatisch einen eigenen State und Toggle

- **CSS:**
  - Neue Klasse `.play-unit-profiles` mit `display: block` (default) / `.play-unit-profiles.is-collapsed` mit `display: none`
  - Oder alternativ denselben `.is-open`-Ansatz wie der Editor: Container standardmäßig `display: none`, bei `.is-open` auf `display: block`

## Testentscheidungen

- **Zu testende Module:**
  - `PlayUnitDetails` – neuer Unit-Test

- **Testschnittstellen:**
  - `PlayUnitDetails`-Komponente; Tests prüfen:
    - Profile sind standardmäßig **nicht sichtbar** (collapsed)
    - Nach Klick auf den Toggle-Button sind die Profile **sichtbar** (expanded)
    - Badges (`UnitUpgradesChips`, `UnitRulesChips`) sind **immer sichtbar** (unabhängig vom Collapse-State)
    - Toggle-Button zeigt korrekten `aria-expanded`-State

## Out of Scope

- **Editor-Verhalten ändern**: Die bestehende Collapse-Logik in `UnitSelectionCard` (wo Badges mit collapsed werden) bleibt unverändert.
- **PlayMode-Layout jenseits des Collapse**: Keine weiteren Änderungen an der Spielansicht (z. B. Such-/Filter-Features).
- **Animationen**: Keine Slide/Fade-Transition.
- **Speichern des Collapse-Zustands**: Der State lebt nur in der Komponente, wird nicht persistiert.
