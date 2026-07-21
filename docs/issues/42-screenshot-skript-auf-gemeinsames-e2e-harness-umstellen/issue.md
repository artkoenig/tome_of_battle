Status: resolved
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
Stellen, die den Zustand **vor** der Migration bewusst historisch festhalten:
Rückblick-Vermerke in abgeschlossenen Issues ebenso wie die Kontext- und
Planungsabschnitte der ADRs und PRDs, die jene Umstellung beschreiben. Sie
schildern im Präteritum, was einmal galt, und bleiben unverändert; korrigiert
wird nur, was im Präsens eine nicht mehr existierende Ressource behauptet.

## Acceptance Criteria

- [x] Das Screenshot-Skript läuft auf einem frisch geklonten Repository ohne
      Netzwerkzugang und ohne Katalogverzeichnis unterhalb von `public/`
      vollständig durch und legt Screenshots für Desktop- und Mobil-Viewport ab.
- [x] Kein Werkzeug-Skript enthält einen absoluten, rechnergebundenen Pfad; das
      Ausgabeverzeichnis ist per Umgebungsvariable überschreibbar und
      standardmäßig repo-lokal und git-ignoriert.
- [x] Der Abruf des Katalog-Updates wird während des Laufs blockiert, sodass der
      Lauf ohne Netzwerk dasselbe Ergebnis liefert wie mit.
- [x] Ausgeliefert wird ein vorab erzeugter Produktions-Build, nicht der
      Dev-Server.
- [x] Der Ablauf „Fixture packen, ausliefern, Seite öffnen, Zustand
      zurücksetzen, System importieren" existiert genau einmal im Repository und
      wird vom E2E-Smoke-Test wie vom Screenshot-Skript genutzt.
- [x] Der E2E-Smoke-Test läuft nach dem Umbau unverändert grün.
- [x] Konsolen-Mitschnitt, DOM-Ausgabe und sichtbar laufender Browser sind über
      das gemeinsame Modul verfügbar.
- [x] Das interaktive Debug-Skript und sein npm-Skript sind entfernt.
- [x] Keine Dokumentationsstelle behauptet im Präsens noch das entfernte
      Debug-Skript oder das entfallene Katalogverzeichnis unterhalb von
      `public/` als vorhandene Ressource; historische Schilderungen des
      Vorzustands (abgeschlossene Issues, ADR- und PRD-Kontextabschnitte)
      bleiben davon unberührt.
- [x] Die volle Vitest-Suite ist grün und der Linter meldet keine Fehler.

## Comments
- Umgesetzt: scripts/lib/e2e-harness.js buendelt Fixture-Packen, vite build, vite preview, Puppeteer-Seite mit gesperrtem raw.githubusercontent.com-Abruf, IndexedDB-Reset und Fixture-Import; zusaetzlich Opt-in fuer Konsolen-Mitschnitt, DOM-Ausgabe und sichtbaren Browser. src/solver/ui.test.js und scripts/generate_screenshots.js konsumieren es (Testzusicherungen unveraendert). scripts/debug_ui.js und npm run debug-ui entfernt. Doku nachgezogen: ADR 0006, AGENTS.md/CLAUDE.md, README, Fixture-README, battlescribe-data-format.md. Netto -822/+705 Zeilen. Drei Befunde traten erst beim Ausfuehren zutage: (1) 02_bibliothekar_loaded zeigte den falschen Bildschirm, weil die App nach dem Import selbsttaetig ins Heerlager wechselt - auffaellig nur durch byte-identische Dateigroesse zu 03; (2) das Skript schluckte fehlende Elemente still (if (el) el.click()), wodurch Bilder entstanden, deren Name luegt - Pflichtklicks werfen jetzt; (3) die Ausgabe haette das versionierte screenshots/ mit den kuratierten README-Bildern ueberschrieben, und zwar mit dem roten Offline-Hinweis des netzfreien Laufs - Ziel ist nun .screenshots/ (git-ignoriert). Verifikation: E2E gruen, 1005 Vitest-Tests in 112 Dateien gruen, oxlint 0 Fehler (52 vorbestehende Warnungen), Screenshot-Lauf erzeugt 16 Bilder offline. Vier-Achsen-Gate: Spezifikation 0 Befunde (alle 10 Kriterien live nachgefahren), Tests gruen, Doku 1 Befund (Tracking-Status - prozedural erwartbar, hiermit erledigt), Standards 8 Befunde ausschliesslich in vorbestehendem App-Code ausserhalb dieses Diffs; das Harness selbst ohne Beanstandung.
