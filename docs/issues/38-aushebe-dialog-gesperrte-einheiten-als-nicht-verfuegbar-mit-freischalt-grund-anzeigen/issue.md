Status: needs-triage
Type: feature
Blocked by: None

## Description

# PRD: Aushebe-Dialog — gesperrte Einheiten als „nicht verfügbar" mit Freischalt-Grund anzeigen

## Problem Statement / Bug Description

Manche Katalog-Einträge sind nur unter bestimmten Bedingungen legal wählbar —
etwa der **Emperor Fire Dragon**, der eine aktive Listenregel „Allow experimental
rules?" voraussetzt. Solche Tore werden im Katalog über Battlescribe-`conditions`/
`modifiers` ausgedrückt: ein feuernder **`error`-Meldungs-Modifier** und/oder ein
per Bedingung gehobenes `max`.

**Aktuelles Verhalten:** Der Eintrag erscheint im Aushebe-Dialog ganz normal
wählbar. Erst **nachdem** die Einheit hinzugefügt wurde, erzeugt die
nachgelagerte Validierung (`validateRoster`) den Fehler „nicht erlaubt, da
experimentelle Regeln nicht aktiv sind". Der Dialog prüft heute als einzige
Verfügbarkeits-Schranke **genau einen** `max`-Constraint (Scope
`roster`/`force`/`undefined`) und ignoriert dabei: ein zweites `max`,
`parent`/`self`/`category`-scoped Constraints, Prozent-Limits, die
Kategorie-Obergrenze der Force sowie **alle** Autoren-`error`-Meldungen. Dieselbe
Fehlerklasse trifft daher auch andere Fälle (z. B. einen 5. Lord bei „max 4
Lords"), die im Dialog fälschlich wählbar wirken.

**Erwartetes Verhalten:** Ein nicht legal wählbarer Eintrag wird bereits **im
Dialog** als *nicht verfügbar* dargestellt — ausgegraut, nicht klickbar — und
nennt direkt den **Grund/die Freischalt-Bedingung**. Es gilt strikt: *im Dialog
wählbar ⟺ nach dem Aushebe legal.*

## Solution

Der Aushebe-Dialog leitet die Verfügbarkeit **nicht** aus einem eigenen,
nachgebauten Teilprädikat ab (das driftet unweigerlich gegen den Validator — genau
das ist die heutige Ursache), sondern **aus dem echten Validator selbst** (Single
Source of Truth):

- Für jeden Kandidaten wird ein **hypothetisches Hinzufügen** simuliert (der
  Eintrag 1× in die Ziel-Force der Liste gedacht) und `validateRoster` ausgeführt.
- Das Ergebnis wird gegen die **Baseline** (Validierung der Liste *ohne* den
  Kandidaten) **diff't**: nur Verstöße, die der Kandidat **neu einführt**, zählen.
- Von den eingeführten Verstößen sperren nur die **„zu-viel/nicht-erlaubt"-Klassen**
  (`type` endet auf `-max` **oder** `type === 'modifier-error'`). Budget-/
  „zu-wenig"-Zustände (`roster-limit` über Punkte, alle `*-min`,
  `force-selector-min`) sperren **nicht** — sie gehören zum normalen, unfertigen
  Bauzustand und dürfen das Wählen nicht verhindern.
- Sperrt mindestens ein Verstoß, ist der Eintrag *nicht verfügbar*; die
  **Meldungstexte** der eingeführten Verstöße sind der angezeigte Grund. Bei
  Autoren-`error`-Meldungen ist das der **wortgetreue** `value` des Modifiers
  (z. B. `Please enable "Allow experimental rules?"`) — dieselbe Quelle wie im
  bestehenden Validierungs-Panel, keine Übersetzungs-/Parsing-Schicht.

Der bisherige `isMaxedOut`-Sonderpfad im Dialog entfällt; die Verfügbarkeit hat
danach exakt einen Codepfad, der garantiert mit dem Validator übereinstimmt. Der
Ansatz ist vollständig **system-agnostisch** (keine armeespezifische Sonderlogik,
konform ADR-0003).

## User Stories / Requirements

1. Als Listenbauer möchte ich einen nur bedingt erlaubten Eintrag (z. B. Emperor
   Fire Dragon) im Aushebe-Dialog sofort als *nicht verfügbar* erkennen, damit ich
   ihn nicht erst hinzufügen muss, um vom Verbot zu erfahren.
2. Als Listenbauer möchte ich am gesperrten Eintrag den **Grund** bzw. die
   **Freischalt-Bedingung** sehen (z. B. „Please enable ‚Allow experimental
   rules?'"), damit ich weiß, wie ich ihn verfügbar mache.
3. Als Listenbauer möchte ich, dass **jede** legale Wählbarkeit korrekt abgebildet
   ist — nicht nur der eine `max`-Fall —, sodass „im Dialog wählbar" verlässlich
   „nach dem Aushebe legal" bedeutet.
4. Als Listenbauer möchte ich weiterhin Einträge wählen können, die die Liste nur
   temporär über Budget oder unter eine Mindestgröße bringen, damit der normale
   Bauprozess nicht blockiert wird.

## Technical Decisions

- **Affected Modules (Verhaltensbeschreibung, keine Pfadfestlegung):**
  - Der Einheiten-Aushebe-Dialog (die „+"-Auswahlliste, inkl. armeeweiter
    Selektoren — dieselbe Komponente).
  - Die Solver-Schicht als neuer Verfügbarkeits-Seam, der den bestehenden
    Roster-Validator wiederverwendet (Kosten-/Count-/Constraint-/Modifier-/
    Meldungs-Auswertung).
- **Technical Clarifications / Architectural Decisions:**
  - **Verfügbarkeit = Validator-Diff**, nicht Reimplementierung. Der Dialog kennt
    keine eigene Constraint-Logik; er fragt den Validator über ein hypothetisches
    Hinzufügen. (Vorgeschlagener neuer ADR — „UI-Verfügbarkeit leitet sich aus dem
    Validator ab, nie aus einer parallelen Nachbildung"; erfüllt alle drei
    ADR-Kriterien: schwer reversibel als Muster, für spätere Leser überraschend,
    echtes Trade-off Rechenaufwand ↔ SSOT. Anlegen im Zuge der Umsetzung.)
  - **Sperr-Klassen:** eingeführter Verstoß sperrt gdw. `type` auf `-max` endet
    oder `type === 'modifier-error'`. Explizit **nicht** sperrend: `roster-limit`,
    `force-roster-limit`, alle `*-min`, `force-selector-min`.
  - **Nur `error`-Schweregrad** sperrt; `warning`/`info` bleiben wählbar
    (deckungsgleich mit `hasBlockingViolations`).
  - **Stabiler Diff-Schlüssel:** eingeführt-vs-Baseline wird über eine stabile
    Verstoß-Identität verglichen (`type` + `selectionId`/`categoryId`/`forceId`),
    **nicht** über die count-behaftete Meldung — sonst gilt eine bloße
    Count-Änderung fälschlich als „neu eingeführt".
  - **Hypothetischer Kontext** spiegelt exakt das, was `addUnit` täte (synthetische
    Selektion mit `entryLinkId`/`selectionEntryId`, `number: 1`, in die aktive
    Force). Dadurch werden Modifier korrekt ausgewertet, deren Bedingung die eigene
    Präsenz des Eintrags voraussetzt.
  - **Interaktion:** gesperrter Eintrag ausgegraut + Grund, **nicht klickbar**;
    **kein** automatisches Aktivieren der nötigen Listenregel (das bleibt eine
    eigenständige Nutzeraktion über die Listenregel-Checkliste, Issues 34/35).
  - **Performance (ADR-0005):** die Baseline-Validierung wird **einmal pro
    Dialog-Öffnung** berechnet; pro Kandidat läuft nur die hypothetische
    Validierung. Memoisierung an `roster`/Kategorie ist zulässig.
- **API Contracts / Data Models:**
  - Neue reine Solver-Funktion, konzeptuell:
    `getEntryAddAvailability({ entry, categoryId, force, roster, system, baselineErrors }) → { available: boolean, reasons: string[] }`.
  - Kein neues persistiertes Datenmodell; keine Änderung am Roster-/Katalog-Schema.

## Testing Decisions

- **Modules to Test:** der neue Solver-Verfügbarkeits-Seam und die Darstellung im
  Aushebe-Dialog.
- **Test Interfaces (Seams):**
  1. **Solver-Prädikat (reine Funktion), `getEntryAddAvailability`** — gegen
     Katalog-Fixtures nach Muster von `special-characters-hint.cat.xml`
     (analog `rosterValidator.messageModifiers.test.js`). Abzudeckende Fälle:
     - Autoren-`error`-Tor (experimentelle Regel) → nicht verfügbar, Grund =
       wortgetreuer Modifier-`value`; nach „Regel aktiv" → verfügbar.
     - **Kategorie-max** erreicht → nicht verfügbar.
     - **Zweites** `max` bzw. `parent`/`self`/`category`-scoped `max` → nicht
       verfügbar (der heutige Einzel-`max`-Check würde es verfehlen).
     - **Prozent-max** → nicht verfügbar.
     - Über-Budget-Add / Mindestgrößen-Unterschreitung → **verfügbar** (nicht
       gesperrt).
  2. **Komponenten-Test des Aushebe-Dialogs** (jsdom/vitest, analog
     `PlayMode.ruleLinks.test.jsx`) — Eintrag mit eingeführtem Sperr-Verstoß:
     ausgegraut, nicht klickbar, zeigt den wortgetreuen Grund-Text; Eintrag ohne
     Sperr-Verstoß: wählbar.

## Out of Scope

- **Options-/Upgrade-Konfiguratoren** einer bereits ausgehobenen Einheit
  (Stepper/Checkbox-Pfade, z. B. bloodline-gegatete Ausrüstung) — eigener
  Render-Pfad, eigenes Feature.
- **Automatisches Aktivieren** der freischaltenden Listenregel per Klick auf den
  gesperrten Eintrag.
- **Übersetzen/Umschreiben** der Autoren-Meldungstexte ins Deutsche.
- **Gruppen-`min`-Fälle** als Verfügbarkeits-Sperre (eine frisch ausgehobene
  Einheit ist noch unkonfiguriert; `min`-Verstöße betreffen die Konfiguration,
  nicht die Wählbarkeit).
- Änderungen am Validierungs-Panel bzw. an den nachgelagerten Validierungs-
  Meldungen selbst.

## Acceptance Criteria
- [ ] Ein durch aktive experimentelle Regeln gegateter Eintrag (Muster Emperor
      Fire Dragon) erscheint bei inaktiver Regel im Aushebe-Dialog ausgegraut und
      nicht klickbar; bei aktiver Regel ist er normal wählbar.
- [ ] Am gesperrten Eintrag wird der wortgetreue Grund-Text des feuernden
      `error`-Modifiers angezeigt.
- [ ] Verfügbarkeit wird über einen hypothetischen Add + `validateRoster`-Diff
      bestimmt (SSOT); der bisherige `isMaxedOut`-Einzelpfad ist entfernt.
- [ ] Nur eingeführte Verstöße mit `type` auf `-max` oder `modifier-error` sperren;
      `roster-limit`/`*-min`/`force-selector-min` sperren nicht (Regressionstest
      für einen über-Budget-Add, der wählbar bleibt).
- [ ] Ein zweites/`parent`-scoped `max`, ein Prozent-max und eine erreichte
      Kategorie-Obergrenze führen im Dialog zu „nicht verfügbar" (Fälle, die der
      alte Einzel-`max`-Check verfehlte).
- [ ] Solver-Prädikat und Dialog-Darstellung sind durch Tests an den definierten
      Seams abgedeckt.
- [ ] Volle Suite grün; keine Regression in bestehenden Katalogen/Armeen.

## Comments
