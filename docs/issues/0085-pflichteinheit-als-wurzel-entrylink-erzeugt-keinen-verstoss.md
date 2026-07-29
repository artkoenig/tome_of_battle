---
status: done
branch: claude/85-umsetzen-0cru2t
pr: https://github.com/artkoenig/tome_of_battle/pull/171
---

# Pflichteinheit als Wurzel-`entryLink` erzeugt keinen Verstoß

## Intent

`docs/battlescribe-data-format.md` §9.9 beschreibt zwei gleichwertige
Kodierungen der armeeweiten Pflichteinheit: der `min`-Constraint hängt an einem
Wurzel-`selectionEntry` **oder** an einem Wurzel-`entryLink` (Basis `min="0"`,
per Link-Modifier angehoben — so codiert die „Definitive Edition" die
Ogerbullen-Pflicht). Die Auswertung soll beide Wurzelformen einsammeln; fehlt
die Zieleinheit ganz, entsteht ein blockierender Verstoß.

Die Engine sammelt nur die `selectionEntry`-Form ein:
`PHANTOM_DEFINITION_KINDS` (`src/evaluator/resolver.js:73`) enthält kein
`ENTRY_LINK`, und `collectRootDefinitions` (`resolver.js:125`) bricht bei einem
Wurzel-Link sofort ab — samt seiner Kinder. Ein Wurzel-`entryLink` mit
`min ≥ 1` (`scope="roster"` oder `"force"`) bekommt deshalb kein
Pflicht-Phantom; sein Angebots-Anker ist per ADR-0035 nie berichtsfähig.
Ergebnis: eine Liste ohne die Pflichteinheit meldet **null** Verstöße.

Repro (Audit 2026-07-28, Skript im Scratchpad des Audits): Katalog mit
Wurzel-`entryLink` auf ein shared Entry, `min=1 scope="roster"`, leeres Roster
→ 0 Verstöße; identischer Constraint an einem Wurzel-`selectionEntry` → 1
Verstoß (Kontrolle).

Acceptance criteria:

1. Ein Wurzel-`entryLink` mit effektivem `min > 0` (`scope="roster"` oder
   `"force"`), dessen Zieleinheit im jeweiligen Rahmen fehlt, erzeugt einen
   blockierenden Verstoß (Ist 0 gegen die Grenze).
2. Ausgewertet werden dabei die Grenzen **und Modifier des Links**, nicht die
   des Ziels (§9.9): die bedingte Anhebung von Basis `min=0` auf 1 greift, und
   ohne erfüllte Bedingung entsteht kein Verstoß.
3. Führt ein Katalog dieselbe Pflicht in beiden Wurzelformen, wird über die
   Ziel-Id entdoppelt: genau ein Verstoß (§9.9).
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28), Fund mit ausgeführtem Repro gegen die echte Fassade.
- **Link-Phantom wertet nur die eigenen Grenzen des Links aus** (Default,
  2026-07-29, aus §9.9 abgeleitet): `ENTRY_LINK` kommt in die
  Wurzel-Definitionsliste, sein Pflicht-Phantom wird aber mit dem vorhandenen
  `ownLimitsOnly`-Mechanismus der Gruppen-Anker zugeschnitten
  (`evaluableLimitsOf`). Das verhindert die im Log belegte Doppel-Verletzung
  durch die Zielgrenzen-Vererbung (`limitsOf`) und hält ADR-0032 („keine
  falsche Pflicht aus verlinkten Zielen") ein.
- **Modifikator-Erbregel bleibt unangetastet** (Default, 2026-07-29):
  `inheritedThenOwn` wendet weiter Ziel- vor Link-Modifikatoren an.
  Ziel-Modifikatoren adressieren Ziel-Grenz-Ids, die am Link-Phantom gar nicht
  ausgewertet werden — Kriterium 2 ist damit wirksam erfüllt, ohne einen
  Sonderweg in der Modifikator-Schicht.
- **Entdopplungsschlüssel für Kriterium 3** (Default, 2026-07-29): die rohe
  `countedTargetId` (beim Link `def.targetId`), zusammen mit Grenzart und
  Rahmen (ROSTER bzw. Kontingent-Identität), beschränkt auf
  Pflicht-Phantom-Anker — genau der Schlüssel, den der Kommentar an
  `constraints.js` (`countedTargetId`) bereits vorsieht. Die Divergenz
  rohe vs. transitiv aufgelöste Id bei Link-Ketten bleibt Issue 0094.

## Log

- **2026-07-29, Recherche vor dem Lauf** (eigenes Repro gegen die echte Fassade,
  Arbeitsbaum danach sauber).
  - **Der Fund ist bestätigt.** Katalog mit `sharedSelectionEntries` +
    Wurzel-`entryLink` (`min=1 scope="roster"`), leeres Roster → `violations: 0`,
    `diagnostics: []`. Derselbe Constraint an einem Wurzel-`selectionEntry` → 1
    Verstoß. Mit einem Kontingent erscheint der Link als Slot, aber als
    `offerAnchor` — der effektive Min-Wert ist korrekt 1, nur ist der Anker nach
    ADR-0035 nicht meldefähig.
  - **Die Zeilennummern im Intent sind um ~10 verrutscht.**
    `PHANTOM_DEFINITION_KINDS` steht auf `resolver.js:83`,
    `collectRootDefinitions` auf `resolver.js:135`, `followEntryLink` auf
    `resolver.js:238`. „`armyLevelCandidates` (resolver.js:656)" trifft nichts —
    die Funktion heißt `collectArmyLevelCandidates` (`resolver.js:172`).
  - **Der Abbruch ist Absicht, nicht Versehen.** `collectRootDefinitions`
    returnt **vor** der Kinderschleife (`resolver.js:136`); der Kopfkommentar
    begründet es mit ADR-0032: hinter einem Link liegende Einträge sind nur per
    Verweis bezogen und dürfen keine falsche Pflicht synthetisieren. Abgesichert
    ist das in `crossCatalog.test.js:109-142`.
  - **Die naive Lösung ist belegt falsch.** `ENTRY_LINK` einfach in
    `PHANTOM_DEFINITION_KINDS` aufnehmen (Patch gesetzt, gemessen,
    zurückgenommen): bei einem Wurzel-Link `min=1` auf ein Ziel mit eigenem
    `min=3` entstehen **zwei** Verstöße statt einem — die Zielgrenze feuert mit,
    weil `limitsOf` (`evalTree.js:180`) alle Grenzen des Ziels erbt. Genau die
    Pflicht, die ADR-0032 ausschließt.
  - **Und die Suite merkt es nicht.** Mit dem naiven Patch: `npx vitest run
    src/evaluator` → 48 Dateien, 649 Tests, Exit 0 — identisch zum Lauf ohne
    Patch. Die Regressionsgefahr liegt also nicht in der bestehenden Suite,
    sondern in der ungetesteten Zielgrenzen-Vererbung. Ein Test dafür gehört in
    diesen Lauf.
  - **Kriterium 3 braucht einen anderen Schlüssel als die vorhandene
    Entdopplung.** `dedupeArmyWideCategoryViolations` (`report.js:149`)
    schlüsselt auf `(limitId, countedTargetId)` und greift nur für
    Kategorie-Anker. Bei zwei Wurzelformen derselben Pflicht sind die Grenz-Ids
    **verschieden** (zwei Constraints) — der Schlüssel trennt sie also. Die
    Entdopplung muss über Ziel-Id **plus Rahmen** laufen. Offen ist dabei,
    welche Ziel-Id: `constraints.js:100` nimmt die rohe `def.targetId`,
    `report.js:227` die transitiv aufgelöste `def.resolved?.id` — bei einer
    Link-auf-Link-Kette laufen beide auseinander (Berührung mit Issue 0094).
  - **Kriterium 2 deckt sich heute nicht mit der Doku.** §9.9 verlangt, die
    Grenzen **und Modifier des Links** auszuwerten, „nicht die des Ziels". Die
    Engine erbt in beide Richtungen: `inheritedThenOwn` (`modifiers.js:634`)
    wendet erst die Modifikatoren des Ziels an, dann die eigenen. Für den
    Ogerbullen-Fall folgenlos (das Ziel trägt keine kollidierenden Modifier),
    als Aussage aber nicht deckungsgleich.
  - **Der Fixture-Fall existiert.** `Ogre Kingdoms (…).cat:3133` —
    `entryLink id="d82e-111e-89b9-2be1" targetId="7754-8b3d-df99-d2d5"` auf
    Katalog-Wurzelebene; Basis-Constraint `32ed-26da-3f27-5c04`
    (`min=0 scope="force"`, Zeile 3162), angehoben per `set 1` (Zeile 3140) in
    der Modifikatorgruppe „Standard", gegatet auf `notInstanceOf` des
    `forceEntry` „Ironskin Tribe" (`8711-ed16-2a44-7251`). Das Ziel liegt in
    `Mercenaries (…).cat:3438` unter `sharedSelectionEntries`. **Achtung:** der
    Rahmen ist `force`, nicht `roster` — der Intent nennt beide, die Daten
    liefern nur `force`. Gegen die echten Kataloge ändert der naive Patch genau
    eine Zeile: leeres „Standard"-Kontingent 4 → 5 Verstöße, der zusätzliche ist
    „Ogre Bulls" (Ist 0, Grenze 1); beim „Ironskin Tribe"-Kontingent bleibt es
    bei 4, die bedingte Anhebung greift also korrekt.
  - **Offen geblieben:** ob im Fixture-Satz ein Katalog dieselbe Pflicht
    *gleichzeitig* in beiden Wurzelformen führt (dann hätte Kriterium 3 echte
    Daten statt eines synthetischen Katalogs); und das Verhalten eines
    Wurzel-`entryLink`, der auf eine `selectionEntryGroup` zeigt.
  - **Nebenbefund, eigenes Issue wert:** `PHANTOM_DEFINITION_KINDS` schneidet
    nicht nur Links ab, sondern auch **Wurzel-Gruppen** (`GROUP` fehlt). Eine
    `min`-Grenze unterhalb einer Wurzel-Gruppe bekommt heute ebenfalls kein
    Phantom. Ob gewollt, sagt kein Kommentar; §9.9 spricht nur von Einträgen und
    Links.

- **2026-07-29, test-author:** `src/evaluator/rootEntryLinkMandatory.test.js`
  angelegt — 5 Tests (Kriterium 1: roster + force; Kriterium 2: bedingte
  Anhebung erfüllt/nicht erfüllt, Zielgrenze feuert nicht mit; Kriterium 3:
  beide Wurzelformen → genau ein Verstoß). Alle 5 schlagen aus dem richtigen
  Grund fehl (`expected [] to have a length of 1 but got +0`, Exit ≠ 0);
  `crossCatalog.test.js` + `phantom.test.js` unverändert grün (16 Tests,
  Exit 0). Negative Randfälle bewusst in denselben `it`-Blöcken wie die
  positiven, damit sie heute nicht trivial grün sind. Welcher der beiden
  `limitId`s die Entdopplung überlebt, lässt Kriterium-3-Test offen.

- **2026-07-29, Implementierung** (implementer, gemäß den Decisions):
  - `resolver.js`: `ENTRY_LINK` in `PHANTOM_DEFINITION_KINDS`; Kommentare an
    `collectRootDefinitions`/`resolveCatalogue` fortgeschrieben (die
    Traversierung folgt nie `resolved` — ADR-0032 hält).
  - `evalTree.js`: `attachPhantom` um `ownLimitsOnly` erweitert; neue Helfer
    `mandatoryLimitStockOf`/`hasMinLimit` — für eine `ENTRY_LINK`-Definition
    entscheidet nur `def.limits` über das Phantom, und es wertet nur diese aus.
  - `report.js`: `dedupeMandatoryEntryPhantomViolations` (Schlüssel Grenzart +
    Rahmen + `countedTargetId`, Rahmen = Roster bzw. `frameKeyOf(forceRoot)`;
    erste Meldung in Dokumentreihenfolge überlebt), verkettet mit der
    Kategorie-Entdopplung.
  - Nachweise: `npx vitest run src/evaluator/rootEntryLinkMandatory.test.js`
    5/5 grün; `npx vitest run src/evaluator` 57 Dateien, 741 Tests, 740 grün,
    1 rot (Vorbestand, s. u.); `npm run lint` Exit 0; `npm run typecheck`
    Exit 0.
  - Defaults des Implementierers: FORCE-Ergebnis ohne Kontingent
    (`forceRoot === null`) bleibt von der Entdopplung unberührt; der Schlüssel
    entdoppelt auch verschiedenartige Felder (Selektions- vs. Kosten-Min) am
    selben Ziel — §9.9 kennt nur den Selektionsfall.
- **2026-07-29, Vorbestand verifiziert (Hauptlauf, eigene Gegenprobe):**
  `countIndex.costSumUnderCarrier.test.js` („includeChildSelections=false
  liest nur die Kosten des Trägers") scheitert identisch auf `origin/main`
  (b67e93c, frischer Worktree, 1 failed | 9 passed) — keine Regression dieses
  Laufs, sondern Kollision Issue 083 ↔ 091 in `countingFlagsOf`
  (`constraints.js:73-80`). Als **Issue 0113** gefiled; hier außerhalb der
  Intent, wird nicht mitgefixt.

- **2026-07-29, Review Runde 1** (frischer Kontext, Diff vs. Intent). Fakten:
  Suite 741 Tests / 740 grün / 1 rot (= verifizierter Vorbestand 0113), Lint
  und Typecheck Exit 0. Kriterien 1–3 erfüllt, Protokoll deckungsgleich mit
  dem Diff. Zwei Befunde, beide mit Repro:
  - **B1 (fixen):** `dedupeMandatoryEntryPhantomViolations` schlüsselt ohne
    das Grenz-**Feld** — ein Wurzel-`selectionEntry` mit Selektions-Min UND
    Kosten-Min im selben Rahmen meldet auf HEAD 1 statt 2 Verletzungen
    (Repro-Skript des Reviewers, main: 2, HEAD: 1). Formal außerhalb der
    Intent, aber vom eigenen Diff eingeführt — wird gefixt statt eskaliert:
    verschiedene Felder sind verschiedene Pflichten (§9.9 entdoppelt
    dieselbe Pflicht, nicht verschiedenartige). Latent (Fixture-Kataloge
    führen das Muster nicht), trotzdem Regression.
  - **B2 (fixen):** Kriterium 3 ist nur für `scope="roster"` getestet; der
    `frameKeyOf(forceRoot)`-Zweig (je Kontingent eine Meldung, keine
    Über-Entdopplung) ist heute korrekt (Stichprobe des Reviewers), aber
    ungesichert. Regressions-Guard-Test ergänzen.
  - Kriterium 4 präzisiert: Exit 1, einziger Rotstand = Vorbestand 0113 —
    identisch auf `origin/main`, von diesem Lauf unberührt.
  - **Abweichungs-Notiz:** der B2-Guard sichert schon-korrektes Verhalten und
    kann deshalb nicht „zuerst fehlschlagen" (Invariante 2 greift nur, wo es
    etwas zu implementieren gibt); der B1-Test schlägt vor dem Fix fehl.

- **2026-07-29, Fix-Runde nach Review 1:** test-author ergänzte
  `rootEntryLinkMandatory.dedupeBounds.test.js` (Rand 1 rot: zwei
  verschiedenartige Min-Pflichten → 1 statt 2 gemeldet; Rand 2 grüner Guard:
  FORCE entdoppelt je Kontingent). Implementierer nahm das Grenz-Feld
  (`field.kind` + `costTypeId`) in den Entdopplungsschlüssel von
  `dedupeMandatoryEntryPhantomViolations` auf (nur `report.js`). Nachweise:
  dedupeBounds 2/2 grün; `npx vitest run src/evaluator` 58 Dateien, 743
  Tests, 742 grün, 1 rot = Vorbestand 0113; Lint/Typecheck Exit 0.

- **2026-07-29, Review Runde 2** (frischer Kontext, ganze Intent). Fakten:
  Suite 58 Dateien / 743 Tests / 742 grün / 1 rot (= Vorbestand 0113, erneut
  gegen `origin/main` verifiziert), Lint/Typecheck Exit 0. Alle vier
  Kriterien erfüllt; B1/B2 nachweislich adressiert; Protokoll deckungsgleich.
  Ein Befund:
  - **F1 (fixen):** Der Entdopplungsschlüssel kennt keine Grenz-Identität —
    zwei **verschiedenwertige** `min`-Grenzen (gleiches Feld, gleicher
    Rahmen) am **selben** Wurzeleintrag kollabieren zu einer Meldung, die
    stärkere Grenze (bound 3) verschwindet (Repro: main 2 → HEAD 1). Gleiche
    Klasse wie B1, vom eigenen Diff eingeführt → wird gefixt.
  - **Entscheidung zur F1-Semantik** (Default, 2026-07-29): Entdoppelt wird
    nur die zweite Kodierung *derselben* Pflicht — gleicher Schlüssel
    (Feld, Art, Rahmen, Ziel-Id) **und gleicher effektiver Grenzwert** (dieselbe
    Pflicht hat je Auswertung denselben Bound, vgl. §9.9: beide Kodierungen
    meinen dasselbe) **und ein anderer Anker-Knoten**. Ergebnisse am selben
    Anker sind immer verschiedene Grenzen und entdoppeln nie (deckt auch
    identische Duplikat-Grenzen wie auf `main`).
  - **Blast-Radius-Notiz des Reviewers (kein Befund, keine Aktion):**
    `collectRootDefinitions` steigt jetzt in die Kinder eines Wurzel-Links ab
    — am Link *deklarierte* Kind-Einträge mit `min` synthetisieren nun ein
    Phantom. Widerspricht weder §9.9 noch ADR-0032 (nicht über `resolved`
    bezogen), von keinem Kriterium gefordert, kein falsches Ergebnis
    nachweisbar.

- **2026-07-29, Fix-Runde nach Review 2 (F1):** test-author ergänzte
  `rootEntryLinkMandatory.sameAnchorLimits.test.js` (rot: zwei
  verschiedenwertige Min-Grenzen am selben Anker → 1 statt 2). Implementierer
  setzte die entschiedene Semantik in `report.js` um: Schlüssel um den
  effektiven Bound erweitert, Entfall nur bei Überlebendem an **anderem**
  Anker (`survivorAnchorByKey`-Map). Nachweise: sameAnchorLimits grün; die 7
  bisherigen Issue-Tests grün (Zwei-Anker-gleicher-Bound entdoppelt weiter);
  `npx vitest run src/evaluator` 744 Tests, 743 grün, 1 rot = Vorbestand
  0113; Lint/Typecheck Exit 0.

- **2026-07-29, Review Runde 3** (frischer Kontext, ganze Intent): **null
  Befunde gegen die Kriterien** — Konvergenz 2 → 1 → 0. Fakten: Suite 59
  Dateien / 744 Tests / 743 grün / 1 rot (= Vorbestand 0113, erneut auf
  `origin/main` verifiziert), Lint/Typecheck Exit 0. Eigene Angriffs-Repros
  des Reviewers auf die Entdopplung hielten (angehobener Link-Bound
  entdoppelt wertgleich; Entry + zwei Links → 1; erfüllte Pflicht → 0). Zwei
  Blast-Radius-Beobachtungen außerhalb der Intent, kein Fix in diesem Lauf:
  - **E7:** Auch **verschachtelte** `entryLink`s mit eigenem `min` bekommen
    jetzt Phantome (main 0 → HEAD 1) — stellt Gleichbehandlung mit
    verschachtelten `selectionEntry`s her (die meldeten schon auf main).
    Als Default akzeptiert: kein falsches Ergebnis nachweisbar, §9.9/ADR-0032
    unverletzt.
  - **E9:** Huckepack-MAX am Link-Phantom — Wurzel-Link mit `min=1` UND
    `max=2`, Ziel 3× über den planen Eintrag im Roster → neuer MAX-Verstoß
    (main 0 → HEAD 1). Konsistent mit dem dokumentierten
    Entry-Phantom-Huckepack, aber ob das Referenzprogramm Grenzen eines nicht
    gewählten Links auswertet, ist unbelegt. Latent (kein Fixture-Muster).
    **Als Issue 0114 gefiled** und dem Menschen im PR sichtbar gemacht.
- **2026-07-29, Version-Bump-Entscheidung** (Default): kein Bump — die
  Reinraum-Engine ist vor dem Cutover nicht in der Oberfläche verdrahtet,
  die Änderung ist für Nutzer unsichtbar (CLAUDE.md: Bump nur bei sichtbarer
  Änderung).

## Checkpoints

### Before implementation

- **Does this match what was asked?** Ja. Die vier Kriterien decken den Fund:
  Wurzel-`entryLink`-Pflicht meldet (1), Link-Grenzen/-Modifier statt
  Ziel-Grenzen (2), Entdopplung über die Ziel-Id (3), Suite grün (4). Der
  Lösungsweg (Wurzel-Definitionsliste + `ownLimitsOnly`-Phantom + Entdopplung
  in der Meldungsliste) folgt §9.9 und den bestehenden Mechanismen.
- **What surprised me?** Der `ownLimitsOnly`-Mechanismus existiert schon
  (Gruppen-Anker, Issue 083) — die im Log als „belegt falsch" gemessene naive
  Lösung braucht also keinen neuen Mechanismus, nur den Zuschnitt des Phantoms.
  Und: der Kommentar an `constraints.js` (`countedTargetId`) benennt den
  §9.9-Entdopplungsschlüssel bereits, die Meldungsliste nutzt ihn aber bisher
  nur für Kategorie-Anker.
- **What am I assuming without having verified it?** (a) Dass `effectiveState`
  die Grenzwerte eines `ownLimitsOnly`-Phantoms korrekt herleitet — belegt nur
  indirekt über die Gruppen-Anker-Tests. (b) Dass kein bestehendes
  E2E-Szenario die Ogerbullen-Zeile (4 → 5 Verstöße im leeren
  Standard-Kontingent) festschreibt — das Log belegt Suite-Grün nur für den
  naiven Patch. Beides prüft der Suite-Lauf (Kriterium 4).

### Before the PR

- **Does this match what was asked?** Ja. Alle vier Kriterien sind erfüllt
  und von Review Runde 3 (frischer Kontext, null Befunde) bestätigt:
  Link-Pflicht meldet (roster + force), Link- statt Ziel-Grenzen, Entdopplung
  über die Ziel-Id, Suite belegt (einziger Rotstand = verifizierter
  Vorbestand 0113, identisch auf `origin/main`).
- **What surprised me?** Die Entdopplung brauchte zwei Nachschärfungen (B1:
  Feld, F1: Bound + Fremd-Anker), bis sie nur noch „dieselbe Pflicht in
  zweiter Kodierung" traf — der §9.9-Satz ist enger, als der erste Schlüssel
  ihn las. Und: `main` war schon vor dem Lauf rot (0113), was das Log vom
  Vortag („Exit 0") überholt hat.
- **What am I assuming without having verified it?** (a) Dass das
  Referenzprogramm die Grenzen eines nicht gewählten Links nicht anders
  behandelt als unser Huckepack-MAX (E9) — bewusst offen gelassen, als Issue
  0114 gefiled. (b) Dass die `.ros`-Konvention „Auswahl über den Link trägt
  die Link-Id" (rosParser) auch für künftige Importpfade gilt — gestützt auf
  `rosParser.entryLinkId.test.js`, nicht auf reale Fremd-Roster.

## Retro

- **Was im Weg stand:**
  - Die Metis-Agenten lagen als Verzeichnisse (`~/.claude/agents/<name>/agent.md`)
    vor und waren dem Harness beim Sessionstart nicht als Subagent-Typen
    bekannt — der erste Dispatch schlug fehl (Fallback: general-purpose mit
    der Rollendefinition im Prompt); später in der Session waren sie
    registriert. Der SessionStart-Selbstcheck („4 agents reachable") prüft
    nur die Links, nicht die Registrierung → Kandidat für einen Fix im
    `metis`-Repo (Agenten als flache `.md` ablegen oder den Selbstcheck
    ehrlicher machen).
  - `main` war schon vor dem Lauf rot (0113) — Kriterium 4 („Suite bleibt
    grün") musste als „kein neuer Rotstand, Vorbestand verifiziert"
    präzisiert werden. Formulierungs-Lehre für künftige Kriterien: „grün"
    relativ zur Basis (`origin/main`) formulieren.
  - Der Stop-Hook verlangte Commits, während Subagenten mitten im Edit
    waren — gelöst durch selektive Commits nur der sicheren Dateien.
  - Werkzeug-Reibung: das Edit-Tool kann Zeilen mit literalen
    ` `-Escapes nicht treffen (zweimal aufgetreten, Umweg über
    perl/Python nötig).
- **Was gut lief:** Die Vorrecherche im Issue (naiver Patch belegt falsch,
  `ownLimitsOnly` als vorhandener Mechanismus) machte die Implementierung
  zielgenau; die Review-Runden konvergierten sauber (2 → 1 → 0), und beide
  Nachschärfungen der Entdopplung kamen aus Reviewer-Repros statt aus
  Spekulation.
