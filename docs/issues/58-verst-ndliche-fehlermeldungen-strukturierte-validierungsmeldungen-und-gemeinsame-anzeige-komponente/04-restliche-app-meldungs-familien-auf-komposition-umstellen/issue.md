Status: ready-for-agent
Type: feature
Blocked by: None

## Description

Einziger Umsetzungs-Slice von Issue 58 (Geschwister 01–03 sind `superseded`,
da ihre Mechanik bereits durch den i18n-PR #114 auf `main` existiert).

**Aufgabe:** Alle `validation.*`-Vorlagen in `src/i18n/locales/de.json` **und**
`src/i18n/locales/en.json` auf den im PRD des Main-Issues 58 festgelegten Ton
umschreiben. Meldungsschlüssel, Parameter und Numerus (`_one`/`_other`) bleiben
unverändert; es wird nur der Vorlagentext ersetzt.

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
- [ ] Schlüssel, Parameter und Numerus unverändert; `localeParity` und
      `validationMessageCoverage` grün.
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
