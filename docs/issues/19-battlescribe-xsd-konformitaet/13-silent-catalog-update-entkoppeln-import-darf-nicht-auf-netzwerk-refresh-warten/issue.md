Status: resolved
Type: fix
Blocked by: None

## Description
Silent-Catalog-Update entkoppeln: Import darf nicht auf Netzwerk-Refresh warten

### Bug

Der Flash-Fix aus Child-Issue 12 (`App.jsx#handleSystemImported`, Commit `88bc7e8`)
macht `await loadAllData()` vor `navigate('rosters')`, damit die Ladeanimation nicht
zu früh verschwindet. `loadAllData()` (`App.jsx:212-231`) macht dabei aber zwei
Dinge in einer Funktion:

1. Lokales Neuladen von Systemen/Rosters aus IndexedDB (`getAllSystems`,
   `getAllRosters`) — schnell, rein lokal, das braucht der Flash-Fix.
2. `runSystemMigrations(dbSystems, fetchCatalogText)` → `loadCatalogIndex` →
   `updateSystemFromCatalogIndex` — ein **echter Netzwerk-Request** zu
   `raw.githubusercontent.com`, der prüft, ob es neuere Katalog-Revisionen gibt,
   und ggf. Dateien nachlädt und neu parst.

Punkt 2 ist laut Docstring in `src/db/catalogUpdate.js:159` explizit als
unsichtbar/nicht-blockierend dokumentiert: *"Never throws and never surfaces
anything to the user: a failed catalog refresh is invisible by design (the
catalog is a cache)."* Seit dem Flash-Fix hängt aber das Verlassen des
Ladescreens nach jedem Import von diesem Netzwerk-Request ab — ein Nutzer mit
langsamer/instabiler Verbindung sieht die Ladeanimation entsprechend länger
(oder im Extremfall sehr lange) hängen, obwohl der Check laut Doku unsichtbar
sein soll.

Sichtbar geworden ist das durch einen zeitweise fehlschlagenden Puppeteer-E2E-Test
(`.desktop-nav-actions`-Timeout nach 15s) in der GitHub-Actions-CI, wo (anders
als in der lokalen Sandbox) echter Netzwerkzugriff auf `raw.githubusercontent.com`
möglich ist.

### Entscheidung

`loadAllData()` in zwei Phasen aufteilen:

1. **Awaited, lokal:** `getAllSystems()`/`getAllRosters()` laden und `systems`/
   `rosters`-State setzen — das ist alles, was `handleSystemImported` vor dem
   Navigieren braucht.
2. **Nicht awaited, im Hintergrund:** `runSystemMigrations(...)` weiter aufrufen,
   aber ohne die Navigation zu blockieren; sobald es durch ist, `systems` erneut
   aktualisieren (und den bestehenden Fehler-Toast bei `failures.length > 0`
   weiterhin zeigen). Das Verhalten für alle anderen Aufrufer von `loadAllData()`
   (Tab-Wechsel etc.) bleibt unverändert — die sind nicht durch einen Ladescreen
   blockiert und dürfen weiterhin auf den Netzwerk-Refresh warten, wenn das
   einfacher ist; wichtig ist nur, dass der Erstimport-Pfad nicht mehr davon
   abhängt.

Zusätzlich: den Netzwerkcall im bestehenden Puppeteer-E2E-Test
(`src/solver/ui.test.js`) per Request-Interception abfangen (z. B. Request an
`raw.githubusercontent.com` ablehnen/kurz beantworten), damit der Test nicht von
echter Netzwerkverfügbarkeit/-latenz abhängt — unabhängig vom obigen Fix guter
Stil für einen E2E-Test.

### Nicht ändern

- `src/db/catalogUpdate.js` selbst nicht anfassen — der Vertrag ("invisible by
  design") ist schon richtig, nur `App.jsx` hält sich aktuell nicht mehr daran.
- Der Flash-Fix aus Child-Issue 12 (kein erneutes Aufblitzen der Importer-Ansicht)
  darf nicht wieder auftreten — die lokale Reload-Phase bleibt awaited.

## Acceptance Criteria
- [ ] `handleSystemImported` awaited nur noch den lokalen IndexedDB-Reload
      (Systeme/Rosters), nicht mehr den Netzwerk-Katalogabgleich, bevor es
      navigiert.
- [ ] Der Netzwerk-Katalogabgleich (`runSystemMigrations`) läuft nach einem
      Import weiterhin im Hintergrund und aktualisiert `systems`, sobald er
      fertig ist; ein Fehler dabei zeigt weiterhin den bestehenden Toast.
- [ ] Der Erstimport-Flash-Fix aus Child-Issue 12 bleibt intakt (kein
      Zwischenzustand mit sichtbarer Importer-/Warnungsansicht zwischen
      Ladeoverlay und Heerlager).
- [ ] Der Puppeteer-E2E-Test in `src/solver/ui.test.js` fängt den
      Netzwerkcall zu `raw.githubusercontent.com` ab (Request-Interception),
      statt auf echte Netzwerkverfügbarkeit zu vertrauen.
- [ ] `npm test` (Vitest + Puppeteer-E2E) läuft grün.

## Comments
- Split loadAllData into loadLocalData (awaited IndexedDB reload) and refreshCatalogInBackground (non-blocking network catalog refresh). handleSystemImported now awaits only the local reload before navigate('rosters') and fires the catalog refresh in the background; the refresh still republishes systems and shows the failure toast. Added two App.test.jsx tests (navigation not gated on a pending refresh; failure toast still surfaces). E2E already intercepts raw.githubusercontent.com.
