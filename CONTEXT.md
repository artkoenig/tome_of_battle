# Army Builder

Ein WHFB6-Armeelisten-Builder als PWA. Dieser Glossar-Abschnitt hält Begriffe fest, die im Projekt sonst leicht verwechselt werden.

## Language / Glossary

**Release**:
Der bewusste, manuelle Akt, eine neue Versionsnummer zu setzen (`package.json` + Git-Tag `vX.Y.Z`) und den zugehörigen `main`-Commit in Vercel auf Production zu promoten.
_Avoid_: Deployment (siehe unten — nicht jedes Deployment ist ein Release).

**Deployment**:
Jeder von Vercel gebaute Build (bei Push auf `main` oder einen anderen Branch). Ein Deployment ist noch kein Release — es wird erst durch manuelles Promoten in Vercel produktiv.

**Version**:
Die Semver-Nummer (`vX.Y.Z`) in `package.json`, die einen Release eindeutig identifiziert und in den App-Einstellungen angezeigt wird.

**Release Notes** ("Chronik der Veränderungen"):
Die nutzersichtbare Liste der `feat:`/`fix:`-Commit-Subjects seit der zuletzt installierten Version, angezeigt im PWA-Update-Dialog. Datenquelle ist die Git-Commit-Historie, nicht der Issue-Tracker.
_Avoid_: Changelog (technischer Begriff für dieselbe Sache — `changelog.json` als Dateiname bleibt, aber im Nutzerkontext heißt es Release Notes / "Chronik der Veränderungen").

**Production** (Domain):
Die vom Nutzer aufgerufene Live-Domain, auf die zuletzt ein Deployment manuell promotet wurde (siehe Release). Nicht gleichzusetzen mit "der `main`-Build" — ein Deployment vom `main`-Branch (z. B. die Vercel-Branch-Alias-URL) ist erst nach dem manuellen Promoten tatsächlich Production, siehe [ADR 0021](docs/adr/0021-preview-badge-laufzeit-hostname-erkennung.md).
_Avoid_: "main-Build" als Synonym für Production — seit ADR 0019 sind das zwei verschiedene Zustände.

**Listenkonfiguration**:
Ein listenweiter Battlescribe-Schalter, der über eine Armeeliste hinweg gilt, aber keine spielbare Einheit ist: ein Eintrag vom Typ `upgrade`, dessen gesamter Teilbaum (der Eintrag selbst und alle seine `selectionEntries`-Kinder) profil- und kostenlos ist. Das Kriterium ist strukturell und gilt in zwei Ausprägungen: für eine bereits gewählte Roster-Selection (zusätzlich: Top-Level-Selection einer Force, nicht verschachtelt unter einer Einheit) ebenso wie für eine rohe Katalog-Eintragsdefinition, die noch gar nicht gewählt wurde (zusätzlich: direkt unter den `selectionEntries`/`entryLinks`/`sharedSelectionEntries` einer Kategorie deklariert, nicht als Kind eines anderen Eintrags verschachtelt). Beispiel: „Allow experimental rules?" in der WHFB6 Definitive Edition.
_Avoid_: Einheit/Unit für diesen Eintragstyp — er trägt keinen Spielzustand (keine Wunden, kein Profil) und muss in Editor und Spielansicht sichtbar anders behandelt werden als eine Einheit.

**Listenkonfigurations-Kategorie**:
Eine Battlescribe-Kategorie (`categoryLink`), deren sämtliche Katalog-Einträge Listenkonfigurationen sind — unabhängig davon, ob bereits etwas aus ihr gewählt wurde. Sie enthält per Definition keine spielbaren Einheiten. Der Heerlager-Editor rendert eine solche Kategorie immer als aufklappbare Konfigurations-Kachel, nie über den regulären „Einheit ausheben"-Dialog — auch bevor eine erste Auswahl getroffen wurde. Beispiel: „Special List Rules" in der WHFB6 Definitive Edition (enthält u. a. „Allow experimental rules?", „Allow special characters?", „Campaign/Scenario rules", „Mercenaries and Regiments of Renown").
_Avoid_: Mit „Armeeweite Auswahl" oder „Sonstiges" verwechseln — das sind dynamisch aus dem Roster-Zustand zusammengesetzte Sammelbereiche ohne feste Katalog-Kategorie und bleiben von diesem Konzept unberührt.
