Status: resolved
Type: feature
Blocked by: None

## Description
Setzt die im Main-Issue-PRD beschriebene Scope-Erweiterung „Mehrquellenbetrieb" um
(siehe [17/issue.md](../issue.md), Abschnitt „Mehrquellenbetrieb (Scope-Erweiterung,
ADR-0018)" sowie [ADR-0018](../../../adr/0018-katalog-mehrquellenbetrieb-ergofarg-und-lexicanum-parallel.md)).
Bewusst **ein** Child-Issue statt mehrerer vertikaler Slices — die Änderung ist ein
zusammenhängendes, nicht sinnvoll weiter zerlegbares Verhalten (beide Quellen erscheinen
gemeinsam oder gar nicht).

### Umzusetzendes Verhalten
1. **Quellen-Konfiguration:** `src/db/catalogUpdate.js` erhält eine Liste `CATALOG_SOURCES`
   (`{ gameSystemId, label, indexUrl, rawBaseUrl }`) mit den zwei Einträgen Ergofarg
   (`gameSystemId=6d8e-38d9-3c69-febf`, `artkoenig/Warhammer-Fantasy-6th-edition`) und
   Lexicanum (`gameSystemId=0d13-7737-ea86-4662`, `artkoenig/Warhammer-Fantasy-Battles-6th-Definitive-edition`).
   Die bisherigen Einzelkonstanten `CATALOG_REPO_RAW_BASE_URL`/`CATALOG_INDEX_URL` entfallen zugunsten
   dieser Liste (Konsumenten entsprechend umgestellt).
2. **Cache-Fix (Voraussetzung):** `loadCatalogIndex`s `WeakMap`-Cache schlüsselt aktuell nur nach der
   `fetchText`-Funktionsidentität. Bei zwei Quellen mit derselben `fetchText`-Instanz liefert ein
   zweiter Aufruf sonst still das gecachte Ergebnis des ersten Aufrufs zurück, statt die zweite URL
   zu laden. Muss zusätzlich nach der Index-URL schlüsseln.
3. **Import-Dropdown:** Die Spielsystem-Auswahl im Importer zeigt beide Systeme in einer flachen
   Liste (kein zusätzlicher Auswahlschritt). `transformIndexToSystems` wird pro Quelle aufgerufen,
   die Ergebnisse werden zusammengeführt.
4. **Eindeutiges Anzeige-Label:** Da die Original-Systemnamen einander sehr ähnlich und leicht zu
   verwechseln sind ("Warhammer Fantasy Battle 6th edition" vs. "Warhammer Fantasy Battles (6th
   definitive edition)"), zeigt die UI statt der Rohnamen ein kurzes, quellen-eindeutiges Label:
   „WHFB 6th ed. (Ergofarg)" / „WHFB 6th ed. (Lexicanum)". Gilt sowohl im Import-Dropdown als auch
   in der Liste bereits importierter Systeme (dort stehen bislang nur die ebenso ähnlichen
   gespeicherten `system.name`-Werte).
5. **Symmetrische stille Updates:** `findOutdatedCatalogFiles`/`runSystemMigrations` iterieren über
   `CATALOG_SOURCES` und prüfen jedes gespeicherte System gegen den Index seiner eigenen Quelle
   (Zuordnung über die bereits eindeutige `gameSystemId` des Systems — kein neues Feld, keine
   Migration). Ein gespeichertes Ergofarg-System bekommt damit wieder automatische Updates statt
   passiv auszulaufen (ADR-0017s bisherige Konsequenz wird hier durch ADR-0018 aufgehoben).
6. **Import-Zeit-Verhalten pro Quelle unverändert:** Der bestehende Abhängigkeitsschutz für
   `catalogueLink`s (Child-Issue 03) und alle sonstigen Import-Mechaniken laufen pro Quelle
   unverändert weiter — nur die Auswahl-Ebene davor ändert sich.

### Nicht Teil dieses Issues
- Editor-seitige Auswertungslücken aus Child-Issues 07/08 (unabhängiges Thema).
- Kein neues Datenbankfeld/keine Migration gespeicherter Systeme (siehe ADR-0018 — bewusst nicht
  nötig, da `gameSystemId` bereits der Quellenschlüssel ist).
- Keine UI zum Hinzufügen benutzerdefinierter/dritter Quellen — nur die zwei fest konfigurierten
  Einträge.

### Hinweis für die Umsetzung
Der `issue-implementer` reproduziert zuerst E2E (Importer öffnen, Dropdown-Inhalt vor/nach der
Änderung vergleichen; einen zweiten Fetch-Aufruf mit anderer URL gegen denselben `fetchText`-Stub
provozieren, um den Cache-Bug zu bestätigen), bevor er implementiert — Bugfix-Regel dieses Projekts.

## Acceptance Criteria
- [ ] Das Import-Dropdown listet beide Spielsysteme (Ergofarg und Lexicanum) gleichzeitig, mit den
  Labels „WHFB 6th ed. (Ergofarg)" / „WHFB 6th ed. (Lexicanum)".
- [ ] Beide Quellen sind unabhängig importierbar (eigener Katalogsatz, eigener
  Abhängigkeitsschutz für `catalogueLink`s).
- [ ] Die Liste bereits importierter Systeme zeigt dieselben eindeutigen Labels statt der
  mehrdeutigen Rohnamen.
- [ ] Ein gespeichertes Ergofarg-System (`gameSystemId=6d8e-38d9-3c69-febf`) erhält bei einer
  höheren Revision im Ergofarg-Index automatisch ein stilles Update — symmetrisch zum bisherigen
  Lexicanum-Verhalten.
- [ ] Der `loadCatalogIndex`-Cache liefert bei zwei unterschiedlichen Index-URLs zwei
  unterschiedliche Ergebnisse (Regressionstest für den Cache-Bug).
- [ ] Bestehende Tests (`catalogUpdate.test.js`, `migrations.test.js`, `Importer.test.jsx`,
  `systemQuirks.test.js`) bleiben grün; neue Tests für die o.g. Seams ergänzt.

## Comments
- Mehrquellenbetrieb umgesetzt: CATALOG_SOURCES (Ergofarg+Lexicanum) ersetzt die Einzelkonstanten in catalogUpdate.js; loadCatalogIndex-Cache schluesselt jetzt nach fetchText UND Index-URL (Bug-Regressionstest ergaenzt); Importer merged beide Quellen flach ins Dropdown mit eindeutigen Labels (WHFB 6th ed. (Ergofarg)/(Lexicanum)), auch in der Liste importierter Systeme; runSystemMigrations aktualisiert jedes System gegen den Index seiner eigenen Quelle (gameSystemId-Lookup) -> Ergofarg erhaelt wieder symmetrische stille Updates. Suite gruen (486 passed, 2 skipped).
