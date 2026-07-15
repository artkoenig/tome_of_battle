Status: ready-for-agent
Blocked by: [01, 05, 06]

## Description
Der letzte Schritt des Umzugs: Der Erst-Import bezieht seine Systemliste aus dem
`catpkg.json`-Index des Forks statt aus dem Build-Zeit-Manifest. Damit verlassen die
Katalogdaten das App-Repo endgültig.

Entfallen:
- `public/catalogs/` — die Kopie der Katalogdaten im App-Repo
- das Manifest-generierende Vite-Plugin, das beim Build jede `.cat`/`.gst` einliest

Der Import selbst bleibt aus Nutzersicht unverändert: Systemliste wählen, importieren. Nur die
Herkunft der Liste ändert sich.

**Kein Offline-Regress:** Der Service Worker precacht die Kataloge schon heute nicht — ein
Erst-Import brauchte immer Netz. Der Umzug tauscht lediglich same-origin gegen cross-origin;
die Caching-Regel dafür kommt aus Issue 06.

Blockiert von 01, weil der E2E-Test bis dahin auf `public/catalogs/` steht und mit dessen
Entfernen bräche. Blockiert von 06, weil die Abruf- und Cache-Infrastruktur vorhanden sein
muss.

Nicht Teil dieses Issues:
- **Kein UI zum Verwalten von Katalogquellen.** Der Fork ist fest verdrahtet; Nutzer können
  keine eigenen Repos hinzufügen.
- **Der bestehende `.bsz`-Upload-Weg bleibt unverändert** erhalten.
- **Keine Migration weiterer Spielsysteme.** Betroffen ist ausschließlich das vorhandene
  WHFB-6th-Set.

Kontext: [PRD](../../../PRD-katalog-updates-und-roster-kompatibilitaet.md) („Affected
Modules", „Out of Scope"),
[ADR 0014](../../../adr/0014-kataloge-als-externes-fork-repo-mit-laufzeit-abruf.md).

## Acceptance Criteria
- [ ] Die Systemliste im Import stammt aus dem `catpkg.json` des Forks
- [ ] `public/catalogs/` ist entfernt
- [ ] Das Manifest-generierende Vite-Plugin ist entfernt; der Build läuft grün
- [ ] Ein Erst-Import funktioniert Ende-zu-Ende und liefert ein korrekt geparstes System
- [ ] Ist der Index nicht erreichbar, bleibt die App bedienbar und meldet verständlich, dass
      gerade keine Systeme zum Import verfügbar sind
- [ ] Der `.bsz`-Upload-Weg funktioniert unverändert
- [ ] Der E2E-Test läuft grün (aus der Fixture, ohne `public/catalogs/`)

## Comments
