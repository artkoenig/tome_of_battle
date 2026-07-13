# 0011: Roster als Referenz-Modell, abgeleitete Kosten & Serialisierungs-Adapter

- **Status:** Accepted
- **Datum:** 2026-07-13
- **Beteiligte:** Entwickler, KI-Assistenten
- **Zugehörige ADRs:** 0002 (Data Flow & IndexedDB), 0003 (Battlescribe Domain Rules)

## Kontext und Problemstellung

Beim Export/Import im BattleScribe-`.ros`-Format traten zwei Bugs auf (Kosten
mehrmodelliger Einheiten kollabierten beim Export; importierte Optionen wurden im
Editor nicht als gewählt erkannt). Die Analyse zeigte, dass die Ursachen kein
Zufall waren, sondern aus **Impedanz-Unterschieden** zwischen unserem internen
Roster-Modell und dem `.ros`-Format stammen. Damit stellte sich die
Grundsatzfrage: Sollte unser internes Format dem `.ros`-Format angeglichen werden?

Die vier bekannten Divergenzen:

1. **Options-Identität:** Intern referenzieren Auswahlen ihre Option über die
   **Link-ID** (`entryLinkId`); `.ros` nutzt die **Ziel-ID** als `::`-Pfad
   (`entryId`).
2. **Kosten:** Intern pro Stück gespeichert und ohnehin aus dem Katalog
   nachgezogen; `.ros` bettet pro Auswahl den **Gesamtwert** ein.
3. **Kriegsmaschinen:** Intern werden `number=N`-Kriegsmaschinen in N
   Einzel-Einheiten gesplittet; `.ros` hält `number=N` in einer Auswahl.
4. **`type`-Feld:** Intern nicht gespeichert; `.ros` trägt `unit`/`model`/`upgrade`.

## Entscheidungsfaktoren (Drivers)

- **Single Source of Truth:** Abgeleitete Daten sollen nicht doppelt und
  potenziell inkonsistent gehalten werden.
- **Robustheit/Wartbarkeit:** Bug-Klassen strukturell ausschließen statt einzeln
  patchen.
- **Portabilität:** Erzeugte `.ros`-Dateien müssen in BattleScribe/New Recruit
  korrekt und mit exakten Punktekosten geöffnet werden können.
- **Editor-UX:** Unabhängige Kriegsmaschinen mit je eigener Crew/Ausrüstung.

## Entscheidungsergebnis

Das interne Roster bleibt ein **schlankes Referenz-Modell**; die `.ros`-Datei ist
ein **denormalisierter, portabler Snapshot**. Beide Zwecke bleiben getrennt, und
die Serialisierung ist ein **sauberer, verlustfreier Adapter** zwischen ihnen —
statt das interne Modell feldweise an `.ros` anzugleichen.

Konkret:

### 1. Katalog ist SSOT für abgeleitete Daten — Kosten werden nicht gespeichert
Das Roster speichert nur die Entscheidungen des Nutzers (welche Option, wie oft).
**Kosten werden nicht mehr im Roster gehalten**, sondern überall (Editor-Anzeige
wie Export) zur Laufzeit modifier-bewusst aus dem Katalog berechnet
(`calculateRosterCosts` und eine Pro-Auswahl-Variante). Das schließt die gesamte
Kosten-Round-Trip-Bugklasse strukturell aus.

- **`name` bleibt** dagegen im Roster erhalten — rein deskriptiv, für die
  Listen-Anzeige ohne Katalog-Auflösung und als Resilienz, falls das Spielsystem
  fehlt (`MissingSystemError`). Kosten veralten/verrechnen sich, ein Name nicht.
- **Migration:** nicht destruktiv. Sobald der Solver Basiskosten aus dem Katalog
  liest, wird ein evtl. noch vorhandenes `costs`-Feld in gespeicherten Rostern
  ignoriert und beim nächsten Speichern lazy weggelassen.

### 2. Options-Identität ist eine Modell-Invariante (Link-ID)
Roster-Auswahlen referenzieren Optionen **immer über die Katalog-Link-ID** (bei
direkten Einträgen deren Entry-ID). Der Import ist ein **Anti-Corruption-Layer**:
er normalisiert die `.ros`-Ziel-IDs/`::`-Pfade auf die Link-ID
(`reconcileImportedSelectionIds`, über denselben Options-Collector, den der Editor
nutzt). Damit gilt im gesamten übrigen Code eine einzige, einfache Konvention.

> Hinweis: Für `scope="parent"`-Constraints werden weiterhin aufgelöste **Ziel-IDs**
> verglichen (ADR-0003 §4) — das ist die Constraint-Semantik und steht nicht im
> Widerspruch zur Link-ID-Identität der Auswahl selbst.

### 3. Kriegsmaschinen-Split ist eine bewusste Import-Transformation
Der Split (`number=N` → N Einheiten) bleibt eine **Import-Transformation** im
Dienst der Editor-UX. Der Export serialisiert die gesplitteten Einheiten als N
getrennte, `.ros`-legale Auswahlen. Es gibt **kein Re-Merge**. Der Round-Trip ist
damit **semantisch** (gleiche berechnete Kosten/Validierung), nicht strukturell
identisch.

### 4. Denormalisierte `.ros`-Felder werden beim Export abgeleitet
Felder, die `.ros` einbettet, wir aber nicht speichern (`type`, Kosten-Gesamtwerte,
`costLimits`), leitet der Export aus dem Katalog bzw. der Berechnung ab.

## Konsequenzen (Auswirkungen)

- **Positiv:**
  - Kosten-Inkonsistenzen (Round-Trip wie modifizierte Optionen) sind strukturell
    ausgeschlossen — es gibt nur noch eine autoritative Kostenquelle.
  - Der übrige Code hat eine einzige Options-Identitäts-Konvention.
  - Erzeugte `.ros`-Dateien sind für externe Tools korrekt (exakte Punkte, `type`).
- **Negativ / Trade-offs:**
  - `calculateRosterCosts`/`rosterCounter` und die Kostenanzeige müssen Basiskosten
    aus dem Katalog beziehen (Umbau, aber keine armeespezifische Logik).
  - Der Export benötigt zwingend das Spielsystem (bereits Voraussetzung).
  - Kein struktureller Round-Trip für Kriegsmaschinen (bewusst akzeptiert).
