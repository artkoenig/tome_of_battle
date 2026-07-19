Status: ready-for-agent
Type: fix
Blocked by: None

## Description
`loadCatalogIndex` in `src/db/catalogUpdate.js` hält einen eigenen, vom Service
Worker unabhängigen In-Memory-Cache (`catalogIndexCache`, ein `WeakMap`
keyed by `fetchText`-Identität, dann nach `indexUrl`) über die gesamte
Seiten-Session hinweg. Besucht der Nutzer den Import-Screen mehrfach innerhalb
derselben Session (ohne vollständigen Seiten-Reload), bekommt er beim zweiten
Aufruf weiterhin den beim ersten Laden gecachten `catpkg.json`-Index — auch
wenn sich der Fork zwischenzeitlich geändert hat. Das ist derselbe
Fehlklassentyp (veraltete Revisionsanzeige) wie das Service-Worker-Problem im
Geschwister-Issue, nur auf einer anderen Ebene.

Der Cache wird vollständig entfernt: `loadCatalogIndex(fetchText, indexUrl)`
ruft `fetchText` bei jedem Aufruf frisch auf. `catalogIndexCache`,
`getCachedIndexByUrl` und der test-only Export `clearCatalogIndexCache`
entfallen ersatzlos.

Die Revisionsvergleichslogik selbst (`isOutdated`/`deriveRevisionState`) und
alle Aufrufer von `loadCatalogIndex` bleiben in ihrem Vertrag unverändert —
sie bekommen lediglich zuverlässig frische Daten.

Siehe [ADR-0020](../../../adr/0020-katalogdaten-network-only-kein-service-worker-cache.md)
und das Main-Issue [30-sw-cache-katalog-update](../issue.md) für den vollen
Kontext.

## Acceptance Criteria
- [ ] Zwei aufeinanderfolgende Aufrufe von `loadCatalogIndex(fetchText, indexUrl)`
      mit identischen Argumenten rufen den injizierten `fetchText` zweimal auf
      (nicht mehr nur einmal mit anschließendem Cache-Hit).
- [ ] `catalogIndexCache`, `getCachedIndexByUrl` und `clearCatalogIndexCache`
      existieren nicht mehr in `src/db/catalogUpdate.js`.
- [ ] `loadCatalogIndex` gibt bei einem Fetch-Fehler weiterhin `null` zurück
      und loggt eine Warnung (unverändertes Fehlerverhalten, ADR-0014).
- [ ] `src/db/catalogUpdate.test.js` ist an das neue Verhalten angepasst
      (keine `clearCatalogIndexCache`-Aufrufe mehr im Testsetup) und grün.

## Comments
