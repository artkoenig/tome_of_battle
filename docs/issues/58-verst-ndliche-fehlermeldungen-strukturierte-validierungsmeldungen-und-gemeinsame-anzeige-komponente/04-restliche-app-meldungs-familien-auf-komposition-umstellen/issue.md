Status: ready-for-agent
Type: feature
Blocked by: None

## Description

Einziger Umsetzungs-Slice von Issue 58 (Geschwister 01–03 sind `superseded`,
da ihre Mechanik bereits durch den i18n-PR #114 auf `main` existiert).

**Aufgabe:** Alle `validation.*`-Vorlagen in `src/i18n/locales/de.json` **und**
`src/i18n/locales/en.json` auf den im PRD des Main-Issues 58 festgelegten Ton
umschreiben. Meldungsschlüssel, Parameter und die bestehende `_one`/`_other`-
Logik bleiben unverändert; es wird der Vorlagentext ersetzt.

**Explizites `_zero` (genehmigte Mechanik-Erweiterung).** Das Limit 0 braucht
eine Sonderaussage („… keine Auswahl … treffen" / „… can't take anything …"),
fällt in `Intl.PluralRules` aber auf `other`. Deshalb:
- `selectMessageKey` in `src/i18n/translate.js` so erweitern, dass bei
  `count === 0` eine vorhandene `<key>_zero`-Vorlage bevorzugt wird (i18next-
  Muster); fehlt sie, greift die bisherige `_one`/`_other`-Auswahl unverändert
  (abwärtskompatibel).
- Für die max-Familien `groupCountMax`, `categoryMax`, `entryMax` je eine
  `_zero`-Vorlage in DE und EN ergänzen (`groupCountMax_zero`, …).
- `_zero` deckt für den Test die Parität mit ab.

**Eintrags-Meldungen ohne Besitzernamen:** `entryMin`/`entryMax` haben keinen
Besitzer-Parameter — daher ohne Einheitennamen um den Eintragsnamen herum
formulieren (siehe PRD-Tabellen, DE wie EN).

Betroffene Schlüssel (alle unter `validation.`):
`rosterLimit`, `forceSelectorMin`, `forceRosterLimit`, `categoryMin`,
`categoryMax`, `unresolvedEntry`, `entryMin`, `entryMax`, `entryPercentMin`,
`entryPercentMax`, `groupPointsMax`, `groupPointsMin`, `groupCountMax`,
`groupCountMin`, `groupPercentMin`, `groupPercentMax` — je DE und EN, für die
pluralisierten Schlüssel als `_one`/`_other`-Paar.

Maßgeblich sind die verbindlichen Beispieltabellen (DE + EN) im PRD des
Main-Issues 58. Kurzfassung der Regeln:

- Ganzer, natürlicher Satz; keine internen Struktur­begriffe; kein „(aktuell: N)".
- Betroffener Einheiten-/Auswahlname ohne Possessiv am Satzanfang; armee-/
  listenweite Meldungen mit Artikel („Die Armee …" / „The army …").
- Katalognamen (`{groupName}`, `{selectionName}`, `{categoryName}`,
  `{unitLabel}`) bleiben unveränderter Pass-through (ADR 0003).
- Zählwort „Auswahl(en)" / „selection(s)" bei Gruppen/Kategorien; einzelne
  Einträge um den Eintragsnamen herum formuliert.

**Wegfall von „(aktuell: N)":** Der neue Ton verzichtet auf den Zählstand-Zusatz.
Damit wird `stripCurrentCountClause` / `omitCurrentCount` (ADR 0022,
`formatValidationError`) für diese Meldungen gegenstandslos — Panel und
Aushebe-Dialog zeigen denselben Satz. Prüfen, ob `validation.currentCountLead`
und der Kappungs-Pfad danach toter Code sind; wenn ja, sauber entfernen (inkl.
zugehöriger Tests), sonst belassen. Keine sonstige Verhaltensänderung.

**Reine Wortlaut-Änderung:** keine Änderung an Validator-Logik,
`formatValidationError`, Komponenten oder i18n-Mechanik.

Zum Abschluss die `CONTEXT.md`-Glossareinträge zu Validierungsmeldungen auf die
i18n-Realität nachziehen (Vorlage je Sprache statt „deutsche Vorlage").

## Acceptance Criteria
- [ ] Alle oben genannten `validation.*`-Schlüssel in `de.json` und `en.json`
      tragen den neuen Ton; die Screenshot-Meldung erscheint als
      `Commander darf keine Auswahl aus „Weapons" treffen.` (DE) /
      `Commander can't take anything from "Weapons".` (EN).
- [ ] Schlüssel und Parameter unverändert; bestehende `_one`/`_other`-Logik
      unberührt; neue `_zero`-Vorlagen für `groupCountMax`/`categoryMax`/`entryMax`
      (DE+EN) greifen bei `count === 0`; `localeParity` und
      `validationMessageCoverage` grün.
- [ ] `selectMessageKey` bevorzugt `<key>_zero` bei `count === 0`, fällt sonst
      abwärtskompatibel auf `_one`/`_other` zurück; durch einen Test abgedeckt.
- [ ] „(aktuell: N)" entfällt in allen betroffenen Vorlagen; falls dadurch
      `currentCountLead`/Kappungs-Pfad toter Code wird, ist er samt Tests
      entfernt, sonst unverändert lauffähig.
- [ ] Keine Änderung an Validator-Logik, Formatter, Komponenten oder i18n-
      Mechanik; Autor-Meldungen und Katalognamen unangetastet.
- [ ] Wortlaut-abhängige Tests (`formatValidationError.test.js`, `ui.test.js`,
      betroffene `rosterValidator.*`-Tests) auf die neuen Sätze angehoben; volle
      Suite grün.
- [ ] `CONTEXT.md`-Glossar nachgezogen.

## Comments
