Status: claimed
Type: chore
Blocked by: None

## Description

### Problem

Das Skript zur Erzeugung von UI-Screenshots ist seit der Umstellung auf das
externe Katalog-Fork-Repo (ADR 0014, 0017, 0018, 0020) nicht mehr lauffähig. Es
packt seine Katalogdaten aus einem Verzeichnis unterhalb von `public/`, das mit
jener Umstellung entfallen ist — Katalogdaten werden heute ausschließlich zur
Laufzeit über das Netz bezogen. Das Skript bricht daher sofort mit „Catalog
directory not found" ab.

Die Folge ist keine Randnotiz: die Projektregel „nach jeder UI-sichtbaren
Änderung einen Screenshot der betroffenen Ansicht erzeugen" (CLAUDE.md, ADR 0006
Abschnitt 2) lässt sich nicht mehr erfüllen. In einer einzigen Sitzung sind zwei
Implementierungs-Agenten darüber gestolpert; einer hat sich mit einem
Einweg-Skript gegen die eingefrorene E2E-Fixture beholfen, ein anderer hat den
Screenshot-Beleg ersatzlos ausfallen lassen und das im Issue vermerkt.

### Ursache

Der Ablauf „App startklar machen" existiert im Repository **dreifach**:

1. im E2E-Smoke-Test — die einzige gepflegte und funktionierende Fassung,
2. im Screenshot-Skript,
3. im interaktiven Puppeteer-Debug-Skript.

Nur Kopie 1 wurde bei der Katalog-Umstellung nachgezogen. Die beiden anderen
sind zurückgeblieben. Das ist kein Zufall, sondern die vorhersehbare Folge der
Duplikation: derselbe Ablauf an drei Stellen wird an genau einer gepflegt.

Über den Katalogpfad hinaus weisen die beiden zurückgebliebenen Kopien weitere
Mängel auf, die sie auch auf einem fremden Rechner unbrauchbar machen:

- Ausgabeverzeichnisse sind auf absolute, rechnergebundene Pfade eines fremden
  Werkzeugs vorbelegt.
- Es fehlt die Netzwerk-Sperre gegen den stillen Katalog-Update-Abruf beim
  App-Start — der Lauf ist damit weder deterministisch noch netzfrei.
- Ausgeliefert wird über den Vite-Dev-Server. Genau diesen Weg hat ADR 0006 für
  den E2E-Test bewusst verworfen: das On-Demand-Transpilieren riss den Lauf
  unter Last reproduzierbar.
- Das Debug-Skript setzt zusätzlich einen bereits laufenden Server und eine
  Datei im Download-Ordner eines bestimmten Benutzers voraus.

### Lösung

Der gemeinsame Setup-Pfad wird **einmal** als Modul bereitgestellt und von allen
Verbrauchern genutzt, statt ihn ein viertes Mal zu kopieren:

- die eingefrorene E2E-Fixture zur ZIP packen,
- einmalig einen Produktions-Build erzeugen und statisch ausliefern,
- eine Puppeteer-Seite mit gesperrtem Katalog-Update-Abruf öffnen,
- IndexedDB zurücksetzen und das System aus der Fixture importieren.

Der bestehende E2E-Smoke-Test wird auf dieses Modul umgezogen — er ist die
Referenzfassung, sein Verhalten muss unverändert bleiben und wird nach dem
Umbau verifiziert. Das Screenshot-Skript wird darauf neu aufgesetzt und läuft
danach netzfrei und ohne rechnergebundene Pfade.

Das interaktive Debug-Skript entfällt ersatzlos. Seine drei eigenständigen
Fähigkeiten — Mitschnitt der Browser-Konsole samt Fehler-Stacktraces, Ausgabe
des gerenderten DOM eines Ausschnitts, sichtbar laufender Browser — gehen als
Opt-in-Bestandteile in das Harness über. Was danach fehlt, ist allein die
hartkodierte Klickstrecke mit fest verdrahteten Einheitennamen: eine dritte,
ungetestete Ablaufkopie, die bei jeder Fixture-Änderung nachgezogen werden
müsste und deren vorgeschriebene Schrittfolge ohnehin selten zur konkreten
Debug-Frage passt. Gegen das Harness ist ein passendes Wegwerf-Skript in wenigen
Zeilen geschrieben.

### Abgrenzung

Kein App-Code wird geändert; das Vorhaben betrifft ausschließlich Werkzeuge und
Dokumentation. Daher `Type: chore` und kein Versions-Bump.

Mit erfasst werden die Dokumentationsstellen, die aus derselben Ursache
zurückgeblieben sind: die ADR zu Test und Automatisierung sowie die
Projektanweisungen beschreiben das entfallende Debug-Skript weiterhin als
verfügbar, und die README führt das entfallene Katalogverzeichnis noch als
mitgeliefertes Datenpaket samt Nutzungshinweis. Nicht erfasst sind
Rückblick-Vermerke in bereits abgeschlossenen Issues — die halten einen
historischen Stand fest und bleiben unverändert.

## Acceptance Criteria

- [ ] Das Screenshot-Skript läuft auf einem frisch geklonten Repository ohne
      Netzwerkzugang und ohne Katalogverzeichnis unterhalb von `public/`
      vollständig durch und legt Screenshots für Desktop- und Mobil-Viewport ab.
- [ ] Kein Werkzeug-Skript enthält einen absoluten, rechnergebundenen Pfad; das
      Ausgabeverzeichnis ist per Umgebungsvariable überschreibbar und
      standardmäßig repo-lokal und git-ignoriert.
- [ ] Der Abruf des Katalog-Updates wird während des Laufs blockiert, sodass der
      Lauf ohne Netzwerk dasselbe Ergebnis liefert wie mit.
- [ ] Ausgeliefert wird ein vorab erzeugter Produktions-Build, nicht der
      Dev-Server.
- [ ] Der Ablauf „Fixture packen, ausliefern, Seite öffnen, Zustand
      zurücksetzen, System importieren" existiert genau einmal im Repository und
      wird vom E2E-Smoke-Test wie vom Screenshot-Skript genutzt.
- [ ] Der E2E-Smoke-Test läuft nach dem Umbau unverändert grün.
- [ ] Konsolen-Mitschnitt, DOM-Ausgabe und sichtbar laufender Browser sind über
      das gemeinsame Modul verfügbar.
- [ ] Das interaktive Debug-Skript und sein npm-Skript sind entfernt.
- [ ] Keine Dokumentationsstelle außerhalb abgeschlossener Issues verweist noch
      auf das entfernte Debug-Skript oder auf das entfallene Katalogverzeichnis
      unterhalb von `public/` als vorhandene Ressource.
- [ ] Die volle Vitest-Suite ist grün und der Linter meldet keine Fehler.

## Comments
