Status: ready-for-agent
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
