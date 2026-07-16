Status: resolved
Blocked by: None

## Description
Der E2E-Smoke-Test bezieht seine Katalogdaten heute aus `public/catalogs/`. Damit hängt
grünes CI an Fremddaten, und der Test verliert seine Grundlage, sobald die Kataloge das
App-Repo verlassen (Issue 07). Er soll stattdessen aus einer **eingefrorenen Fixture im
App-Repo** importieren.

Der Test prüft die App, nicht die Katalogdaten. Die Fixture darf klein sein, muss aber ein
realistisches Spielsystem samt mindestens einem Katalog abdecken, damit der Import-Durchlauf
seine Aussagekraft behält.

**Die Fixture trägt bewusst die Upstream-Form inklusive Whitespace** (z. B. `" Casting Dice"`
als `costType`-Name, ein Entry-Name mit nachgestelltem Leerzeichen). Nur so durchläuft der
E2E-Test die Normalisierung aus Issue 02, statt sie mit vorbereinigten Daten zu umgehen.

Prefactoring: Diese Änderung entkoppelt das E2E-Setup von `public/catalogs/`, bevor dieses
Verzeichnis entfällt.

Kontext: [PRD](../../../PRD-katalog-updates-und-roster-kompatibilitaet.md) („Testing
Decisions", Seam 6), [ADR 0014](../../../adr/0014-kataloge-als-externes-fork-repo-mit-laufzeit-abruf.md)
(Konsequenzen/Neutral), [ADR 0006](../../../adr/0006-testing-and-automation.md).

## Acceptance Criteria
- [ ] Der E2E-Test importiert aus einer versionierten, eingefrorenen Fixture im App-Repo
- [ ] Der Test greift nicht mehr auf `public/catalogs/` zu
- [ ] Der Test läuft ohne Netzzugriff und ist deterministisch
- [ ] Die Fixture enthält mindestens einen Namen mit führendem und einen mit nachgestelltem
      Leerzeichen (Upstream-Form, unbereinigt)
- [ ] Die Herkunft der Fixture (Quelldatei, Stand) ist nachvollziehbar dokumentiert

## Comments
- Fixture unter src/solver/__fixtures__/whfb6/ eingefroren (Warhammer Fantasy Battle 6th edition.gst + Ogre Kingdoms.cat, Stand Commit d13b7e5 vor der Whitespace-Bereinigung aus Issue 11 — trägt bewusst führende/nachgestellte Leerzeichen, siehe Fixture-README). ui.test.js packt jetzt diese Fixture statt public/catalogs/whfb6; Katalogauswahl im Test von Bretonnia auf Ogre Kingdoms umgestellt. ADR-0006 entsprechend aktualisiert. E2E-Lauf (node src/solver/ui.test.js) und volle Vitest-Suite (32 Dateien, 361 Tests) grün.
