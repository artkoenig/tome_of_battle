Status: ready-for-agent
Type: fix
Blocked by: None

## Description
Der Service Worker (`public/sw.js`) behandelt Requests an `raw.githubusercontent.com`
(den Katalog-Index `catpkg.json` sowie einzelne `.cat`/`.gst`-Dateien) aktuell mit
einer Cache-First-Strategie: Existiert bereits eine gecachte Antwort, wird sie
sofort zurückgegeben, während der echte Netzwerk-Request den Cache nur im
Hintergrund für den *nächsten* Aufruf aktualisiert. Das führt dazu, dass sowohl
die Revisionsanzeige im Import-Screen als auch ein manueller Reimport veraltete
Daten liefern können, obwohl der Fork bereits einen neueren Stand ausliefert.

Dieser Host wird komplett von der Cache-Regel ausgenommen — analog zum
bestehenden Ausschluss von `rules-index.json` (`sw.js:43`). Jeder Request an
`raw.githubusercontent.com` geht garantiert unverändert ans Netzwerk: kein
`caches.match()`-Lesen, kein `cache.put()`-Schreiben für diesen Host.

Bereits importierte Systeme sind davon nicht betroffen — sie liegen vollständig
in IndexedDB und benötigen für Anzeige/Nutzung kein Netzwerk.

Siehe [ADR-0020](../../../adr/0020-katalogdaten-network-only-kein-service-worker-cache.md)
und das Main-Issue [30-sw-cache-katalog-update](../issue.md) für den vollen
Kontext.

## Acceptance Criteria
- [ ] Ein Request an eine `raw.githubusercontent.com`-URL wird vom Fetch-Handler
      in `public/sw.js` nie aus `caches.match()` beantwortet, selbst wenn ein
      Cache-Eintrag für diese URL existiert.
- [ ] Ein erfolgreicher Response für eine `raw.githubusercontent.com`-URL wird
      nicht per `cache.put()` gespeichert.
- [ ] Alle anderen bisher gecachten Hosts (same-origin, Google Fonts) sowie der
      bestehende `rules-index.json`-Ausschluss verhalten sich unverändert.
- [ ] `src/solver/pwa.test.js` ist an das neue Verhalten angepasst und grün.
- [ ] Ein neuer, gezielter Unit-Test für den Fetch-Handler (Mock von
      `self`/`caches`/`fetch`) belegt beide oberen Punkte.

## Comments
