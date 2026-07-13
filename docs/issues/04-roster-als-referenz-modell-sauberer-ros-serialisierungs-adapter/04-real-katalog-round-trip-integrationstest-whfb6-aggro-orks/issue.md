Status: resolved
Blocked by: [02, 03]

## Description

Ein Integrationstest verifiziert den vollständigen semantischen Round-Trip mit dem
**echten** WHFB6-Katalog (`public/catalogs/whfb6/`) und der realen Fixture-Datei
„Aggro Orks.rosz". Er schließt die bisherige Verifikationslücke (Reconcile/Kosten
konnten bislang nur gegen Mock-Kataloge geprüft werden).

Ablauf: Katalog laden → Fixture importieren → berechnete Gesamtkosten prüfen →
exportieren → re-importieren → Kosten/Validierung vergleichen.

## Acceptance Criteria
- [ ] Import von „Aggro Orks" mit echtem WHFB6-Katalog ergibt exakt **2000**
      Punkte (berechnet).
- [ ] Alle im Original gewählten Optionen sind nach Import als gewählt erkennbar
      (Count > 0 über die Editor-Matching-Logik).
- [ ] Export ergibt eine `.ros` mit Selektions-Kostensumme = 2000.
- [ ] Re-Import liefert identische berechnete Kosten und Validierungsergebnisse
      (semantischer Round-Trip, modulo Split/UUIDs).

## Comments
- Umgesetzt: Integrationstest rosterSerialization.integration.test.js baut das echte WHFB6-System aus public/catalogs/whfb6 (gst + Orcs and Goblins.cat) und importiert die Fixture src/utils/__fixtures__/aggro-orks.ros. Verifiziert: berechneter Gesamtwert exakt 2000, Reconcile idempotent, 79 gewaehlte Optionen ueber die Editor-Matcher-Logik erkannt (>20), semantischer Round-Trip (Export->Re-Import) haelt 2000 und Validierung, flache Selektions-Kostensumme = 2000. Schliesst die Verifikationsluecke gegen echten Katalog.
