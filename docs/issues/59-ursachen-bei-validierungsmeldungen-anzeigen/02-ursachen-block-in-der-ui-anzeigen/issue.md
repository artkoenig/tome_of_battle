Status: resolved
Type: feature
Blocked by: [01]

## Description

Anzeige-Slice des Vorhabens „Ursachen bei Validierungsmeldungen anzeigen" (PRD im
Main-Issue, ADR 0027). Baut auf dem in Slice 01 erzeugten optionalen
Ursachen-Feld am `ValidationError` auf und macht es sichtbar.

**Verhalten:**

- Trägt eine Meldung Ursachen, rendert die Oberfläche unter der bestehenden
  Meldung einen **„Ursachen:"-Block** mit den auslösenden Auswahlen als
  Listenpunkte (Katalognamen in Anführungszeichen, Pass-through/unübersetzt,
  ADR 0003):

  ```
  „Long Bow" kann nicht gewählt werden.
  Ursachen:
   • „Battle Standard Bearer"
   • …
  ```

- Trägt eine Meldung **keine** Ursachen (nicht auflösbar, Basiswert,
  Autor-Meldung), erscheint **kein** Block — die Meldung bleibt wie heute.
- Der Block wird an **beiden** Renderstellen dieser mechanischen Meldungen gleich
  gezeigt: Validierungs-Panel (Seitenleiste) und Aushebe-Dialog. Die Ursache
  hängt am Fehlerobjekt — ein Renderweg, eine Wahrheit (SSOT, ADR 0022).
- Neue `validation.*`-Vorlage(n) für Überschrift/Aufbau des Blocks in
  `src/i18n/locales/de.json` **und** `en.json`; Locale-Parität grün. Das
  Satzgerüst ist frei je Sprache, die eingebetteten Katalognamen bleiben
  Pass-through.

**Seams / Tests:**

- `formatValidationError` je Sprache: Fehlerobjekt mit Ursachen → Meldung **plus**
  Ursachen-Liste; ohne Ursachen → nur Meldung; Katalognamen unverändert.
- UI-/E2E-Rendering beider Renderstellen über `ui.test.js` bzw. Component-Tests.

**Out of Scope (dieser Slice):** die Solver-seitige Herleitung/der Vertrag
(Slice 01), Autor-Meldungen, Handlungshinweise.

## Acceptance Criteria
- [ ] Eine Meldung mit Ursachen zeigt unter dem Meldungstext einen „Ursachen:"-
      Block mit den auslösenden Katalognamen als Listenpunkte; der Screenshot-Fall
      listet „Battle Standard Bearer".
- [ ] Mehrere Ursachen → mehrere Listenpunkte (ganze Kette).
- [ ] Ohne Ursachen erscheint kein Block; die Meldung bleibt unverändert.
- [ ] Der Block erscheint an beiden Renderstellen gleich (Validierungs-Panel und
      Aushebe-Dialog).
- [ ] Neue i18n-Vorlagen in `de.json` und `en.json`; Locale-Parität grün;
      Katalognamen als Pass-through unverändert.
- [ ] `formatValidationError`-Tests je Sprache grün; UI-/E2E-Test für den Block;
      volle Suite grün.
- [ ] Nach der Änderung Screenshot der betroffenen Ansicht an den Nutzer senden.

## Comments
- UI-Anzeige des Ursachen-Blocks umgesetzt: neue i18n-Vorlagen validation.causesTitle/causeItem (de+en), reine Seam-Funktion formatValidationCauses und die geteilte Praesentationskomponente ValidationCauses (SSOT). Eingebunden an beiden Renderstellen (RosterValidationPanel, CategoryUnitAdder). Tests: formatValidationCauses je Sprache, ValidationCauses-Component, plus Block-Abdeckung an beiden Renderstellen. Volle Suite gruen.
