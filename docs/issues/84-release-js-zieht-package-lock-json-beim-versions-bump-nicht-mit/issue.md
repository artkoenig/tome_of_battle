Status: ready-for-agent
Type: fix
Blocked by: None

## Description

Der Versions-Bump schreibt die neue Version nur nach `package.json`. Die
Lockfile `package-lock.json` fuehrt die Version an zwei Stellen ebenfalls und
bleibt dabei stehen. Beide laufen ab dem ersten Bump auseinander und bleiben es,
bis irgendwann ein `npm install` die Lockfile stillschweigend korrigiert.

Beobachtet in dieser Sitzung: `package.json` stand auf `1.9.0`, die Lockfile auf
`1.8.2` — die Drift hatte also mindestens einen Minor- und einen Patch-Bump
ueberdauert. Sie fiel nur auf, weil ein `npm install` in einer frischen
Arbeitskopie die Lockfile veraenderte und damit eine ungewollte Aenderung in den
Arbeitsbaum brachte.

Zwei Folgen, beide unangenehm:

1. **Ungewollte Aenderungen im Arbeitsbaum.** Wer in einer frischen Arbeitskopie
   die Abhaengigkeiten installiert, bekommt eine geaenderte Lockfile, die nichts
   mit seiner Arbeit zu tun hat. Das verrauscht jeden Commit und jedes Review.
2. **Die Lockfile luegt ueber die Version des Pakets.** Sie ist die
   reproduzierbare Beschreibung des Abhaengigkeitsstands; ein falsches
   Versionsfeld darin ist ein Widerspruch zum Zweck der Datei.

Der eigentliche Abgleich der Versionsfelder ist auf diesem Branch bereits
erfolgt (ein Commit, nur die beiden Versionsfelder). Dieses Issue behebt die
Ursache, damit die Drift nicht beim naechsten Bump neu entsteht.

Beruehrt den in `CLAUDE.md` beschriebenen Release-Ablauf: der Bump vor dem Merge
eines `feature`/`fix`-Main-Issues muss danach beide Dateien in denselben Commit
bringen, sonst traegt der Squash-Merge weiter nur die halbe Wahrheit nach `main`.

## Acceptance Criteria
- [ ] Ein Versions-Bump setzt die Version an allen Stellen, an denen das Repository sie deklariert — `package.json` und beide Versionsfelder der Lockfile.
- [ ] Nach einem Bump veraendert ein Installieren der Abhaengigkeiten die Lockfile nicht mehr.
- [ ] Ein Bump, der nur teilweise wirkte, bricht sichtbar ab statt durchzulaufen.
- [ ] Ein Test liest die echten, eingecheckten Dateien des Repositorys und faellt, wenn sie verschiedene Versionen nennen. Er laeuft offline und ruft keinen Paketmanager auf.
- [ ] Die Pruefung faellt auch bei einer unbekannten Lockfile-Formatgeneration, statt sie stillschweigend durchzulassen.
- [ ] Gegenproben halten fest, dass die Pruefung ueberhaupt greift: eine unbekannte Formatgeneration, ein zusaetzliches Wurzel-Versionsfeld und ein nur halb mitgezogener Bump muessen jeweils auffallen.
- [ ] Repariert der Bump eine vorbestehende Abweichung im Vorbeigehen, protokolliert er das sichtbar.
- [ ] Es ist geprueft, welche weiteren Stellen des Repositorys die Version als eingechecktes Literal fuehren (etwa Service-Worker-Cache-Name, Web-App-Manifest, Anzeige in der Oberflaeche, README). Gefundene sind entweder aus der maszgeblichen Quelle abgeleitet oder so registriert, dass dieselbe Pruefung sie mitbewacht.
- [ ] Die Beschreibung des Release-Ablaufs und ADR-0019 nennen die maszgebliche Quelle und die abgeleiteten Stellen.

## Decisions
- `[po]` Gefunden, weil ein npm install eines Recherche-Subagenten package-lock.json von 1.8.2 auf die in package.json stehende 1.9.0 zog — eine ungewollte Aenderung im Arbeitsbaum. Quelle des Befunds: scripts/release.js erwaehnt package-lock.json nirgends. Der reine Abgleich der Versionsfelder ist auf diesem Branch als trivialer Change (eine Datei, .json) erledigt und vom Praedikat bestaetigt; dieses Issue traegt die Ursache. Neues Main-Issue auf needs-triage, weil es keinem Akzeptanzkriterium des laufenden Main-Issues 81 dient.
- `[po]` Schreibweg entschieden: die Versionsfelder werden direkt geschrieben (Option A), nicht per 'npm version' delegiert. Der Reinraum-Gutachter widersprach hier und wollte delegieren, weil das Lockfile-Schema npm gehoert; er relativierte es selbst ('weil wir ohnehin verifizieren, ist der Unterschied klein') und fuehrte das Selbst-Schreiben als gleichwertigen Rueckfallplan. Zwei Gruende, die er nicht haben konnte, entscheiden dagegen: (1) Der Architekt hat an den echten Repo-Dateien gemessen, dass direktes Schreiben ein byte-identisches Ergebnis zu npms eigenem Writer liefert — die Formattreue, sein Hauptargument, ist damit kein Unterschied. (2) Sein Fixture-Test des Bump-Pfads braeuchte einen npm-Subprozess in der Suite; mit Option A sind alle Tests reine Datenpruefungen, was ADR-0006 (Tests offline und schnell) entspricht. Nebeneffekt: sein Risiko 1 (npm version verweigert dieselbe Version) entfaellt, weil erneutes Schreiben derselben Version bei Option A ein No-op ist — der Lauf ist von sich aus idempotent.
- `[po]` Vier Verbesserungen aus dem Reinraum-Gegenentwurf uebernommen, unabhaengig von der Optionswahl: (1) ein deklaratives Modul 'wo steht die Version' mit der Allow-List der Lockfile-Formatgenerationen und einer reinen Pruef-Funktion, die Release-Skript und Testsuite gemeinsam benutzen — eine Formulierung der Zusicherung, zwei Konsumenten, statt eines Guards im Schreiber. (2) Nach dem Schreiben verifizieren mit Exitcode ungleich 0; der Gutachter liefert dafuer ein Argument aus npms Quelltext, das fuer beide Optionen gilt: libnpmversion kapselt den Lockfile-Write in try/catch mit 'ignore errors', npms eigener Lockfile-Write scheitert also stumm — genau die Fehlerklasse dieses Issues. (3) Negativ-Fixtures, damit der Test prueft, dass der Pruefer greift: unbekannte Formatgeneration, gepflanztes zusaetzliches Wurzel-Versionsfeld, nur halb mitgezogener Bump. Ohne Gegenproben attestiert eine Assertion nur sich selbst. (4) Restfund-Scan wurzelnah statt aufzaehlend, damit ein neu erfundenes Wurzel-Versionsfeld auffaellt, ohne bei Dependency-Versionen falsch anzuschlagen.
- `[po]` Akzeptanzkriterien geweitet um den wertvollsten Befund des Gegenentwurfs (sein Risiko 8): ein PWA-Projekt traegt die Version erfahrungsgemaess mehrfach — Service-Worker-Cache-Name, Web-App-Manifest, Anzeige in der Oberflaeche, README-Badge. Jede eingecheckte Literal-Stelle ist die naechste, die driftet. Neues Kriterium: es ist zu pruefen, welche weiteren Stellen die Version als Literal fuehren, und gefundene sind abzuleiten oder zu registrieren. Bewusst als Pruefauftrag formuliert und nicht als Behauptung, weil ich nicht weiss, welche Stellen es gibt — CLAUDE.md nennt lediglich, dass der Build eine frische SW-Cache-Version injiziert, was fuer eine abgeleitete und nicht eingecheckte Stelle spricht.
- `[po]` Kein ADR-Kandidat, wie der Architekt feststellte — aber ADR-0019 fehlte ein tragender Satz, den ich ergaenzt habe: package.json#version ist normativ, package-lock.json fuehrt die Version an zwei Feldern als abgeleiteten Spiegel und wird vom Bump mitgezogen. Dazu zwei Regeln aus dem Gegenentwurf: 'npm pkg set version=...' ist als Bump verboten, weil es die Lockfile unberuehrt laesst und die Luecke wieder aufreisst, und ein Merge-Konflikt wird ueber package.json plus erneuten Bump geloest statt die Lockfile-Versionsfelder von Hand zu mergen. ADR-0019 stellte bisher nur package.json als Single Source of Truth fest und schwieg ueber die abgeleiteten Stellen — genau die Luecke, aus der dieses Issue entstand.

## Comments
