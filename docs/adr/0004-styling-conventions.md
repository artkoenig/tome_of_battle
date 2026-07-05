# 0004: Styling Conventions

- **Status:** Accepted
- **Datum:** 2026-07-05
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** Keine

## Kontext und Problemstellung

Die Anwendung soll ein konsistentes und atmosphärisch passendes Gothic-/Tabletop-Thema besitzen. Eine unkontrollierte Verwendung von individuellen Stilen in React-Komponenten führt zu inkonsistentem Design (z. B. unterschiedliche Button-Größen, unpassende Farben, willkürliche Abstände) und erschwert die Wartbarkeit. Zudem muss das Interface sowohl auf großen Desktop-Monitoren als auch auf mobilen Smartphones optimal bedienbar sein.

## Entscheidungsfaktoren (Drivers)

- **Design-Konsistenz:** Einheitlicher Look & Feel über alle Ansichten hinweg.
- **Responsivität:** Automatische Anpassung an verschiedene Bildschirmgrößen.
- **Wartbarkeit:** Änderungen an Farben, Schriftarten oder Abständen sollten zentral durchgeführt werden können.
- **Barrierefreiheit / Usability:** Gute Lesbarkeit und intuitive Bedienung auf mobilen Endgeräten.

## Entscheidungsergebnis

Das Styling der Anwendung unterliegt folgenden verbindlichen Richtlinien:

### 1. Striktes Inline-Style-Verbot
In React-JSX-Komponenten dürfen **keine ad-hoc CSS-Eigenschaften** über das `style`-Attribut zugewiesen werden (z. B. `style={{ fontSize: '14px', color: '#ff0000' }}`).
- **Ausnahme:** Dynamisch berechnete Werte, die sich zur Laufzeit kontinuierlich ändern (z. B. Positionen bei Drag-and-Drop oder Prozentbalken). Alles andere gehört in CSS-Klassen.

### 2. Nutzung bestehender CSS-Klassen und Variablen
Layouts, Abstände, Rahmen und Farben werden ausschließlich über die in `src/index.css` definierten globalen Klassen und CSS-Variablen gelöst (Design-System).
- Eigene CSS-Klassen für neue Komponenten sind erlaubt, müssen jedoch die vordefinierten CSS-Variablen für Farben (z. B. `--color-bg`, `--color-border`) und Abstände nutzen.

### 3. Semantische Typografie
Es dürfen keine willkürlichen Schriftgrößen definiert werden. Stattdessen sind ausschließlich die vordefinierten semantischen Text-Klassen bzw. CSS-Variablen zu nutzen:
- `.text-display` / `--fs-display`
- `.text-heading` / `--fs-heading`
- `.text-subheading` / `--fs-subheading`
- `.text-ui-title` / `--fs-ui-title`
- `.text-body` / `--fs-body`
- `.text-label` / `--fs-label`
- `.text-micro` / `--fs-micro`

Diese Klassen sind in `src/index.css` hinterlegt und passen sich über Media Queries automatisch an Desktop- und Mobilgeräte an.

### 4. Responsives Detail-Verhalten (Tooltip vs. BottomSheet)
Um den begrenzten Platz auf Bildschirmen optimal zu nutzen, werden Detailinformationen (wie Profilwerte oder Ausrüstungsregeln) abhängig von der Bildschirmbreite unterschiedlich dargestellt (Breakpoint ist **900px**):
- **Desktop (Breite > 900px):** Anzeige erfolgt per Hover-Tooltip (`gothic-tooltip`).
- **Mobil (Breite <= 900px):** Tooltips werden deaktiviert. Beim Klick auf das Element öffnet sich zwingend ein `BottomSheet`-Modal von unten, das die Informationen übersichtlich darstellt und sich leicht schließen lässt.

### Konsequenzen (Auswirkungen)

- **Positiv:** 
  - Extrem konsistentes und hochwertiges UI-Design.
  - Exzellente mobile Bedienbarkeit durch optimierte Gesten (BottomSheet).
  - Globale Designänderungen (z. B. Umstellung auf ein helles Thema oder ein anderes Spiel-Thema) sind durch CSS-Variablen einfach umsetzbar.
- **Negativ:** 
  - Entwickler müssen sich mit den vorhandenen CSS-Klassen vertraut machen, statt schnell eigene Inline-Styles zu schreiben.
