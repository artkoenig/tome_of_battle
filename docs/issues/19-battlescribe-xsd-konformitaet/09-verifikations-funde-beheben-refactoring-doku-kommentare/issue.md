Status: resolved
Type: fix
Blocked by: None

## Description
Behebt die Funde der Vier-Achsen-Verifikation von Main-Issue 19 (Standards A,
Spec B, Docs D). Alle Zeilennummern sind Orientierung — bei der Umsetzung selbst
verifizieren. Keine Verhaltensänderung am Format-Support; nur Code-Gesundheit,
Doku-Aktualität und Kommentar-Korrektheit. `npm test` (inkl. Puppeteer-E2E) muss
grün bleiben.

**Standards (A):**
- **A1 – `isCostField` als Single Source of Truth.** Die „ist Kostenfeld?"-Prüfung
  inkl. Magic-UUID `ecfa-8486-4f6c-c249` ist an 4 Stellen dupliziert
  (`rosterValidator.js`, `OptionGroup.jsx` ×3), obwohl dieser Branch den Helper
  `isCostField` (`constraintScope.js`) eingeführt hat. `isCostField` so erweitern,
  dass es die Fälle `'pts'`, die Legacy-Punkt-UUID und `roster.costLimitType`
  mitabdeckt, und alle Call-Sites darauf umstellen. Magic-UUID-Literale entfernen.
- **A2 – Evaluations-Kontext statt Data-Clump.** `getSelectionTotalCost`
  (`rosterCounter.js`) hat 8 Positionsparameter; das Bündel
  `{ system, roster, currentCatalogueId, parentSelection, counts }` reist überall
  gemeinsam (auch durch `constraintScope.js`, `rosterValidator.js`). In ein
  Kontext-Objekt/Typ kapseln; das Magic-Literal `1` im Aufruf benennen.
- **A3 – SSOT-Adoption im Parser vereinheitlichen.** `xmlParser.js` liest nur ~10
  Attribute über die generierte `AttributeName`-SSOT, den Rest als rohe Literale
  (`'id'`, `'hidden'`, `'targetId'`, `'type'`, `'primary'`, `'value'`,
  `'publicationId'`, `'page'`, `'shortName'`, …). Konsistent auf `AttributeName`
  umstellen, damit die Anti-Drift-Garantie einheitlich gilt.
- **A4 – Keine Mutation cache-geteilter Objekte.** `resolveEntry`
  (`catalogResolver.js`) stempelt `publicationRef` direkt auf die geteilten
  Rule-/Profile-Objekte des Katalog-Caches. Vor dem Setzen klonen, damit
  wiederholtes Auflösen keinen geteilten State verändert.
- **A5 – Parser-Duplikate zusammenführen.** Identische/near-identische Blöcke in
  `xmlParser.js` deduplizieren: `publications` (2×), `categoryEntries` (2×) und
  categoryLink-Parsing (`parseCategoryLinks` vs. inline in `parseForceEntry`) in
  gemeinsame Helfer.

**Spec (B):**
- **B1 – Kommentar-Drift.** Rest-Kommentare „hard-gate" in `schemaValidator.js`
  und `migrations.test.js` beschreiben das jetzt advisory-Verhalten falsch — auf
  „advisory" korrigieren.
- **B2 – `importRootEntries` out-of-scope dokumentieren.** `catalogueLink@importRootEntries`
  wird geparst, aber nicht konsumiert (Konsum = Library-Import-/targetId-Auflösung,
  laut PRD out of scope). Kurzen Code-Kommentar an der Parse-Stelle setzen, der das
  festhält.

**Docs (D):**
- **D1** `docs/adr/README.md`: ADR 0016 in die Index-Tabelle aufnehmen.
- **D2/D3** `docs/battlescribe-data-format.md` (§7.7 und Referenztabelle §13.1):
  Modifier-`type`-Enum um `add`/`remove`/`set-primary`/`unset-primary` und
  `field`-Werte um `category` ergänzen.
- **D4** §8: laufzeit-dynamische Kategoriezugehörigkeit/`primary`-Flag via Modifier
  dokumentieren.
- **D5/D6** `README.md` und `docs/battlescribe-data-format.md` §2: den neuen
  Advisory-Schema-Validierungsschritt im Importpfad in die Architektur-/Pipeline-
  Beschreibung aufnehmen.
- **D7** condition-Attributtabelle: `includeChildSelections` als geparstes
  `condition`-Attribut ergänzen.

## Acceptance Criteria
- [ ] A1: `isCostField` deckt pts/Legacy-UUID/costLimitType ab und ist an allen bisherigen Call-Sites die einzige Prüfung; keine duplizierten Magic-UUID-Literale mehr
- [ ] A2: Der Evaluations-Kontext ist als Objekt/Typ gekapselt; `getSelectionTotalCost` und die Percent-Checks nutzen ihn; das `1`-Literal ist benannt
- [ ] A3: `xmlParser.js` liest Attribute konsistent über die `AttributeName`-SSOT (keine willkürliche Mischung mehr)
- [ ] A4: `resolveEntry` mutiert keine cache-geteilten Rule-/Profile-Objekte mehr (Klon vor `publicationRef`)
- [ ] A5: publications/categoryEntries/categoryLink-Parsing im Parser ist dedupliziert (gemeinsame Helfer)
- [ ] B1: keine „hard-gate"-Kommentare mehr; Kommentare beschreiben advisory
- [ ] B2: Code-Kommentar dokumentiert `importRootEntries` als geparst-aber-out-of-scope
- [ ] D1–D7: ADR-Index, Modifier-`type`/`field`-Enums, §8 dynamische Kategorien, Import-Architektur (README + §2) und condition-`includeChildSelections` sind in der Doku aktualisiert
- [ ] `npm test` (inkl. Puppeteer-E2E) ist grün; keine Verhaltensregression

## Comments
- Behebt alle Vier-Achsen-Funde: isCostField als SSOT (pts/Legacy-UUID/costLimitType) an allen Call-Sites; Evaluations-Kontext-Objekt fuer getSelectionTotalCost inkl. benanntem TOP_LEVEL_PARENT_COUNT; xmlParser durchgaengig auf AttributeName-SSOT; Klon vor publicationRef-Stempel in resolveEntry; parseCategoryLink/parseCategoryEntries/parsePublications als gemeinsame Parser-Helfer; hard-gate-Kommentare auf advisory korrigiert; importRootEntries als geparst-aber-out-of-scope kommentiert; Doku D1-D7 aktualisiert. npm test (Vitest 542 gruen + Puppeteer-E2E) gruen.
