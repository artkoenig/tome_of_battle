Status: ready-for-agent
Blocked by: [02, 03, 05]

## Description
Das Kernstück: Ein veraltetes System aktualisiert sich beim App-Start **still**. Damit
erreichen Katalog-Fixes bestehende Nutzer, ohne dass diese ihr Spielsystem von Hand neu
importieren müssen.

Beim App-Start lädt die App den Index `catpkg.json` aus dem Fork, vergleicht pro Katalog
`remote.revision > stored.revision` („higher wins" — die offizielle BattleScribe-Semantik:
*„if it's higher, the file will be updated"*) und lädt nur die tatsächlich veralteten Dateien
nach, parst und speichert sie.

**Es gibt keine Rückfrage.** Der Katalog ist kein Nutzer-Artefakt, sondern ein Cache: Er ist
in-app nicht editierbar (der Editor wurde entfernt), es geht also nichts vom Nutzer Erzeugtes
verloren. Der Nutzer hat ein Spielsystem importiert, nicht eine Revision davon. Das ist die
Voraussetzung, unter der „still" überhaupt vertretbar ist.

**Ein Update läuft auch dann, wenn dadurch Roster-Einträge unauflösbar werden** — der Nutzer
erfährt es über die Validierung aus Issue 03 (deshalb blockiert sie dieses Issue). Bekannt
fehlerhafte Daten zu konservieren, um einen Folgefehler zu vermeiden, wäre die schlechtere
Wahl.

Umfang:
- **Revision mitführen.** Der Parser liest `revision` heute gar nicht; das gespeicherte System
  muss sie pro Katalog/Spielsystem tragen. Ohne dieses Feld gibt es keine Vergleichsbasis.
  Bestandsdaten ohne Revision (alles vor diesem Change) gelten als veraltet und werden beim
  ersten Start einmalig aktualisiert.
- **Vergleich** als reine, netzfreie Funktion.
- **Orchestrierung** (Abruf, Parsen, Speichern), angesiedelt bei der bestehenden
  Migrations-Pipeline, die beim App-Start läuft. Nimmt die Abruf-Funktion per Dependency
  Injection entgegen und ist damit ohne Netz testbar.
- **Service Worker:** `raw.githubusercontent.com` in die Caching-Regel aufnehmen.

Abrufweg: Die Dateien werden über `raw.githubusercontent.com` von
`artkoenig/Warhammer-Fantasy-6th-edition@master` geladen (bestätigt: liefert
`access-control-allow-origin: *` und gzip-komprimiert). Die `fileUrl`-Felder im Index zeigen
auf Release-Assets ohne CORS und werden **nicht** genutzt. Der ebenfalls im Index vorhandene
`sourceSha256` dient allenfalls der Integritätsprüfung, nicht der Update-Erkennung.

Die „higher wins"-Regel gilt ausnahmslos, auch für selbst hochgeladene Systeme: Trägt ein
Upload eine höhere Revision als der Fork, bleibt er unangetastet; trägt er eine niedrigere,
wird er aktualisiert. Eine Herkunfts-Sonderbehandlung entfällt. Systeme, deren ID der Index
nicht kennt, bleiben unberührt.

Ein fehlgeschlagener Abruf (offline, Rate-Limit, GitHub-Ausfall) ist **kein Fehlerfall für den
Nutzer**: Die App arbeitet mit dem gespeicherten Stand weiter, Listen bleiben offline nutzbar.

Kontext: [PRD](../../../PRD-katalog-updates-und-roster-kompatibilitaet.md) (Requirements 1+3,
Seams 1+2), [ADR 0014](../../../adr/0014-kataloge-als-externes-fork-repo-mit-laufzeit-abruf.md),
[ADR 0002](../../../adr/0002-data-flow-and-indexeddb-storage.md).

## Acceptance Criteria
- [ ] Ein gespeichertes System mit niedrigerer Revision wird beim App-Start still aktualisiert,
      ohne Rückfrage
- [ ] Nur tatsächlich veraltete Dateien werden geladen, nicht der ganze Katalogsatz
- [ ] Das gespeicherte System führt die Revision pro Katalog/Spielsystem mit
- [ ] Der Revisionsvergleich ist netzfrei testbar und deckt ab: „higher wins", Gleichstand,
      fehlende Revision (Bestandsdaten), dem Index unbekannte Systeme
- [ ] Die Orchestrierung nimmt die Abruf-Funktion per DI entgegen; getestet sind
      erfolgreiches Update, fehlgeschlagener Abruf und Parser-Fehler
- [ ] Ein fehlgeschlagener Abruf lässt den gespeicherten Stand unangetastet und meldet dem
      Nutzer nichts
- [ ] Ein Upload mit höherer Revision als der Fork bleibt unangetastet
- [ ] Der Service Worker cacht `raw.githubusercontent.com`; einmal importierte Systeme bleiben
      offline nutzbar
- [ ] Wird durch das Update ein Roster-Eintrag unauflösbar, erscheint der Validierungsfehler
      aus Issue 03

## Comments
