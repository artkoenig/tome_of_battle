Status: resolved
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
- BLOCKER (spec contradiction, no files changed): The pinned screenshot AC requires groupCountMax with count=0 to render 'Commander darf keine Auswahl aus „Weapons" treffen.' / 'Commander can't take anything from "Weapons".', while the PRD tone table also requires groupCountMax count>=2 to render 'höchstens zwei Auswahlen' / 'at most two selections'. Both count=0 and count>=2 map to the single _other plural variant (Intl.PluralRules('de'|'en').select(0)==='other', .select(2)==='other'), so one _other template cannot produce both wordings. The scope forbids touching the i18n mechanism (translate.js) and mandates keeping only _one/_other, so a _zero variant can be added to the JSON but would never be selected. Recommended resolution: authorize a minimal i18next-style explicit-zero in translate.selectMessageKey (prefer <key>_zero when count===0 and the variant exists) plus _zero templates for the max-count families. Alternatives: relax the exact-string AC to accept the digit ('höchstens 0 Auswahlen'), or special-case max=0 in the validator with a dedicated key (validator change). Secondary note: entry-family PRD examples ('Commander darf „Hand Weapon"…') reference an owner name not present in entryMin/entryMax messageParams (only selectionName/count/current); the binding rule text centers on the entry name, so this is resolvable in-scope by omitting the owner, but confirm.
- Umgesetzt (Option 1, explizites _zero). Alle validation.*-Vorlagen in de.json/en.json auf den PRD-Ton umgeschrieben; Max-Zähl-Familien (categoryMax, entryMax, groupCountMax) tragen zusätzlich eine _zero-Vorlage für Limit 0. translate.selectMessageKey bevorzugt bei count===0 eine vorhandene _zero-Vorlage (i18next-Stil), sonst unverändert _one/_other. Der '(aktuell: N)'/'(currently: N)'-Zusatz entfällt; stripCurrentCountClause/omitCurrentCount/validation.currentCountLead als toter Code entfernt (inkl. Call-Sites und Test). Tests angehoben (formatValidationError, translate _zero-Auswahl, entryAvailability, RosterSidebar, groupConstraintCostType, validationMessageCoverage um _zero erweitert). CONTEXT.md-Glossar und ADR 0022/0026 nachgezogen. Volle Suite grün (1446 vitest + Puppeteer-E2E), lint + typecheck sauber.
