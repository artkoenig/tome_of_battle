Status: claimed
Type: feature
Blocked by: None

## Description

### Ziel
Wenn eine gewählte Option ihrerseits verschachtelte Unter-Optionen freischaltet,
sollen diese Unter-Optionen im Editor **optisch eingerückt direkt unter der Zeile
ihres Eltern-Elements** erscheinen — **allgemeingültig** für jede solche
Verschachtelung, nicht als Spezialfall für Mount/Barding.

### Ausgangslage (verifiziert, read-only)
Das Datenmodell verschachtelt eine Unter-Option bereits korrekt unter ihrer
Eltern-Auswahl (Issue 57/04, `ownerSelectionId`). Die **Anzeige** ist davon
entkoppelt und rein flach:

- `getUnitOptions` (`optionsCollector.js`) liefert eine **flache** Optionsliste.
  Eine aus einer aktiven Auswahl re-emittierte Unter-Option trägt
  `ownerSelectionId` = die Roster-Auswahl-Id ihres unmittelbaren Eltern-Elements
  sowie `groupName`/`groupId` = Name/Def-Id des Eltern-Elements.
- `SelectionConfigurator` gruppiert diese flache Liste nur nach Gruppen-Id in
  eine **flache** Abschnittsliste. Eine re-emittierte Unter-Option wird dadurch
  zu einem **eigenen Top-Level-Abschnitt** (Überschrift = Name des Eltern-
  Elements), der als Geschwister **neben** dem Abschnitt des Eltern-Elements
  liegt statt eingerückt darunter.

Sichtbarer Effekt am gemeldeten Beispiel (Empire-Captain): „Empire Warhorse"
steht im Abschnitt „Mounts"; „Barding" erscheint als separater Abschnitt
„Empire Warhorse" auf **gleicher Ebene** daneben, obwohl es im Modell unter der
Mount hängt.

### Gewünschtes Verhalten
Die vorhandene `ownerSelectionId`-Verknüpfung soll auch die **Darstellung**
steuern: Der Block der Unter-Optionen wird **eingerückt unmittelbar unter der
Zeile des Eltern-Elements** gerendert, dessen Roster-Auswahl-Id gleich der
`ownerSelectionId` der Unter-Optionen ist.

Anforderungen:
- **Allgemeingültig**: gilt für jedes Eltern-Element mit re-emittierten Unter-
  Optionen — egal ob das Eltern-Element eine gruppierte Option (z. B. Mount in
  „Mounts") oder eine freistehende Option ist; kein Mount-/Barding-Sonderweg.
- **Beliebige Tiefe**: verschachtelt sich eine Unter-Option weiter, wird
  entsprechend tiefer eingerückt (der Collector re-emittiert rekursiv, jede Ebene
  trägt die `ownerSelectionId` ihres unmittelbaren Elternteils).
- **Einrückung ist rein visuell**: Auswahl-/Zähl-/Kosten-/Sperr-Logik,
  `ownerSelectionId`-basierte Mutationsziele und die Eindeutigkeits-Behandlung
  bleiben unverändert (nur die Platzierung/Optik ändert sich).
- Erscheint das Eltern-Element abgewählt, verschwinden seine Unter-Optionen wie
  bisher (die aktive Auswahl treibt die Re-Emission).

### Abgrenzung
Eigenständige Sub-Modelle/Sub-Einheiten (`isIndependentSubUnit`) bekommen weiter
ihre eigene `UnitSelectionCard` und werden von der Re-Emission bewusst
übersprungen — deren Darstellung bleibt unberührt.

Bearbeitung laut Nutzer-Entscheidung im **selben Branch/PR (#112)** wie Issue 57
(bewusste Abweichung von der 1-Issue-1-PR-Regel), da direkte optische Ergänzung
zum Datenmodell-Fix aus 57/04.

## Acceptance Criteria
- [ ] Am realen Nutzerpfad reproduziert: gruppierte Upgrade-Mount wählen → die
      freigeschaltete Unter-Option (Barding) erscheint **eingerückt direkt unter
      der Mount-Zeile**, nicht als separater Abschnitt auf gleicher Ebene.
- [ ] Die Einrückung ist allgemeingültig aus der `ownerSelectionId`-Zugehörigkeit
      abgeleitet — kein Bezug auf konkrete Mount-/Barding-Ids im Code.
- [ ] Mehrstufige Verschachtelung wird korrekt gestaffelt eingerückt dargestellt.
- [ ] Keine Verhaltens-Regression: Auswählen/Abwählen, Zähler, Kosten,
      „bereits vergeben"-Sperren und die Mutationsziele (`ownerSelectionId`)
      funktionieren unverändert.
- [ ] Keine Regression für echte Sub-Modelle (eigene Karte) und für Optionen
      ohne Unter-Optionen (unveränderte flache Darstellung).
- [ ] Komponententest deckt ab: gewähltes Eltern-Element mit re-emittierter
      Unter-Option → Unter-Option wird als eingerücktes Kind der Eltern-Zeile
      gerendert (nicht als Top-Level-Abschnitt).
- [ ] Screenshot der betroffenen Editor-Ansicht (Captain mit gewählter Mount +
      Barding) belegt die Einrückung.
- [ ] `npm test`, Lint und Typecheck grün.

## Comments
