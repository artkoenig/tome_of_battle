# E2E-Regeln & Testkatalog: Group-Scope Missing Mandatory
 
 **Rolle:** Black-Box-Test (kein Blick in den App-Quellcode). Regeln aus den Katalogdaten abgeleitet.
 
 - Spielsystem: `Warhammer Fantasy Battle 6th edition.gst` (`6d8e-38d9-3c69-febf`, rev 8)
 - Armee: `Empire.cat` (`5c3d-7f54-5a40-6940`, rev 11) — Force **„Standard"** `7d9d-6c8d-4ea0-b7ad`
 
 ## Wie eine Group-Min-Constraint evaluiert wird
 
 Eine `selectionEntryGroup` bündelt Alternativen für eine Selektion. Im Roster spiegeln sich Auswahlen einer Gruppe als direkte Kind-Elemente (`selection`) unterhalb des Besitzers der Gruppe wider. Hat die Gruppe ein Constraint mit `type="min"`, `field="selections"` und `scope="parent"`, so erfordert dies zwingend Auswahlen von ihren Kindern. Ist die besitzende Selektion im Roster, es werden aber 0 Kinder gewählt, muss die Constraint der Gruppe feuern.
 
 Struktur:
 ```
 selectionEntry "Wizard Lord" (6c9d-1b2b-80ea-92cd)
   └ selectionEntryGroup "Magic Level" (049a-bf34-5824-3df7)   min 1, max 1 (scope=parent)
        ├ "Level 3" (e237-8ffb-5cb1-601b)
        └ "Level 4" (6ae4-b6f5-fb90-7995)
 ```
 
 ---
 
 ## Abgeleitete Regeln (mit Beleg aus den Katalogdaten)
 
 | ID | Regel | Beleg (Datei / Element) |
 |----|-------|--------------------------|
 | **GRP-R1** | Eine Wizard-Lord-Selektion muss **mindestens eine** Auswahl aus der Gruppe „Magic Level" enthalten. | `selectionEntryGroup "Magic Level"` `049a…` → constraint **`02cd-cabf-7e25-2b09`** `type=min value=1 field=selections scope=parent`. |
 
 ---
 
 ## Testkatalog (E2E-Szenarien der neuen Engine)
 
 Fertige Roster als Engine-Eingabe unter [`rosters/`](rosters/). Alle referenzieren `.gst` + Empire-`.cat`.
 
 | # | Testtitel | Betroffene Katalogdateien | Roster-Zustand | Erwartetes Ergebnis des Evaluators | Fixture |
 |---|-----------|---------------------------|----------------|------------------------------------|---------|
 | 01 | Wizard Lord mit Pflichtauswahl (legal) | `.gst` + Empire-`.cat` | „Wizard Lord" mit **einer** Level-Auswahl („Level 3"). | **Keine** Verletzung: Pflicht (≥1) erfüllt. | [`01-wizard-lord-legal.ros`](rosters/01-wizard-lord-legal.ros) |
 | 02 | Wizard Lord ohne Pflichtauswahl (unzulässig) | wie 01 | Nur ein „Wizard Lord", **keine** Level-Auswahl darunter. | **Verletzung von GRP-R1:** die parent-skopierte Pflicht `02cd…` (min 1) ist unerfüllt (Ist 0, bound 1). | [`02-wizard-lord-missing-level.ros`](rosters/02-wizard-lord-missing-level.ros) |
 
 ### Verifizierte Bausteine (aus den Katalogdaten)
 
 | Element | ID |
 |---------|-----|
 | Force „Standard" (Empire) | `7d9d-6c8d-4ea0-b7ad` |
 | Wizard Lord | `6c9d-1b2b-80ea-92cd` |
 | Gruppe „Magic Level" (min 1, max 1) | `049a-bf34-5824-3df7` — constraint min: `02cd-cabf-7e25-2b09` |
 | Level 3 | `e237-8ffb-5cb1-601b` |
