Status: resolved
Blocked by: None

## Description

Spezifikation (PRD): [`docs/PRD-roster-serialization-adapter.md`](../../PRD-roster-serialization-adapter.md).
Architekturentscheidung: [`ADR-0011`](../../adr/0011-roster-referenzmodell-und-serialisierungs-adapter.md).

Das interne Roster bleibt ein schlankes Referenz-Modell (Katalog = SSOT); die
`.ros`-Serialisierung wird zu einem sauberen, verlustfreien Adapter gehärtet,
statt das interne Modell an `.ros` anzugleichen. Kern: Kosten werden nicht mehr
im Roster gespeichert, sondern modifier-bewusst aus dem Katalog abgeleitet;
`type` wird beim Export abgeleitet; die Options-Identität ist eine Link-ID-
Invariante (Import normalisiert `.ros`-Ziel-IDs, bereits umgesetzt); der
Kriegsmaschinen-Split bleibt eine bewusste Import-Transformation ohne Re-Merge.

Bereits auf diesem Branch ausgeliefert (Vorarbeit): `<costLimits>`-Round-Trip,
Import-Reconcile der Options-Identität, ein interimistischer `×number`-Export-Fix
(wird von Issue 02 durch die modifier-bewusste Berechnung ersetzt).

## Acceptance Criteria
- [ ] Alle Child-Issues resolved.
- [ ] Real-Fixture „Aggro Orks" ergibt durchgehend exakt 2000 Punkte, alle
      gewählten Optionen nach Import sichtbar (semantischer Round-Trip).
- [ ] Dokumentation (CLAUDE.md, `docs/battlescribe-data-format.md`) frei von
      Widersprüchen zu ADR-0011.

## Comments
- Alle Child-Issues resolved. Verifiziert mit echtem WHFB6-Katalog: Aggro Orks = exakt 2000 Pkt, Optionen erkannt, semantischer Round-Trip stabil. Volle Suite gruen (238), Lint/Build ok. ADR-0011 + PRD dokumentieren die bewusste Abweichung von .ros (Referenz-Modell, abgeleitete Kosten, Link-ID-Invariante, Split als Import-Transformation).
