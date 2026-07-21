Status: resolved
Type: fix
Blocked by: None

## Description

Befund W5. Ein BattleScribe-Katalog kann sich am Wurzelelement als reine
Bibliothek kennzeichnen: er liefert Bausteine, auf die andere Kataloge
verweisen, stellt aber selbst keine spielbare Armee dar.

Die vendorte XSD kennt dieses Attribut, der Codegen führt die passende
Konstante — der Parser liest es nicht aus. In der Folge listet die Armeeauswahl
beim Anlegen einer neuen Liste auch Bibliothekskataloge auf, obwohl sich daraus
keine sinnvolle Liste bauen lässt.

Für das Auflösen geteilter Einträge bleiben Bibliothekskataloge weiterhin
nötig — sie sollen nur nicht mehr als Armee angeboten werden.

## Acceptance Criteria
- [ ] Der Parser übernimmt die Bibliothekskennzeichnung des Katalogs ins Modell
- [ ] Die Armeeauswahl beim Anlegen einer neuen Liste zeigt als Bibliothek gekennzeichnete Kataloge nicht mehr an
- [ ] Einträge aus Bibliothekskatalogen werden weiterhin korrekt aufgelöst und in Listen verwendet
- [ ] Ein Katalog ohne die Kennzeichnung bleibt wie bisher wählbar
- [ ] Tests decken beide Fälle ab: gekennzeichnet und nicht gekennzeichnet

## Comments
- parseCatalogueXML liest catalogue@library als isLibrary ins Modell; neuer Selektor getPlayableCatalogues filtert Bibliothekskataloge aus der Fraktionsauswahl im NewRosterModal. Kataloge bleiben vollstaendig im System, damit geteilte Eintraege weiterhin aufgeloest werden.
