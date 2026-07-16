# E2E-Fixture: WHFB6 (eingefroren)

Katalogdaten für `src/solver/ui.test.js` (siehe ADR-0006, Seam 6 im
[PRD](../../../../docs/PRD-katalog-updates-und-roster-kompatibilitaet.md)). Der Test prüft die
App, nicht die Katalogdaten — die Fixture ist bewusst eingefroren und unabhängig von
`public/catalogs/`.

## Herkunft

- Quelle: `public/catalogs/whfb6/Warhammer Fantasy Battle 6th edition.gst` und
  `public/catalogs/whfb6/Ogre Kingdoms.cat`
- Stand: Commit `d13b7e5` (2026-07-02), **vor** der Whitespace-Bereinigung aus Issue 11
  (Commit `db7848d`, 2026-07-15)

## Warum die unbereinigte Fassung

Die Fixture trägt bewusst die Upstream-Form inklusive Whitespace, damit der E2E-Test die
Normalisierung aus Issue 02 durchläuft, statt sie mit vorbereinigten Daten zu umgehen:

- `Warhammer Fantasy Battle 6th edition.gst`: `costType`-Namen `" Casting Dice"` und
  `" Dispel Dice"` mit führendem Leerzeichen
- `Ogre Kingdoms.cat`: Regelnamen wie `"Sword Gnoblars "` und `"Immune to Psycology "` mit
  nachgestelltem Leerzeichen

## Warum Ogre Kingdoms

Kleinste der drei WHFB6-Kataloge, die bereits an anderer Stelle im Testkorpus verwendet werden
(`src/utils/rosterSerialization.integration.test.js`), trägt beide Whitespace-Fälle und deckt
sowohl eine primäre `Heroes`- als auch eine nicht-primäre `Characters`-Kategorie ab — beides
prüft `ui.test.js` explizit.

## Update-Politik

Diese Fixture wird **nicht** automatisch mit `public/catalogs/` oder dem künftigen
Katalog-Fork synchronisiert. Sie ändert sich nur, wenn eine App-seitige Funktionsänderung
(z. B. neue Struktur, neue getestete Regel) das erfordert.
