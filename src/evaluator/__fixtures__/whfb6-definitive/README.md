# E2E-Fixture: WHFB6 „Definitive Edition" (echte Katalogdaten)

Echte, vollständige BattleScribe-Katalogdaten der **Definitive Edition** für die
End-to-End-Tests der Reinraum-Engine (`src/evaluator/`). Anders als die
synthetischen Mini-Kataloge werten diese Dateien die Engine an genau den Daten
aus, die ein Nutzer beim Import erlebt — inklusive katalogübergreifender
`entryLink`/`infoLink`- und **`catalogueLink`**-Auflösung.

## Herkunft

- Quelle: `artkoenig/Warhammer-Fantasy-Battles-6th-Definitive-edition`, Branch
  `main`, Commit `4a558216aabea1719d15c8f45bf52b6ee0cd5e3e`.
  Upstream: `lexicanum-imperialis/Warhammer-Fantasy-Battles-6th-Definitive-edition`
  (Karak Norn Wargaming Club) — dieselbe Quelle, die die App zur Laufzeit über
  `CATALOG_REPO_RAW_BASE_URL` (`src/db/catalogUpdate.js`) bezieht.
- Spielsystem-Id der `.gst`: `0d13-7737-ea86-4662` (Revision 1).

## Warum nur diese Teilmenge (nicht alle 18 Kataloge)

Der volle DE-Satz ist 18 `.cat` + 1 `.gst` (~14 MB). Die Abhängigkeits­struktur
ist ein **Stern**: **jeder** der 17 Armee-Kataloge deklariert genau **einen**
`catalogueLink` auf die gemeinsame **`Mercenaries`**-`.cat`; Mercenaries selbst
hängt von keinem anderen Katalog ab. Für den realen Multi-`.cat`-Fall genügt
deshalb:

- `Warhammer Fantasy Battles (6th definitive edition).gst` — das Spielsystem,
- `Mercenaries (6th definitive edition).cat` — die gemeinsame Abhängigkeit,
- `Ogre Kingdoms (6th definitive edition).cat`,
- `Orcs and goblins (6th definitive edition).cat`,
- `Vampire Counts (6th definitive edition).cat`.

Belegt an den echten Daten: die Ogre-`.cat` hat 244 eindeutige `targetId`s,
**41** davon lösen **ausschließlich** über die Mercenaries-`.cat` auf (ohne sie
41 dangling, mit ihr 0). Der `catalogueLink` ist also eine echte, zwingende
Abhängigkeit — kein toter Verweis.

## Update-Politik

Diese Fixture wird **nicht** automatisch mit dem Upstream synchronisiert. Sie
ändert sich nur, wenn eine Engine-Funktionsänderung (neue geprüfte Regel, neuer
Datenfall) das erfordert. Beim Aktualisieren die Herkunfts-Commit-Id oben
mitziehen.
