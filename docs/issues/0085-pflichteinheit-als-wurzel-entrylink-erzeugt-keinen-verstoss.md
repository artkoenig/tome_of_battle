---
status: active
branch: claude/85-umsetzen-0cru2t
pr:
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

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
