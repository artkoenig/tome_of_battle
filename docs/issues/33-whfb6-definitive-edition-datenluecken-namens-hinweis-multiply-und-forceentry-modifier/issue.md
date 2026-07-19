Status: resolved
Type: feature
Blocked by: None

## Description
# PRD: WHFB6 Definitive-Edition-Datenlücken (Namens-, Hinweis-, multiply- und forceEntry-Modifier)

## Problem Statement / Bug Description
Ein Abgleich des echten Lexicanum-Datensatzes ("Definitive Edition",
`artkoenig/Warhammer-Fantasy-Battles-6th-Definitive-edition`, 18 `.cat` + 1 `.gst`)
gegen Parser (`src/parser/xmlParser.js`) und Solver (`src/solver/modifierEvaluator.js`,
`src/solver/rosterCounter.js`, `src/solver/rosterValidator.js`) deckt vier real
vorkommende, bislang unberücksichtigte BattleScribe-Konstrukte auf — analog zu den
bereits gelösten App-Fähigkeitslücken aus Issue 27 (sharedRules/infoGroup), 29
(Kategorie-Modifier) und 30 (entryLink-Alias-Auflösung):

1. **`modifier field="name"`** (Typen `set`/`append`/`prepend`, teils mit `join`-
   Attribut) — **500 Treffer über alle 18 Kataloge**. Benennt geteilte/generische
   Einträge kontextabhängig um. Beispiele: The Empire — der `infoLink`-Profilname
   „Empire soldier" wird per `set` zu „Halberdier"/„Spearmen"/„Ulric's Champion";
   Bretonnia — eine verlinkte Waffe wird zu „Polearm (counts as Halberd)", ein
   Reittier zu „Silvaron"; Dogs of War — `append value="Relics of Lustria"
   join="&#160; + &#160;"` hängt „ + Relics of Lustria" an. Weder `xmlParser.js`
   noch `modifierEvaluator.js` werten `field="name"` aus; `ModifierKind` kennt
   `prepend` nicht, `join` wird nirgends geparst.
2. **`modifier field="error"/"warning"/"info"`** — **163 Treffer über 17 Kataloge
   + `.gst`**. BattleScribe-Konvention für kontextabhängige Klartext-
   Validierungshinweise an den Spieler (Beispiel: Bretonnia/Dark Elves — „Please
   enable \"Allow special characters?\"" bei nicht erfüllter Bedingung). Komplett
   unbehandelt; `rosterValidator.js` kennt aktuell nur eine harte, immer
   `severity: 'error'` gesetzte Fehlerliste ohne Schweregrad-Unterscheidung.
3. **`modifier type="multiply"`** — **6 Treffer** (Dwarfs 2001 ×3, Dwarfs 2005
   ×3). Verdoppelt die `pts`-Kosten einer Einheit bei erfüllter Heeres-Bedingung
   (z. B. Dwarfs 2001, "Traditional Army", DW1-AB p.53). Reproduzierter
   Kostenfehler: `getSelectionOwnCosts` (`rosterCounter.js:143`) reicht den
   Modifier an `getModifiedConstraintValue` (`modifierEvaluator.js`) durch, deren
   `switch` nur `set/increment/decrement` kennt — `multiply` bleibt wirkungslos,
   die betroffene Einheit wird zum halben korrekten Preis berechnet und
   exportiert.
4. **`forceEntry`-eigene `modifiers`** — **2 Treffer** (beide Vampire Counts:
   Sonderheere „Army of the Lichemaster (WD#309-UK)" und „Vampire Coast
   (WD#306-UK)"). Jede der beiden `forceEntry`s trägt eine eigene `constraint`
   (`field="limit::<pts-costTypeId>"`, `scope="roster"`, Basis `min=0`) plus
   einen `modifier`, der diese beim Wählen des jeweiligen Sonderheeres
   (`instanceOf`, `scope="force"`, `childId=<eigene forceEntry-Id>`) auf 2000
   setzt — netto: „wer dieses Sonderheer wählt, muss die Liste auf ≥2000 Punkte
   bauen". `parseForceEntry` (`xmlParser.js:442`) liest nur
   `id/name/hidden/categoryLinks/forceEntries/constraints`; die aktivierenden
   `modifiers` werden nicht geparst, es existiert zudem keine Auswertungslogik für
   forceEntry-eigene Constraints (nur `categoryLink`-Constraints werden heute
   ausgewertet, siehe `checkForceCategoryLimits`).

Keines der vier ist in einem bestehenden Issue/ADR erfasst. Für `multiply` und
`prepend` (inkl. `join`-Attribut) gilt zusätzlich: Eine offizielle Klärung wurde
versucht (`BSData/schemas`, geprüft bis einschließlich der unveröffentlichten
`vNext`-Version) — keine bekannte Schema-Version definiert diese drei Konstrukte;
das offizielle Wiki bestätigt dieselbe Lücke und markiert sich selbst als
veraltet. Sie werden dennoch vom echten BattleScribe-Referenzprogramm akzeptiert
und von den Lexicanum-Autoren aktiv genutzt (siehe ADR-0016, Revision
2026-07-19).

## Solution
Alle vier Konstrukte werden generisch im Parser/Solver unterstützt — keine
Vampire-Counts- oder Dwarfs-spezifische Sonderlogik (ADR-0003).

- **Namens-Modifier:** Ein zentraler, kontextbewusster Solver-Helfer
  `getEffectiveName` (analog zum bestehenden Muster von
  `getEffectiveCategoryLinks`/`evaluateHiddenFlag`) wertet `set`/`append`/
  `prepend`-Modifier mit `field="name"` inklusive `join`-Attribut aus (das
  `join`-Attribut wird geparst, nicht angenommen — echte Daten zeigen NBSP und
  `"&#160; + &#160;"` neben normalem Leerzeichen). Der modifizierte Name gilt
  **überall** (Roster-Editor, Aushebe-Dialog, Play-Modus, XML-Export) und ersetzt
  den rohen Katalognamen konsequent.
- **Hinweistext-Modifier:** `field="error"/"warning"/"info"`-Modifier, deren
  Bedingungen zutreffen, erzeugen einen neuen Eintrag in der bestehenden
  Validierungsliste (`rosterValidator.js`) mit einem neuen `severity`-Feld.
  `error` verhält sich wie ein bestehender Regelverstoß (blockiert die Liste als
  ungültig); `warning`/`info` sind rein informativ und blockieren nicht — dafür
  bekommt jeder bestehende Validierungseintrag `severity: 'error'`, und die
  Play-Button-Gate-Logik (`isRosterValid`) filtert künftig auf `severity ===
  'error'`.
- **`multiply`-Modifier:** `getModifiedConstraintValue` bekommt einen neuen
  `multiply`-Zweig (Kosten/Constraint-Wert wird mit dem Modifier-Wert
  multipliziert statt addiert/gesetzt).
- **forceEntry-Modifier:** `parseForceEntry` liest zusätzlich `modifiers`/
  `modifierGroups` (bewusst nicht die volle `ContainerEntryBase` — `rules`/
  `profiles`/`infoLinks` haben an forceEntry keinen realen Beleg, YAGNI). Eine
  neue, eng gefasste Auswertung deckt genau das belegte Muster ab: eine
  forceEntry-eigene Constraint mit `field="limit::<costTypeId>"`,
  `scope="roster"`, angehoben durch einen an die eigene forceEntry-Id gebundenen
  Modifier. Keine generische Auswertung für forceEntry-Modifier auf beliebige
  Constraints (kein realer Anwendungsfall belegt).
- **Schema-SSOT:** Die vendorte `Catalogue.xsd` (ADR-0016) wird um `multiply`,
  `prepend` (beide `ModifierKind`) und das `join`-Attribut auf `Modifier`
  ergänzt, mit Verweis auf die konkreten Katalog-Fundstellen statt auf eine
  offizielle Quelle (siehe ADR-0016, Revision 2026-07-19). `npm run
  generate:schema` läuft danach reguläer gegen die erweiterte Datei — der
  SSOT-Guard (`scripts/generate-schema-module.test.js`) bleibt intakt.

## User Stories / Requirements
1. Als Spieler möchte ich, dass Einheiten/Ausrüstung/Profile mit ihrem im Katalog
   vorgesehenen, kontextabhängigen Namen angezeigt werden (z. B. „Halberdier"
   statt „Empire soldier"), damit die Liste dem echten Regelwerk entspricht.
2. Als Spieler möchte ich kontextabhängige Klartext-Hinweise des Katalogautors
   sehen (z. B. „Please enable 'Allow special characters?'"), damit ich weiß,
   warum eine Auswahl nicht wie erwartet funktioniert.
3. Als Spieler möchte ich, dass eine Einheit mit einer katalogseitig
   vorgesehenen Kostenverdopplung (z. B. Dwarfs "Traditional Army") korrekt
   doppelt berechnet und exportiert wird, damit meine Liste regelkonform ist.
4. Als Spieler, der ein Vampire-Counts-Sonderheer wählt ("Army of the
   Lichemaster", "Vampire Coast"), möchte ich, dass das damit verbundene
   Mindestpunktelimit durchgesetzt wird, damit ich keine ungültige Liste baue.
5. Als Entwickler möchte ich, dass eine bestehende, gültige (aber informative)
   Roster-Meldung nicht mehr fälschlich das Spielen blockiert, nur weil sie in
   derselben Liste wie echte Regelverstöße steht.

## Technical Decisions
- **Affected Modules:** `src/parser/schema/Catalogue.xsd` (vendorte Schema-
  Erweiterung), `src/parser/schema/battlescribeSchema.generated.js` (Codegen-
  Ergebnis, nicht von Hand editieren), `src/parser/xmlParser.js`
  (`parseSingleModifier` liest `join`; `parseForceEntry` liest `modifiers`/
  `modifierGroups`), `src/solver/modifierEvaluator.js` (`multiply`-Zweig in
  `getModifiedConstraintValue`; neue `getEffectiveName`; neue Funktion für
  error/warning/info-Nachrichten), `src/solver/rosterCounter.js` (nutzt
  `getEffectiveName` für Anzeigezwecke, sofern dort Namen ausgegeben werden),
  `src/solver/rosterValidator.js` (`severity`-Feld an allen bestehenden
  Validierungs-Pushes; neuer Message-Check; neuer, eng gefasster
  forceEntry-Constraint-Check), `src/solver/catalogResolver.js` (bleibt
  bewusst kontextfrei/pur — `getEffectiveName` liegt separat, analog zu
  `evaluateHiddenFlag`), `src/hooks/useRoster.js` und `src/components/
  RosterEditor.jsx`/`RosterSidebar.jsx`/`UnitSelectionCard.jsx` (Konsum von
  `getEffectiveName` an den ca. 7 bestehenden `.name`-Lesestellen;
  `isRosterValid`-Filterung auf `severity === 'error'`; UI-Unterscheidung
  error/warning/info), `docs/adr/0016-...md` (bereits amendiert, siehe
  Revision 2026-07-19), `docs/battlescribe-data-format.md` (aktuell lückenhaft
  bzgl. `prepend`/`multiply`/error-warning-info/forceEntry-Modifier —
  nachzuziehen).
- **Technical Clarifications / Architectural Decisions:** ADR-0016 (Revision
  2026-07-19) dokumentiert die bewusste Erweiterung der vendorten XSD ohne
  offiziellen Beleg. Kein neues ADR nötig für die übrigen drei Punkte (Namens-
  Resolver als neue Solver-Funktion, Severity-Feld, eng gefasster forceEntry-
  Check) — leicht reversibel, folgt bestehenden Mustern (`getEffectiveCategoryLinks`,
  `evaluateHiddenFlag`), kein echter Trade-off.
- **API Contracts / Data Models:** Validierungseinträge aus `validateRoster`
  bekommen ein neues Pflichtfeld `severity: 'error' | 'warning' | 'info'`
  (bislang implizit immer `'error'`) — bestehende Konsumenten, die die Liste nur
  auf Länge prüfen (`isRosterValid = validationErrors.length === 0`), müssen auf
  `severity === 'error'`-Filterung umgestellt werden. Kein neues IndexedDB-Feld,
  keine Migration gespeicherter Systeme/Rosters nötig (rein abgeleitete
  Auswertung zur Laufzeit).

## Testing Decisions
- **Modules to Test:** `src/parser/xmlParser.js` (`join`-Attribut,
  `parseForceEntry`-Erweiterung), `src/solver/modifierEvaluator.js`
  (`multiply`-Zweig, `getEffectiveName`, error/warning/info-Auswertung),
  `src/solver/rosterCounter.js` (`multiply` in der Kostenberechnung),
  `src/solver/rosterValidator.js` (Severity-Feld, Message-Check,
  forceEntry-Constraint-Check), `scripts/generate-schema-module.test.js`
  (SSOT-Guard bleibt grün nach XSD-Erweiterung).
- **Test Interfaces (Seams):**
  - `parseCatalogueXML`/`parseGameSystemXML` (`xmlParser.js`) — `join`-Attribut
    auf Modifiern, `modifiers`/`modifierGroups` auf `forceEntry`.
  - `getModifiedConstraintValue` (`modifierEvaluator.js`) — neuer
    `multiply`-Zweig.
  - `getEffectiveName(resolvedEntry, ctx)` (neu, `modifierEvaluator.js`) —
    `set`/`append`/`prepend` mit `join`, bedingungsgegatet.
  - Neue Funktion für error/warning/info-Nachrichtensammlung (`modifierEvaluator.js`
    oder `rosterValidator.js`) — Bedingungsauswertung wiederverwendet
    `modifierConditionsPass`/`evaluateCondition`/`evaluateConditionGroup`.
  - `validateRoster` (`rosterValidator.js`) — `severity`-Feld an jedem Eintrag;
    neuer Check für forceEntry-eigene `limit::<costTypeId>`-Constraints.
  - `isRosterValid` (`RosterEditor.jsx`/`useRoster.js`) — Filterung auf
    `severity === 'error'`.
  - Neue reale Daten-Fixtures unter `src/solver/__fixtures__/whfb6-lexicanum/`
    (Namens-, Hinweis-, `multiply`-, forceEntry-Beispiel), extrahiert aus dem
    Lexicanum-Fork nach dem bestehenden README-Muster (verbatim, dokumentierte
    Herkunft, eingefroren).

## Out of Scope
- Keine Generalisierung der forceEntry-Modifier-Auswertung auf beliebige
  Constraints (nur das belegte "eigenes Punktelimit anheben"-Muster) — kein
  realer Anwendungsfall in den Definitive-Edition-Daten.
- Kein automatisches Zurückspielen der Schema-Erweiterung an `BSData/schemas`
  (optional denkbar, aber nicht Teil dieses Main-Issues).
- Keine Änderung an der Ergofarg-Quelle/ihren Fixtures
  (`src/solver/__fixtures__/whfb6/`) — betrifft ausschließlich die
  Definitive-Edition-spezifischen Konstrukte.
- Kein neuer Severity-Wert jenseits `error`/`warning`/`info` (die drei
  BattleScribe-Werte).

## Acceptance Criteria
- [ ]

## Comments
- Alle 5 Kind-Issues (01 Schema-SSOT, 02 Hinweistext-Modifier, 03 forceEntry-Punktelimit, 04 multiply-Modifier, 05 Namens-Modifier) resolved und gemergt. Vier-Achsen-Verifikation zweimal gelaufen: Standards gruen (oxlint exit 0; DRY-Hinweis zu blockingErrorCount behoben, Rest vorbestehende codebasisweite Smells), Spezifikation 0 offene Funde nach Fixes, Tests gruen (714/714 vitest; Puppeteer-E2E durchgaengig nur an der bekannten Sandbox-Netzwerksperre gescheitert, kein Code-Problem), Doku nachgezogen (battlescribe-data-format.md um multiply/prepend/join/error-warning-info/forceEntry-Modifier ergaenzt, ui-renderer-audit.md um die zwei neuen Anzeige-Bruecken, Fixture-README-Tippfehler behoben). Zwei Fixtures (multiply, Namens-Modifier) von erfunden auf echte Verbatim-Auszuege aus dem geklonten Lexicanum-Fork umgestellt. ADR-0016 amendiert (Revision 2026-07-19). Version auf 1.2.0 angehoben (Type: feature, Nutzerbestaetigung).
