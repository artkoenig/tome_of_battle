Status: resolved
Type: feature
Blocked by: None

## Description

Solver-seitige Slice des Vorhabens „Ursachen bei Validierungsmeldungen anzeigen"
(PRD im Main-Issue, ADR 0027, Glossar „Ursache" in CONTEXT.md). Diese Slice
erzeugt die Ursachen-Daten und hängt sie sprachfrei an das Fehlerobjekt — ohne
UI.

**Verhalten:**

- Die Constraint-Auswertung liefert neben dem Endwert die **aktiv beitragenden
  bedingten Modifier** — die gefilterte Zwischenliste, die heute in
  `getModifiedConstraintValue` sofort per `.reduce()` zur nackten Zahl verdichtet
  wird. Der bestehende Wert-Pfad bleibt unverändert (additiv, keine
  Verhaltensänderung am Zahl-Ergebnis).
- Eine reine Funktion löst die Bedingung(en) eines beitragenden Modifiers auf die
  **auslösende(n) Auswahl(en)** auf (Katalog-ID → Name über die vorhandene
  Auflösung), oder meldet **„nicht auflösbar"**, wenn die Bedingung nicht auf eine
  benennbare, wählbare Auswahl zeigt (Vergleich, Kategorie-/Mengenbezug).
- Der Roster-Validator hängt an einen Verstoß, dessen verletzter Grenzwert
  **bedingt** verändert wurde, die aufgelösten Ursachen als optionales Feld. Nur
  bedingte, aktiv beitragende Modifier zählen — reine Basiswerte und unbedingte
  Modifier erzeugen keine Ursache.
- Die Auslösebedingung ist generisch „Wert wurde durch bedingten Modifier
  verändert", **nicht** an `max`/`min` gebunden (ADR 0003: kein katalog-/
  regelspezifisches Hardcoding). In der Praxis trifft das fast nur Obergrenzen.
- Nur mechanische App-Meldungen (mit `messageKey`) bekommen das Feld;
  Autor-Meldungen (`modifier-error/-warning/-info`) bleiben unangetastet.
- Der `ValidationError`-Vertrag (`types.js`) wird um ein **optionales**
  Ursachen-Feld erweitert; fehlt es, verhält sich alles wie bisher
  (abwärtskompatibel). Genaues Schema gemäß ADR 0027.

**Seams / Tests (framework-frei):**

- Reine Funktion: `constraint + modifiers + ctx` → Endwert **und** beitragende
  bedingte Modifier.
- Reine Funktion: Modifier-Bedingung → benennbare Auswahl(en) | „nicht auflösbar".
- Validator-Ausgabe: Ursachen am richtigen Verstoß, nur bei bedingter
  Modifikation; Basiswert/unbedingt → keine Ursache; ganze Kette bei mehreren.

**Out of Scope (dieser Slice):** jegliche Anzeige/Formatierung/i18n (Slice 02),
Autor-Meldungen, Basiswert-Fälle.

## Acceptance Criteria
- [ ] Die Constraint-Auswertung stellt die aktiv beitragenden bedingten Modifier
      bereit, ohne das bestehende Zahl-Ergebnis zu verändern.
- [ ] Eine reine Funktion löst eine Modifier-Bedingung auf benennbare auslösende
      Auswahl(en) auf oder meldet „nicht auflösbar".
- [ ] Ein Verstoß mit bedingt verändertem Grenzwert trägt die aufgelösten
      Ursachen als optionales, sprachfreies Feld; mehrere beitragende Modifier →
      mehrere Ursachen (ganze Kette).
- [ ] Reine Basiswerte und unbedingte Modifier erzeugen keine Ursache;
      Autor-Meldungen bleiben ohne Feld.
- [ ] Herleitung ist generisch (kein max/min- oder Katalog-Hardcoding, ADR 0003);
      Solver bleibt sprachfrei (ADR 0026/0027).
- [ ] `ValidationError`-Vertrag (`types.js`) abwärtskompatibel um das optionale
      Feld erweitert; bestehende Meldungen/Tests unverändert grün.
- [ ] Unit-Tests an den drei Seams grün; volle Suite grün.

## Comments
</content>
- Solver-seitige Ursachen-Herleitung (ADR 0027): evaluateConstraint liefert neben dem Endwert die aktiv beitragenden bedingten Modifier (getModifiedConstraintValue delegiert, Zahl-Pfad unverändert); resolveConditionTrigger löst eine Modifier-Bedingung auf die benennbare auslösende Auswahl auf oder meldet nicht auflösbar; evaluateConstraintWithCauses bündelt beides. Der Roster-Validator hängt die aufgelösten Ursachen als optionales, sprachfreies Feld causes an mechanische App-Verstöße (nur bei bedingter Veränderung, ganze Kette, dedupliziert); ValidationError um optionales causes-Feld erweitert (abwärtskompatibel).
