Status: resolved
Type: feature
Blocked by: None

## Description
Der geplante neue Katalog-Fork (siehe [ADR-0017](../../../adr/0017-lexicanum-katalog-fork-mit-eigener-revision-ci.md)) übernimmt seine Daten von einem Upstream-Repository, das BattleScribes `revision`-Konvention nachweislich nicht pflegt (empirisch belegt: `Skaven.cat` erhielt zwischen zwei Releases einen neuen Eintrag, `revision` blieb unverändert `"1"`) und kein `catpkg.json` bereitstellt. Der bestehende Update-Mechanismus der App (`src/db/catalogUpdate.js`, „revision, higher wins") erkennt Änderungen nur über exakt dieses Signal — ohne Gegenmaßnahme merkt kein importiertes System jemals ein Update.

Dieses Issue liefert das Werkzeug, das der Fork selbst braucht, um dieses Signal zuverlässig zu erzeugen: bei jedem Sync von Upstream wird pro Datei geprüft, ob sich der inhaltlich relevante Teil geändert hat, und falls ja, `revision` hochgezählt sowie `catpkg.json` im etablierten Format (siehe ADR-0014, BSData/publish-catpkg-kompatibel) neu generiert. Das Ergebnis ist ein eigenständiges Skript plus GitHub-Actions-Workflow-Vorlage — es läuft im *neuen Fork-Repository*, nicht in army_builder selbst; dieses Issue liefert und testet den Inhalt, das Einspielen in den tatsächlichen Fork ist ein manueller Schritt außerhalb des Trackers.

## Acceptance Criteria
- [ ] Ein Skript vergleicht eine alte und eine neue Version einer `.cat`/`.gst`-Datei und erkennt zuverlässig, ob sich inhaltlich relevanter Inhalt geändert hat (nicht nur das `revision`-Attribut selbst).
- [ ] Bei erkannter inhaltlicher Änderung wird `revision` im neuen Dateiinhalt um genau 1 erhöht; bei unveränderten Dateien bleibt `revision` unangetastet.
- [ ] `catpkg.json` wird für alle `.cat`/`.gst`-Dateien im erwarteten Format (`id`, `name`, `type`, `revision`, `sourceSha256`) neu generiert.
- [ ] Ein Regressionstest verwendet den realen, bereits verifizierten Skaven-Diff (Release `0.0.6` → `0.0.6.20260711`, neuer `entryLink` „Ice Trolls", `revision` bleibt bei Upstream `"1"`) als Fixture und erwartet, dass das Skript hierfür `revision` auf `"2"` hochzählt.
- [ ] Eine GitHub-Actions-Workflow-Vorlage ruft das Skript bei jedem Push/Sync auf und committet das Ergebnis (`catpkg.json` + ggf. hochgezählte `revision`-Attribute) in den Branch — analog zum in ADR-0014 beschriebenen Muster.
- [ ] Dokumentiert: welche manuellen Schritte im Ziel-Fork (Actions aktivieren, Workflow-Datei platzieren) noch außerhalb dieses Issues liegen.

## Comments
- Fork-CI-Werkzeug geliefert unter scripts/catalog-fork/: reine Logik (catalogRevision.js: Änderungserkennung ohne revision-Attribut, revision-Bump = max(vorher,neu)+1, catpkg-Erzeugung), CLI (generate-catpkg.js, git-basierter Basisvergleich), Workflow-Vorlage (Push-Trigger, committet Ergebnis mit [skip ci]) und README mit den manuellen Fork-Schritten. Regressionstest nutzt die realen Skaven-Dateien 0.0.6 -> 0.0.6.20260711 (Ice Trolls) als Fixture und erwartet revision 2. Einspielen in den echten Fork bleibt manueller Schritt außerhalb des Trackers.
