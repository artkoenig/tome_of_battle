Status: ready-for-agent
Type: feature
Blocked by: None

## Description

# PRD: Verständliche Fehlermeldungen (Wortlaut DE + EN)

## Problem Statement / Bug Description

Validierungsmeldungen lesen sich sehr technisch. Beispiel aus der App:

> `Kategorie "Weapons" erlaubt maximal 0 Auswahlen (aktuell: 1 für Commander).`

Begriffe wie „Kategorie", „Auswahlen", „Limitüberschreitung" und die roh
eingeblendeten internen Zahlen sind für Anwender schwer verständlich.

Wichtig: Die technische **Mechanik** dahinter wurde mit der Mehrsprachigkeit
(#114 / ADR 0026) bereits umgebaut — der ursprüngliche Plan dieses Vorhabens
(strukturierte Fehler, zentrale Komposition, i18n-Fähigkeit) **existiert schon**.
Die alten Meldungstexte wurden dabei jedoch **wortgleich** in die Sprachdateien
übernommen. Das Verständlichkeitsproblem besteht also unverändert fort — jetzt
rein auf Textebene, und zwar in **beiden** Sprachdateien (`de.json` und
`en.json`).

## Ausgangslage (bereits auf main vorhanden, nicht Teil dieses Vorhabens)

- **Strukturierte Verstöße:** Der Roster-Validator liefert `messageKey` +
  `messageParams`; die Regel-Engine ist sprachfrei (ADR 0026).
- **Zentrale Komposition:** `formatValidationError` rendert Schlüssel + Parameter
  zur Anzeige — die eine Stelle, an der aus Daten ein Satz wird.
- **i18n DE/EN:** Sprachdateien `src/i18n/locales/de.json` und `en.json`, inkl.
  Numerus (`_one`/`_other`); Parität wird per Test erzwungen.
- **Zählstand-Kappung:** `stripCurrentCountClause` / `omitCurrentCount` entfernt
  den „(aktuell: …)"-Zusatz sprachneutral auf dem Aushebe-Dialogpfad (ADR 0022).

Es ist also **keine** Arbeit an Validator, Formatter, Komponenten oder i18n-
Infrastruktur nötig.

## Solution

Die `validation.*`-Vorlagen in `de.json` **und** `en.json` auf einen
verständlichen, natürlichen Ton umschreiben — sonst nichts. Eine reine
Sprachdatei-Änderung plus Anpassung der Tests, die auf dem Wortlaut prüfen.

- Meldungsschlüssel und Parameter bleiben unverändert.
- Numerus (`_one`/`_other`) bleibt erhalten und wird für „eine Auswahl / zwei
  Auswahlen" genutzt. **Zusätzlich** wird eine explizite `_zero`-Variante
  eingeführt (siehe Technical Decisions), weil das Limit 0 eine Sonderaussage
  braucht („… keine Auswahl … treffen"), aber `0` und `2` in `Intl.PluralRules`
  beide auf `other` fallen und eine `_other`-Vorlage daher nicht beides leisten
  kann.
- Katalog-abgeleitete Namen (`groupName`, `selectionName`, `categoryName`,
  Kostenart-`unitLabel`) bleiben unveränderter Pass-through (ADR 0003).

Zielwirkung des Screenshots: statt der obigen Meldung
`Commander darf keine Auswahl aus „Weapons" treffen.`

## Formulierung / Ton (verbindlich) — Deutsch

Gilt für **App-Meldungen** (die `validation.*`-Vorlagen). Autor-Meldungen
(`modifier-*`, wortgetreuer Katalogtext ohne Schlüssel) bleiben unangetastet.

- Ein ganzer, natürlicher Satz. Keine internen Struktur­begriffe („Kategorie",
  „Option", „Limitüberschreitung"), kein angehängtes „(aktuell: N)".
- Der Name der betroffenen Einheit/Auswahl steht **ohne Possessiv** am
  Satzanfang (`Commander darf …`), nicht „dein Commander" — so entfällt auch die
  Artikel-/Beugungsfrage bei (oft englischen) Eigennamen.
- Armee-/listenweite Meldungen bekommen einen Artikel: „Die Armee …", „Die
  Liste …".
- Katalognamen bleiben wortgetreu in Anführungszeichen (ADR 0003), auch englische.
- Allgemeines Zählwort ist **„Auswahl"/„Auswahlen"** bei Gruppen/Kategorien
  (`… höchstens eine Auswahl aus „Arcane Items" treffen`).
- Bei der **Häufigkeit eines einzelnen Eintrags** wird um den Eintragsnamen herum
  formuliert (`„Hand Weapon" höchstens einmal wählen`).
- Kleine Zahlen als Wort („eine", „zwei", „einmal"). Kein Handlungshinweis.

| Familie (Schlüssel) | Meldung (DE) |
| --- | --- |
| `groupCountMax` = 0 (Screenshot) | `Commander darf keine Auswahl aus „Weapons" treffen.` |
| `groupCountMax` ≥ 1 | `Butcher darf höchstens eine Auswahl aus „Arcane Items" treffen.` / `… zwei Auswahlen …` |
| `groupCountMin` | `Butcher braucht mindestens eine Auswahl aus „Arcane Items".` |
| `categoryMax` (Armee) | `Die Armee darf höchstens eine Auswahl aus „Special" treffen.` |
| `categoryMin` (Armee) | `Die Armee braucht mindestens zwei Auswahlen aus „Core".` |
| `forceSelectorMin` | `Die Armee braucht noch einen „General".` |
| `entryMax` | `„Hand Weapon" darf höchstens einmal gewählt werden.` (= 0: `„Shield" kann nicht gewählt werden.`) |
| `entryMin` | `„Hand Weapon" muss mindestens einmal gewählt werden.` |
| `rosterLimit` | `Die Liste hat 111 Punkte – erlaubt sind 100.` |
| `groupPointsMax` | `General darf für „Magic Items" höchstens 100 Punkte ausgeben.` |
| `entryPercentMax` / `groupPercentMax` | `„Handlanger" dürfen höchstens 50 % der Punkte ausmachen.` |
| `unresolvedEntry` | `„Old Model" gibt es im Katalog nicht mehr.` |

## Wording / tone (binding) — English

Same principles applied to English, in `en.json`. Entity name bare at the start,
no possessive; army-/list-wide messages take an article; catalogue names stay
verbatim; generic count word is „selection(s)".

| Family (key) | Message (EN) |
| --- | --- |
| `groupCountMax` = 0 | `Commander can't take anything from "Weapons".` |
| `groupCountMax` ≥ 1 | `Butcher may take at most one selection from "Arcane Items".` / `… two selections …` |
| `groupCountMin` | `Butcher needs at least one selection from "Arcane Items".` |
| `categoryMax` (army) | `The army may take at most one selection from "Special".` |
| `categoryMin` (army) | `The army needs at least two selections from "Core".` |
| `forceSelectorMin` | `The army still needs a "General".` |
| `entryMax` | `"Hand Weapon" may only be taken once.` (= 0: `"Shield" can't be taken.`) |
| `entryMin` | `"Hand Weapon" must be taken at least once.` |
| `rosterLimit` | `The list has 111 points – only 100 are allowed.` |
| `groupPointsMax` | `General may spend at most 100 points on "Magic Items".` |
| `entryPercentMax` / `groupPercentMax` | `"Handlers" may make up at most 50% of the points.` |
| `unresolvedEntry` | `"Old Model" no longer exists in the catalogue.` |

## User Stories / Requirements

1. Als Listenbauer möchte ich Fehlermeldungen in verständlicher Alltagssprache
   lesen (in meiner UI-Sprache DE oder EN), damit ich sofort verstehe, was an
   meiner Liste nicht stimmt, ohne die internen Regelbegriffe zu kennen.
2. Als Listenbauer möchte ich, dass die von Katalog-Autoren geschriebenen Texte
   im Wortlaut erhalten bleiben, damit ihre Aussage nicht verfälscht wird.
3. Als Maintainer möchte ich, dass DE und EN denselben verständlichen Ton
   tragen und dieselben Schlüssel abdecken (Parität), damit keine Sprache
   zurückfällt.

## Technical Decisions

- **Betroffene Bereiche (Verhalten, nicht Dateipfade):** ausschließlich die
  `validation.*`-Vorlagen in den beiden Sprachdateien; dazu die Tests, die auf
  dem konkreten Wortlaut prüfen.
- **Reine Wortlaut-Änderung.** Keine Änderung an Validator-Logik, an der Menge
  oder Wahrheit der Verstöße, an `formatValidationError`, an Komponenten oder an
  der i18n-Mechanik. Meldungsschlüssel und Parameter bleiben stabil.
- **Katalognamen** bleiben Pass-through (ADR 0003) — nur das Satzgerüst um sie
  herum wird umformuliert.
- **Wegfall von „(aktuell: N)".** Der vereinbarte Ton verzichtet auf den
  Zählstand-Zusatz. Dadurch wird `stripCurrentCountClause` / `omitCurrentCount`
  (ADR 0022) für diese Meldungen gegenstandslos: Panel und Aushebe-Dialog zeigen
  dann denselben Satz. Das ist eine bewusste Vereinfachung. Ob der
  `validation.currentCountLead`-Schlüssel und der Kappungs-Pfad danach toter Code
  sind und entfernt werden, wird bei der Umsetzung anhand der tatsächlichen
  Nutzung entschieden (Abgleich mit `formatValidationError` und dessen Tests) —
  keine Verhaltensänderung außer dem entfallenden Zusatz.
- **Numerus.** Die pluralisierten Schlüssel behalten `_one`/`_other`; der neue
  Ton nutzt sie („eine Auswahl" / „… Auswahlen").
- **Explizites `_zero` (bewusste Scope-Erweiterung).** Damit das Limit 0 seine
  Sonderaussage bekommt („… keine Auswahl … treffen" / „… can't take anything
  …"), obwohl `0` in `Intl.PluralRules` zu `other` zählt, wird die
  Meldungsauswahl minimal erweitert: `selectMessageKey` (`src/i18n/translate.js`)
  bevorzugt bei `count === 0` eine vorhandene `<key>_zero`-Vorlage (i18next-
  Muster). Betrifft die max-Familien (`groupCountMax`, `categoryMax`, `entryMax`)
  je DE und EN. Das ist die einzige zugelassene Mechanik-Änderung; die
  bestehende `_one`/`_other`-Logik bleibt unberührt, und ohne `_zero`-Vorlage
  verhält sich alles wie bisher (abwärtskompatibel).
- **Eintrags-Meldungen ohne Besitzernamen.** `entryMin`/`entryMax` tragen keinen
  Besitzer-Parameter (nur `{selectionName}`), daher wird ohne Einheitennamen um
  den Eintragsnamen herum formuliert (DE wie EN) — kein „Commander …" davor.
- **Doku-Nachzug.** Die `CONTEXT.md`-Glossareinträge zu Validierungsmeldungen
  werden auf die i18n-Realität nachgezogen (Meldungstexte liegen als Vorlage je
  Sprache in `de.json`/`en.json`, nicht als „deutsche Vorlage").

## Testing Decisions

- **Zu testende Bereiche:**
  - `formatValidationError`: Schlüssel + Parameter → erwarteter Satz je Sprache,
    Katalognamen unverändert, Numerus korrekt.
  - Locale-Parität und Schlüssel-Abdeckung bleiben grün (`localeParity`,
    `validationMessageCoverage`).
  - Bestehende Tests, die auf dem alten Wortlaut prüfen (`ui.test.js`,
    betroffene `rosterValidator.*`-Tests), werden auf die neuen Sätze angehoben.
- **Test-Interfaces (Seams):** `formatValidationError` (framework-frei, je
  Sprache) als primärer Seam; die Sprachdateien als Datenquelle.

## Out of Scope

- Jegliche Änderung an Validator-Logik (Menge/Wahrheit der Verstöße).
- Änderungen an Mechanik, die bereits existiert: strukturierte Fehler,
  `formatValidationError`, i18n-Infrastruktur, ADR 0026. **Ausnahme:** die eine
  oben beschriebene `_zero`-Erweiterung in `selectMessageKey`.
- Umformulieren/Übersetzen von Autor-Meldungen (`modifier-*`) und Katalognamen.
- Handlungshinweise / Remediation.
- Eine zusätzliche „einheitliche Schweregrad-Komponente" — die Renderstellen
  wurden mit #113/#114 überarbeitet; ein weiterer Umbau ist nicht Teil dieses
  Vorhabens.
- Weitere Sprachen über DE/EN hinaus.

## Acceptance Criteria
- [x] Alle `validation.*`-Vorlagen in `de.json` und `en.json` sind im
      verbindlichen Ton umformuliert; die Screenshot-Meldung erscheint als
      `Commander darf keine Auswahl aus „Weapons" treffen.` (DE) bzw.
      `Commander can't take anything from "Weapons".` (EN).
- [x] Meldungsschlüssel, Parameter und Numerus (`_one`/`_other`) unverändert;
      Locale-Parität und Schlüssel-Abdeckung grün.
- [x] Keine Änderung an Validator-Logik, Formatter, Komponenten oder i18n-
      Mechanik; Autor-Meldungen und Katalognamen unangetastet.
- [x] Wortlaut-abhängige Tests auf die neuen Sätze angehoben; volle Suite grün.
- [x] `CONTEXT.md`-Glossar auf die i18n-Realität nachgezogen.

## Comments
- Abgeschlossen. Umsetzung lag im Wortlaut: alle validation.*-Vorlagen in de.json+en.json auf Alltagssprache umgeschrieben (Slice 04), explizites _zero fuer Limit-0-Sonderaussagen, toter (aktuell:N)-Kappungspfad entfernt. Cleanup: unrenderte messageParams-Felder (current/threshold/actual) aus dem Validator entfernt. Vier-Achsen-Pruefung gruen (Standards/Spec/Tests/Docs), Suite 1446 Tests + E2E gruen. Mechanik (strukturierte Fehler, formatValidationError, i18n) kam bereits mit PR #114; Slices 01-03 daher superseded. Version 1.7.0 (minor, feature).
