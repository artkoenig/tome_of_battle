# 0004: Styling Conventions

- **Status:** Accepted
- **Datum:** 2026-07-21
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
Layouts, Abstände, Rahmen und Farben werden ausschließlich über die im globalen Stylesheet definierten Klassen und CSS-Variablen gelöst (Design-System). Das globale Stylesheet ist `src/index.css` zusammen mit seinen Bereichs-Dateien unter `src/styles/` (siehe §6).
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

Diese Klassen sind in `src/styles/03-typography.css` hinterlegt (die Variablen selbst in `src/styles/01-tokens.css`) und passen sich über Media Queries automatisch an Desktop- und Mobilgeräte an.

### 4. Responsives Detail-Verhalten (Tooltip vs. BottomSheet)
Um den begrenzten Platz auf Bildschirmen optimal zu nutzen, werden Detailinformationen (wie Profilwerte oder Ausrüstungsregeln) abhängig von der Bildschirmbreite unterschiedlich dargestellt (Breakpoint ist **900px**):
- **Desktop (Breite > 900px):** Anzeige erfolgt per Hover-Tooltip (`gothic-tooltip`).
- **Mobil (Breite <= 900px):** Tooltips werden deaktiviert. Beim Klick auf das Element öffnet sich zwingend ein `BottomSheet`-Modal von unten, das die Informationen übersichtlich darstellt und sich leicht schließen lässt.

### 5. Mobile Viewport-Höhe & Safe-Area
Mobile In-App-Browser (u. a. DuckDuckGo) berechnen `100vh`/`100dvh` bei ein-/ausblendender Browser-Chrome unzuverlässig, was in Kombination mit `overflow: hidden` zu abgeschnittenem Inhalt führt (Header oben, `.mobile-bottom-nav` unten). Verbindlich für vollflächige Mobile-Layout-Container (aktuell `#root`, `.empty-state-wrapper`):
- `viewport-fit=cover` ist im Viewport-Meta-Tag (`index.html`) gesetzt, damit `env(safe-area-inset-*)` greift; `.app-header` polstert `padding-top` entsprechend mit `env(safe-area-inset-top)`.
- Die Höhenquelle folgt einer aufsteigenden Fallback-Kette in CSS-Deklarationsreihenfolge: statisches `100vh` (älteste Browser) → `100dvh` (dynamische Viewport-Einheit) → `var(--app-vh, 100dvh)`, wobei `--app-vh` von einem `visualViewport`-Listener (`src/hooks/useViewportHeight.js`) laufend mit der tatsächlich sichtbaren Höhe synchron gehalten wird. Spätere gültige Deklarationen gewinnen, sodass der JS-getriebene Wert primär ist, sobald er gesetzt ist, mit den CSS-Einheiten als Fallback davor bzw. ohne `visualViewport`-Unterstützung.

### 6. Aufbau des globalen Stylesheets
Das globale Stylesheet ist nach Bereichen auf mehrere Dateien unter `src/styles/` aufgeteilt. `src/index.css` enthält **keine eigenen Regeln mehr**, sondern ausschließlich `@import`-Anweisungen auf diese Bereichs-Dateien.

- **Die Nummer im Dateinamen ist die Kaskadenposition.** Die Dateien heißen `NN-<bereich>.css` und werden in genau dieser Reihenfolge importiert. Da CSS Konflikte zwischen Regeln gleicher Spezifität allein über die Deklarationsreihenfolge auflöst, ist die Import-Reihenfolge verhaltensrelevant: Sie darf nicht umsortiert werden, und eine neue Datei wird an der Stelle eingehängt, an der ihre Regeln kaskadieren sollen.
- **`01-tokens.css` wird zuerst geladen.** Alle übrigen Dateien setzen die dort definierten CSS-Variablen voraus.
- **Neue Regeln gehören in die fachlich zuständige Bereichs-Datei** — nicht in `src/index.css` und nicht ans Ende einer beliebigen Datei. Existiert für einen neuen Bereich noch keine Datei, wird eine angelegt und an der passenden Kaskadenposition importiert.
- **Richtwert:** keine Bereichs-Datei über **250 Zeilen**. Wird der Wert überschritten, ist der Bereich in zwei aufeinanderfolgende Dateien zu teilen — aufeinanderfolgend, damit die Kaskade unverändert bleibt.
- **Zusammenhängende Deklarationen bleiben zusammen.** Insbesondere die Fallback-Kette aus §5 (`100vh` → `100dvh` → `var(--app-vh, 100dvh)`) ist ein einziger, reihenfolgeabhängiger Block und darf nicht über Dateigrenzen hinweg zerrissen werden.
- **Selektoren ohne Verwendung im JSX werden entfernt**, sobald sie beim Arbeiten in einer Bereichs-Datei auffallen. Ausgenommen sind die in §3 festgeschriebenen semantischen Typografie-Klassen: Sie sind zugesagte Design-System-API und bleiben auch dann bestehen, wenn sie derzeit nicht verwendet werden. Vorsicht bei dynamisch zusammengesetzten Klassennamen (z. B. `` `toast-${type}` ``) — eine reine Textsuche nach der vollen Klasse findet diese nicht.

### Konsequenzen (Auswirkungen)

- **Positiv:** 
  - Extrem konsistentes und hochwertiges UI-Design.
  - Exzellente mobile Bedienbarkeit durch optimierte Gesten (BottomSheet).
  - Globale Designänderungen (z. B. Umstellung auf ein helles Thema oder ein anderes Spiel-Thema) sind durch CSS-Variablen einfach umsetzbar.
  - Durch die Aufteilung nach Bereichen (§6) ist erkennbar, welche Regeln zusammengehören und wo eine neue Regel hingehört — genau die Voraussetzung dafür, dass keine Duplikate entstehen.
- **Negativ:** 
  - Entwickler müssen sich mit den vorhandenen CSS-Klassen vertraut machen, statt schnell eigene Inline-Styles zu schreiben.
  - Die Kaskade ist über mehrere Dateien verteilt und damit weniger direkt ablesbar. Die Nummerierung im Dateinamen und die feste Import-Reihenfolge in `src/index.css` sind der Ausgleich dafür und müssen konsequent gepflegt werden.
