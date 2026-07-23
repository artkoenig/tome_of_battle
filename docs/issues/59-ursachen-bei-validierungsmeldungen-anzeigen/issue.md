Status: claimed
Type: feature
Blocked by: None

## Description

# PRD: Ursachen bei Validierungsmeldungen anzeigen

## Problem Statement / Bug Description

Mechanische Validierungsmeldungen sagen heute nur *dass* etwas nicht stimmt,
nicht *warum*. Beispiel aus der App: `„Long Bow" kann nicht gewählt werden.`
(Schlüssel `validation.entryMax_zero`, weil das Max-Limit dieses Eintrags 0 ist).

Der Nutzer sieht nicht, wodurch die Sperre entsteht. Im auslösenden Screenshot
ist bei einem Commander „Battle Standard Bearer" angehakt, und dadurch steht die
Waffen-Gruppe auf Max 0 — die Ursache ist also eine *andere* Auswahl, die per
bedingtem Modifier das Limit verändert hat. Diese Information liegt zum
Prüfzeitpunkt technisch vor, wird aber verworfen: `getModifiedConstraintValue`
verdichtet die aktiv greifenden Modifier sofort per `.reduce()` zur nackten Zahl,
sodass am erzeugten Verstoß nur noch Ist-Wert und Grenzwert ankommen.

## Solution

Eine Validierungsmeldung, deren verletzter Grenzwert nachweislich durch einen
**bedingten** Modifier verändert wurde, bekommt zusätzlich eine **Ursachen-Liste**:
die aktuell aktiven, den Wert verändernden bedingten Modifier, jeweils aufgelöst
auf die **auslösende Auswahl** (Katalogname). Angezeigt wird unter der
bestehenden Meldung ein Block:

```
„Long Bow" kann nicht gewählt werden.
Ursachen:
 • „Battle Standard Bearer"
 • …
```

Kernprinzipien:

- **Ursache = bedingter Modifier, der den Wert verändert hat.** Nur Modifier mit
  erfüllter Bedingung, die den Wert tatsächlich verändern, zählen. Unbedingte
  Modifier und reine Basiswerte sind keine Ursache — sie sind Teil der Grundregel,
  kein „weil du X getan hast".
- **Ganze Kette.** Wirken mehrere bedingte Modifier zusammen, werden alle
  beitragenden als eigene Listenpunkte gezeigt (meist genau einer).
- **An den Fehlertyp nicht gebunden.** Die Logik knüpft generisch an „Wert wurde
  bedingt modifiziert" an, nicht an `max`/`min` (ADR 0003: keine
  katalogspezifische Sonderlogik). In der Praxis trifft das fast nur Obergrenzen.
- **Nur benennbare Ursachen.** Zeigt die Bedingung auf eine auflösbare, wählbare
  Auswahl, erscheint deren Katalogname in Anführungszeichen. Ist keine Ursache
  sauber auflösbar (komplexer Vergleich, Bezug auf Kategorie/Menge statt auf eine
  benennbare Auswahl), entfällt der „Ursachen"-Block ganz — die Meldung bleibt
  wie heute. Lieber nichts als etwas Kryptisches.
- **Nur App-Meldungen.** Autor-Meldungen (`modifier-error/-warning/-info`) tragen
  ihre Ursache schon als Freitext und bleiben unangetastet.
- **Katalognamen** sind unveränderter Pass-through (ADR 0003).

Der neue „Ursachen"-Block wird an beiden Renderstellen dieser Meldungen gleich
angezeigt: im Validierungs-Panel (Seitenleiste) und im Aushebe-Dialog. Die
Ursache hängt am Fehlerobjekt selbst — ein Renderer, eine Wahrheit (SSOT).

## User Stories / Requirements

1. Als Listenbauer möchte ich bei einer gesperrten Auswahl sehen, **welche andere
   Auswahl** die Sperre auslöst, damit ich verstehe, was ich ändern müsste — ohne
   die internen Regeln zu kennen.
2. Als Listenbauer möchte ich, dass **alle** beteiligten Auslöser genannt werden,
   wenn mehrere zusammenwirken, damit die Erklärung ehrlich und vollständig ist.
3. Als Listenbauer möchte ich, dass keine halbgare/kryptische Ursache erscheint,
   wenn sie nicht sauber benennbar ist — dann lieber gar keine.
4. Als Maintainer möchte ich, dass die Ursachen-Herleitung generisch aus
   Constraint/Modifier/Condition-Daten kommt (kein Hardcoding pro Katalog) und in
   DE wie EN denselben Ton trägt.

## Technical Decisions

- **Affected Modules (Verhalten, nicht Pfade):**
  - Constraint-Auswertung: liefert zusätzlich zum Endwert die **aktiv
    beitragenden bedingten Modifier** (die Zwischenliste vor dem heutigen
    `.reduce()`), ohne das bestehende Wert-Ergebnis zu ändern.
  - Ursachen-Auflösung: eine bedingte Modifier-Bedingung → benennbare auslösende
    Auswahl(en) oder „nicht auflösbar".
  - Roster-Validator: hängt an einen Verstoß, dessen Wert bedingt modifiziert
    wurde, die aufgelösten Ursachen an.
  - `ValidationError`-Vertrag: optionales Ursachen-Feld (siehe ADR 0027).
  - Anzeige: `formatValidationError` und die beiden Renderstellen
    (Validierungs-Panel, Aushebe-Dialog) rendern den „Ursachen"-Block.
  - i18n: neue `validation.*`-Vorlage(n) für Überschrift/Aufbau des Blocks in
    `de.json` und `en.json` (Parität), Katalognamen als Pass-through.
- **Architectural Decisions:**
  - **ADR 0027** (neu): Validierungs-Ursachen als optionales, sprachfreies Feld
    am `ValidationError` — schreibt ADR 0026 (strukturierte, sprachfreie Fehler)
    fort. Die Herleitung bleibt im Solver, der sprachfrei bleibt; benannt werden
    Auswahlen über ihre Katalog-IDs → Namen, nicht übersetzt.
  - ADR 0003 (keine katalogspezifische Logik) und ADR 0022 (App- vs.
    Autor-Meldung, UI leitet sich aus Validator ab) bleiben bindend.
- **API Contracts / Data Models:** `ValidationError` erhält ein optionales Feld
  für die Ursachen (Liste benennbarer auslösender Auswahlen). Fehlt es, verhält
  sich alles wie bisher (abwärtskompatibel). Genaues Schema in ADR 0027.

## Testing Decisions

- **Modules to Test:** Constraint-Auswertung (beitragende Modifier korrekt
  ermittelt), Ursachen-Auflösung (ID → Name; „nicht auflösbar" sauber),
  Roster-Validator (Ursachen am richtigen Verstoß, nur bei bedingter
  Modifikation), `formatValidationError` (Block-Rendering je Sprache,
  Katalognamen unverändert), UI (Panel + Aushebe-Dialog zeigen den Block).
- **Test Interfaces (Seams):**
  1. Reine Funktion in der Constraint-Auswertung: `constraint + modifiers + ctx`
     → Endwert **und** beitragende bedingte Modifier (Daten → Daten).
  2. Reine Funktion: Modifier-Bedingung → benennbare Auswahl(en) | „nicht
     auflösbar".
  3. `formatValidationError` je Sprache: Fehlerobjekt mit Ursachen → Meldung +
     Ursachen-Liste.
  4. UI-/E2E-Rendering über `ui.test.js` bzw. Component-Tests der beiden
     Renderstellen.

## Out of Scope

- Ursachen für reine **Basiswerte** ohne bedingten Modifier (keine benennbare
  „weil du X getan hast"-Ursache).
- Autor-Meldungen (`modifier-error/-warning/-info`) — bleiben unverändert.
- Prosa-Nachbau des kompletten Regelwerks („setzt Max auf 0, weil …") — es wird
  nur *welche Auswahl* die Sperre auslöst genannt, nicht die Mechanik erklärt.
- Auflösung komplexer, nicht auf eine benennbare Auswahl zeigender Bedingungen
  (Vergleiche, Kategorie-/Mengenbezug) — dann kein Block.
- Handlungshinweise / automatische Korrektur.
- Änderung an Menge/Wahrheit der Verstöße oder am bestehenden Wortlaut der
  Meldungen selbst.
- Weitere Sprachen über DE/EN hinaus.

## Acceptance Criteria
- [ ] Eine Meldung, deren verletzter Grenzwert durch einen bedingten Modifier
      verändert wurde, zeigt einen „Ursachen"-Block mit den auslösenden Auswahlen
      (Katalognamen in Anführungszeichen); der Screenshot-Fall listet „Battle
      Standard Bearer".
- [ ] Wirken mehrere bedingte Modifier zusammen, erscheinen alle als eigene
      Listenpunkte (ganze Kette).
- [ ] Ist keine Ursache sauber auflösbar, entfällt der Block; die Meldung bleibt
      unverändert wie heute.
- [ ] Reine Basiswerte und unbedingte Modifier erzeugen keinen Block.
- [ ] Autor-Meldungen (`modifier-*`) bleiben unangetastet.
- [ ] Die Herleitung ist generisch (kein Hardcoding pro Katalog, ADR 0003); die
      Solver-Schicht bleibt sprachfrei (ADR 0026/0027).
- [ ] Der Block erscheint an beiden Renderstellen gleich (Validierungs-Panel und
      Aushebe-Dialog).
- [ ] Neue i18n-Vorlagen in `de.json` und `en.json`; Locale-Parität grün.
- [ ] `ValidationError`-Vertrag um optionales Ursachen-Feld erweitert
      (abwärtskompatibel); ADR 0027 angelegt und CONTEXT.md-Glossar nachgezogen.
- [ ] Volle Test-Suite grün.

## Comments
</content>
</invoke>
