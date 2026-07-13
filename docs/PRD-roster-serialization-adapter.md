# PRD: Roster-Format als Referenz-Modell — sauberer .ros-Serialisierungs-Adapter

## Problem Statement / Bug Description

Der Export/Import im BattleScribe-`.ros`-Format hatte zwei Fehler, deren Ursache
in **Impedanz-Unterschieden** zwischen unserem internen Roster-Modell und dem
`.ros`-Format liegt (nicht in Einzelfehlern):

- **Kosten:** Der Export schrieb den intern gespeicherten Pro-Stück-Wert; `.ros`
  erwartet pro Auswahl den Gesamtwert. Mehrmodellige Einheiten kollabierten beim
  Export (z. B. 2000 → 1246 Pkt.). Zusätzlich latent: modifier-veränderte Optionen
  (Rabatt/Aufpreis) würden pro Zeile falsch exportiert, da der Export die Basiskosten
  statt der berechneten Kosten nutzt.
- **Options-Identität:** Importierte Optionen wurden im Editor nicht als gewählt
  angezeigt, weil `.ros` Optionen über die Ziel-ID (als `::`-Pfad) referenziert,
  der Editor aber über die Link-ID matcht.

Beide Symptome wurden bereits punktuell behoben (Export `×number`; Import-Reconcile).
Dieses PRD legt die **Grundausrichtung** fest, damit diese Bugklassen strukturell
verschwinden, statt weiter gepatcht zu werden.

Erwartetes Verhalten: Ein Roster, das im Editor exakt X Punkte hat, muss als `.ros`
exportiert exakt X Punkte enthalten und in BattleScribe/New Recruit sowie beim
Re-Import wieder exakt X Punkte ergeben; importierte Optionen erscheinen im Editor
als gewählt.

## Solution

Das interne Roster bleibt ein **schlankes Referenz-Modell** (nur die Nutzer-Auswahl;
Kosten/`type`/Profile werden aus dem Katalog abgeleitet, SSOT = Katalog). Die `.ros`
ist ein **denormalisierter, portabler Snapshot**. Die Serialisierung wird zu einem
**sauberen, verlustfreien Adapter** gehärtet, statt das interne Modell an `.ros`
anzugleichen. Grundsatzentscheidung und Trade-offs sind in **ADR-0011** festgehalten.

Kern der Lösung:

1. **Kosten nicht mehr im Roster speichern.** `costs` wird aus dem `Selection`-Modell
   entfernt; Editor-Anzeige wie Export berechnen Kosten zur Laufzeit **modifier-bewusst**
   aus dem Katalog. Damit gibt es nur noch eine autoritative Kostenquelle — die
   Kosten-Round-Trip- und die Modifier-Inkonsistenz verschwinden gemeinsam.
2. **Options-Identität als Modell-Invariante** (Link-ID). Der Import normalisiert
   `.ros`-Ziel-IDs/`::`-Pfade auf die Link-ID (bestehender Reconcile-Pass als
   Anti-Corruption-Layer).
3. **`type` beim Export aus dem Katalog ableiten** (statt konstant `upgrade`).
4. **Kriegsmaschinen-Split** bleibt eine bewusste Import-Transformation; **kein
   Re-Merge** beim Export. Round-Trip ist semantisch, nicht strukturell.

## User Stories / Requirements

1. Als **Spieler** möchte ich, dass eine im Editor X Punkte teure Liste als `.ros`
   exakt X Punkte enthält — auch bei mehrmodelligen Einheiten und bei durch
   Modifikatoren veränderten Optionskosten —, damit die Datei in BattleScribe/New
   Recruit korrekt erscheint.
2. Als **Spieler** möchte ich eine exportierte Liste wieder importieren und exakt
   dieselben Punkte und dieselbe Validierung sehen (semantischer Round-Trip).
3. Als **Spieler** möchte ich, dass nach dem Import alle gewählten Optionen im Editor
   als gewählt angezeigt und weiter bearbeitbar sind.
4. Als **Entwickler** möchte ich genau eine autoritative Kostenquelle und eine
   einzige Options-Identitäts-Konvention, damit ganze Bugklassen entfallen.
5. Als **Nutzer mit bestehenden gespeicherten Rostern** möchte ich, dass diese ohne
   Datenverlust weiter funktionieren (nicht-destruktive, lazy Migration).

## Technical Decisions

- **Affected Modules (verhaltensbezogen, nicht als Aufgabenliste):**
  - Serialisierung: Export/Import (`exportRosterToXml`/`importRosterFromXml`) —
    Kosten und `type` werden abgeleitet; `<costLimits>` bereits umgesetzt.
  - Kostenberechnung (`rosterCounter`/`calculateRosterCosts`) — Basiskosten aus dem
    Katalog statt aus `selection.costs`; zusätzlich eine **Pro-Auswahl-Kostenfunktion**
    (modifier-bewusst), die der Export je Selektion konsumiert.
  - Import-Normalisierung (`reconcileImportedSelectionIds`) — bleibt als
    Anti-Corruption-Layer; Options-Identität = Link-ID.
  - Datenmodell (`types.js`) — `costs` entfällt aus `Selection`; `name` bleibt.
  - Roster-Erzeugung/-Sync (`useRoster`, `syncRosterSelectionsWithSystem`) — keine
    Kosten mehr schreiben/synchronisieren.

- **Technical Clarifications / Architectural Decisions:** siehe **ADR-0011**.
  Ergänzend gilt weiterhin ADR-0003 §4 (Kosten/Constraints `child.number × parent.number`;
  `scope="parent"` vergleicht Ziel-IDs). Die Link-ID-Identität der Auswahl steht
  nicht im Widerspruch zur Ziel-ID-Semantik von Constraints.

- **API Contracts / Data Models:**
  - `Selection` verliert `costs`. Neu (Referenz-Modell): `{ id, name, entryLinkId,
    selectionEntryId, number, category, collective, selections }`.
  - Export: pro Auswahl serialisierter Kostenwert = modifier-bewusst berechneter
    Gesamtwert dieser Auswahl (Quelle identisch zum `<costs>`-Gesamtblock).
    `type` = `resolveEntry(entry).type`.
  - Import: liefert weiterhin frische UUIDs; Options-Referenzen sind nach dem
    Reconcile Link-IDs. `costLimit` aus `<costLimits>`.
  - Migration: nicht-destruktiv; vorhandenes `costs` in gespeicherten Rostern wird
    ignoriert und lazy beim Speichern entfernt.

## Testing Decisions

- **Modules to Test:**
  - Serialisierung (Export/Import) inkl. Kosten-, `type`- und `costLimit`-Verhalten.
  - Kostenberechnung ohne gespeicherte `selection.costs` (Ableitung aus Katalog,
    modifier-bewusst, inkl. Pro-Auswahl-Wert).
  - Import-Reconcile (Options-Identität) — bestehende Abdeckung bleibt.

- **Test Interfaces (Seams):**
  1. `exportRosterToXml` / `importRosterFromXml` (bestehende Unit-Tests erweitern).
  2. `reconcileImportedSelectionIds` (bestehend).
  3. `calculateRosterCosts` + neue Pro-Auswahl-Kostenfunktion (`rosterCounter`).
  4. **Integrations-Seam mit echtem Katalog:** WHFB6-Kataloge unter
     `public/catalogs/whfb6/` + reale Datei „Aggro Orks.rosz" als Fixture →
     Round-Trip-Test: Export-Gesamtsumme = **exakt 2000**, alle gewählten Optionen
     nach Import erkannt (Count > 0), Re-Import ergibt identische berechnete Kosten
     und Validierung.

- **Akzeptanzkriterien:**
  - [ ] Export einer im Editor X Punkte teuren Liste ergibt eine `.ros` mit
        flacher Selektions-Kostensumme = X (inkl. mehrmodelliger Einheiten).
  - [ ] Modifier-veränderte Optionskosten werden pro Zeile korrekt exportiert.
  - [ ] `type` im Export entspricht dem Katalog (`unit`/`model`/`upgrade`).
  - [ ] Nach Import sind alle gewählten Optionen im Editor als gewählt sichtbar.
  - [ ] Semantischer Round-Trip: `import(export(r))` liefert identische berechnete
        Kosten und Validierung (modulo Split/UUIDs).
  - [ ] Bestehende gespeicherte Roster laden ohne Fehler; kein Kostenverlust.
  - [ ] Real-Fixture „Aggro Orks" ergibt durchgehend exakt 2000 Punkte.

## Out of Scope

- **Struktureller** Round-Trip / Re-Merge gesplitteter Kriegsmaschinen beim Export.
- Entfernen des `name`-Feldes (bewusst als deskriptiver Cache/Resilienz behalten).
- Übernahme weiterer `.ros`-Felder, die die App nicht nutzt (`customName`, Notizen,
  eingebettete Profile/Regeln) — vgl. bestehende Export/Import-Feature-Spec.
- Weitere Exportformate (PDF/HTML).
- Änderungen am Katalog-Parser (`.cat`/`.gst`) oder an der Solver-Regelauswertung
  über die Kostenherkunft hinaus.
- Mehrere gleichzeitige Kostenlimits über den primären `costLimitType` hinaus.
