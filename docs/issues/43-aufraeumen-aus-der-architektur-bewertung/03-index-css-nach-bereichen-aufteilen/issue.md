Status: resolved
Type: refactor
Blocked by: [01]

## Description

**Geruch:** Eine Datei an ihrer praktischen Wartungsgrenze. Das globale
Stylesheet `src/index.css` umfasst **3.974 Zeilen mit 458 Top-Level-Selektoren**
— rund ein Achtel der gesamten Codebasis in einer einzigen Datei.

**Wichtig: Dies ist kein Verstoß gegen ADR 0004.** Die dort festgelegten
Konventionen werden vorbildlich eingehalten und sind ausdrücklich beizubehalten:

- Das Inline-Style-Verbot ist real durchgesetzt — die gesamte Codebasis enthält
  **genau ein** `style={{…}}`.
- Farben, Abstände und Typografie laufen konsequent über die semantischen
  CSS-Variablen und Textklassen des Design-Systems.

Der Befund betrifft allein die **Auffindbarkeit**: Bei 458 Selektoren in einer
Datei ist nicht mehr erkennbar, welche Regeln zusammengehören, ob eine Klasse
noch verwendet wird, und wo eine neue Regel hingehört. Das begünstigt genau die
Duplikate, die ADR 0004 verhindern will.

**Empfohlene Behebung:** Aufteilung nach Bereichen in mehrere Dateien, die von
`src/index.css` per `@import` in definierter Reihenfolge eingebunden werden —
die Kaskade und damit das gerenderte Ergebnis bleiben identisch. Naheliegender
Schnitt: Design-Tokens und Variablen, Basis-/Reset, Typografie, gemeinsame
Bausteine (Buttons, Panels, Badges, Toasts, Dialoge), Editor-Ansicht,
Spielmodus, Importer/Heerlager, Mobile- und Safe-Area-Anpassungen.

Beim Aufteilen fallen Selektoren auf, die auf keine Klasse mehr im JSX
verweisen. Sie sind zu entfernen, nicht mitzuschleppen.

**Abgrenzung:** Rein organisatorisch. ADR 0004 bleibt inhaltlich unverändert
gültig; er ist lediglich um die neue Dateistruktur zu ergänzen, damit die
Dokumentation nicht hinter dem Code zurückbleibt.

## Acceptance Criteria
- [ ] `src/index.css` bindet nur noch Bereichs-Dateien in definierter
      Reihenfolge ein und enthält selbst keine Regeln mehr (Tokens ausgenommen,
      sofern sie zuerst geladen werden müssen).
- [ ] Keine Bereichs-Datei überschreitet einen im Issue festgelegten
      Richtwert an Zeilen.
- [ ] Selektoren ohne Verwendung im JSX sind entfernt.
- [ ] ADR 0004 ist um die Dateistruktur und die Regel „neue Regeln gehören in
      die zuständige Bereichs-Datei" ergänzt.
- [ ] Screenshots von Heerlager, Editor und Spielmodus (Desktop und mobil)
      belegen ein unverändertes Rendering.

## Comments
- src/index.css (3.958 Zeilen) in 33 Bereichs-Dateien unter src/styles/ aufgeteilt; index.css enthaelt nur noch @import-Anweisungen in fester Kaskadenreihenfolge. Regeln wurden blockweise verschoben, nicht umsortiert — ein Vergleich der abgeflachten Regelliste belegt 522 von 574 Regelbloecken in unveraenderter Reihenfolge, Spezifitaet und Media-Kontext; 52 ungenutzte Regelbloecke entfernt. ADR 0004 um Paragraph 6 (Dateistruktur, Kaskadenreihenfolge, Richtwert 250 Zeilen) ergaenzt.
