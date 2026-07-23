# Showcase-Fixture: Imperium (eingefroren)

Katalogdaten für `scripts/generate_showcase_screenshots.js` — das Werkzeug, das die
drei kuratierten Showcase-Screenshots der GitHub-Landing-Page erzeugt
(`docs/assets/screenshots/showcase_0{1,2,3}_*.png`). Anders als die WHFB6-Fixture
unter `src/solver/__fixtures__/whfb6/`, die die App über den Datei-Upload-Weg füttert,
werden diese Dateien dem Browser per Request-Interception unter der GitHub-Raw-URL der
**ersten** Katalog-Quelle ausgeliefert. So läuft der Showcase durch den echten
Online-Bibliothekar der App (Spielsystem- und Fraktionsauswahl), ohne dass der
Headless-Browser ins Netz muss.

## Herkunft

- Quelle: `catpkg.json`, `Warhammer Fantasy Battle 6th edition.gst` und `Empire.cat` aus
  der ersten Katalog-Quelle `artkoenig/Warhammer-Fantasy-6th-edition@master`
  (siehe `src/db/catalogUpdate.js`, `CATALOG_SOURCES`)
- Stand: abgerufen 2026-07-23 (`Empire.cat` revision `11`)

## Warum das Imperium

Die Showcase-Bilder zeigen bewusst das Imperium: einen Imperiums-Helden beim
Konfigurieren seiner Ausrüstung (Bild 2) und mehrere Imperiums-Einheiten in der
Spielansicht inklusive Zauber-/Bannwürfeln (Bild 3). Die eingefrorene WHFB6-Fixture
enthält diese Fraktion nicht.

## Warum nur Empire physisch

`catpkg.json` listet den vollständigen Fraktionssatz (Bretonnia, Chaos, Dark Elves …),
damit Bild 1 die ganze Breite der Fraktionsauswahl zeigt. Physisch liegt nur `Empire.cat`
(neben der Spielsystemdatei) hier: Der Showcase importiert ausschließlich das Imperium,
also fordert der Lauf keine andere Fraktionsdatei an. Ein späterer „Alle auswählen"-Import
gegen diese Fixture liefe für die übrigen Fraktionen ins Leere — für den Showcase-Zweck
bewusst in Kauf genommen.

## Update-Politik

Diese Fixture wird **nicht** automatisch mit dem externen Katalog-Fork synchronisiert.
Sie ändert sich nur, wenn die Showcase-Bilder bewusst neu erzeugt werden sollen.
