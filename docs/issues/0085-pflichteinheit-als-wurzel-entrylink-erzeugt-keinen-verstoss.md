---
status: active
branch: claude/noch-zu-tun-x7e3rw
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
`PHANTOM_DEFINITION_KINDS` (`src/evaluator/resolver.js:83`) enthält kein
`ENTRY_LINK`, und `collectRootDefinitions` (`resolver.js:135`) bricht bei einem
Wurzel-Link sofort ab — samt seiner Kinder. Ein Wurzel-`entryLink` mit
`min ≥ 1` (`scope="roster"` oder `"force"`) bekommt deshalb kein
Pflicht-Phantom; sein Angebots-Anker ist per ADR-0035 nie berichtsfähig.
Ergebnis: eine Liste ohne die Pflichteinheit meldet **null** Verstöße.

*Korrigiert nach der Recherche vom 2026-07-29 (siehe Log): die ursprünglich
notierten Zeilennummern waren um ~10 verrutscht, und „`armeeLevelCandidates`
(resolver.js:656)" traf nichts — die Funktion heißt `collectArmyLevelCandidates`
(`resolver.js:172`). Der Abbruch in `collectRootDefinitions` ist zudem
**Absicht** (ADR-0032), nicht Versehen: hinter einem Link liegende Einträge
dürfen keine falsche Pflicht synthetisieren. Die Lösung darf ihn deshalb nicht
einfach aufheben.*

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
   ohne erfüllte Bedingung entsteht kein Verstoß. Insbesondere feuert eine
   **eigene `min`-Grenze des Ziels** an dieser Wurzelform *nicht* mit — ein
   Wurzel-Link `min=1` auf ein Ziel mit eigenem `min=3` erzeugt **einen**
   Verstoß gegen 1, nicht zwei. (Nach der Recherche ist genau das die
   Bruchstelle der naheliegenden Lösung; deshalb hier ausgeschrieben.)
3. Führt ein Katalog dieselbe Pflicht in beiden Wurzelformen, wird über die
   Ziel-Id entdoppelt: genau ein Verstoß (§9.9). Maßgeblich ist die Ziel-Id
   **plus Rahmen** — die beiden Wurzelformen tragen verschiedene Grenz-Ids, die
   vorhandene Entdopplung über `(limitId, countedTargetId)` trennt sie also.
4. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28), Fund mit ausgeführtem Repro gegen die echte Fassade.

Entschieden vor der Umsetzung (2026-07-29), auf der Recherche im Log:

- **D1 — beide Rahmen, belegt nur einer.** Der Intent nennt `roster` und
  `force`; die echten Kataloge liefern nur `force` (Ogerbullen). Beide werden
  unterstützt — der Syntheseweg ist ohnehin je Rahmen derselbe. Belegt wird
  `force` am E2E-Szenario mit echten Katalogdaten, `roster` an einem
  Unit-Test. **Default**, weil kein Datum die `roster`-Form widerlegt oder
  bestätigt.
- **D2 — der Wurzel-Link-Anker wertet nur die *eigenen* Grenzen des Links
  aus**, nicht die per `limitsOf` (`evalTree.js:180`) vom Ziel geerbten. Das ist
  §9.9 wörtlich und zugleich genau die Stelle, an der die naheliegende Lösung
  bricht (Log: zwei Verstöße statt einem). Die Modifikator-Vererbung
  (`inheritedThenOwn`, `modifiers.js:634`) bleibt **unangetastet**: ein
  Modifikator des Ziels kann nur Grenz-Ids des Ziels adressieren, und die wertet
  dieser Anker nicht aus — Kriterium 2 hält also, ohne an der Modifikatorschicht
  zu drehen. Vorbild für den Zuschnitt ist `limitScopeFilter`
  (`evalTree.js:110`), das dieselbe Trennung schon für Rahmen macht.
- **D3 — Entdopplung über die *aufgelöste* Ziel-Id plus Rahmen.** Nicht über die
  rohe `targetId`: bei einer Link-auf-Link-Kette laufen beide auseinander
  (Berührung mit Issue 0094), und die aufgelöste Id ist die, die die andere
  Wurzelform (ein Wurzel-`selectionEntry`) als eigene `def.id` trägt. Nur über
  sie treffen sich die beiden Formen überhaupt.
- **D4 — `PHANTOM_DEFINITION_KINDS` bleibt, wie es ist.** `ENTRY_LINK` dort
  aufzunehmen ließe die Traversierung in die Kinder des Links absteigen und
  synthetisierte genau die falschen Pflichten, die ADR-0032 ausschließt
  (abgesichert in `crossCatalog.test.js:109-142`). Die Wurzel-Links werden
  stattdessen getrennt eingesammelt.
- **D5 — Abwesenheit zählt über Link-Id *und* aufgelöste Ziel-Id.** Eine reale
  Auswahl durch einen Wurzel-Link trägt die **Link-Id**, nicht die Ziel-Id —
  belegt an `docs/testing/explorer-force-constraints/rosters/02-three-special-legal.ros:7`
  (`entryId="d82e-111e-89b9-2be1"` = die Link-Id, Ziel ist
  `7754-8b3d-df99-d2d5`). Führt ein Katalog beide Wurzelformen, kann dieselbe
  Einheit aber unter der Ziel-Id im Roster stehen; zählte der Anker nur die
  Link-Id, feuerte er dann fälschlich. Beide Ids zählen deshalb.

Entschieden nach den Tests (2026-07-29) — der `test-author` hat fünf Kanten
zurückgegeben, die die Kriterien nicht entscheiden, statt sie zu raten:

- **D6 — „Rahmen" heißt konkrete Kontingent-Instanz, nicht Rahmen-*art*.** Zwei
  leere Kontingente erzeugen zwei Verstöße. Das ist keine neue Regel, sondern
  die, nach der die `selectionEntry`-Wurzelform schon heute arbeitet
  (`synthesizeMandatoryPhantoms` hängt je `forceNode` einen eigenen Anker,
  `evalTree.js:330-338`). Die Link-Form derselben Pflicht darf sich nicht anders
  verhalten als die Eintrags-Form.
- **D7 — bei der Entdopplung überlebt die *erste* Meldung in Berichtsreihenfolge**,
  nicht die des Links oder die des Eintrags nach fester Präferenz. Grund: die
  vorhandene Entdopplung `dedupeArmyWideCategoryViolations` (`report.js:149`)
  arbeitet genau so, und zwei Entdopplungen mit gegenläufiger Vorzugsregel im
  selben Bericht wären eine Falle. **Default** — kein Datum entscheidet, welche
  der beiden Grenz-Ids die „richtige" ist.
- **D8 — der Name des Ankers ist der eigene Name des Links, sonst der des
  Ziels.** §9.9 löst das Ziel „nur zur Namensauflösung" auf; das ergibt nur
  Sinn, wenn der Linkname Vorrang hat und die Auflösung die Lücke füllt.
  **Default.**
- **D9 — ein Wurzel-`entryLink` auf eine `selectionEntryGroup` gehört nicht in
  diesen Lauf.** Zusammen mit dem Nebenbefund aus der Recherche (auch
  Wurzel-*Gruppen* bekommen heute kein Phantom, `GROUP` fehlt in
  `PHANTOM_DEFINITION_KINDS`) ist das eine eigene Lücke mit eigener Frage. Wird
  als eigenes Issue gefiltert.
- **D10 — „vorhanden, aber zu wenige" bleibt unangetastet.** Die Kriterien
  sprechen von „fehlt ganz". Steht eine Instanz im Roster, wird die Grenze wie
  bisher am realen Knoten ausgewertet — dieser Lauf ändert **nur** den
  Abwesenheitsfall. Ausdrücklich festgehalten, damit niemand später eine
  stillschweigende Verhaltensänderung an realen Knoten hier hineinliest.

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

- **2026-07-29, Tests und E2E-Szenario** (beide aus frischem Kontext, ohne
  Blick auf eine Umsetzung).
  - **23 rote Tests** in `evaluator.rootEntryLinkMandatory.test.js` (18,
    synthetische Kataloge) und `evaluator.rootEntryLinkMandatoryFixture.test.js`
    (5, echte Fixture-Daten). Jede Fehlermeldung ist ein **fehlender** Verstoß —
    kein Import-, Parse- oder Setup-Fehler. Ausgangslage per Exitcode:
    `npx vitest run src/evaluator` → 54 Dateien, 727 Tests, 704 grün.
  - **Jeder Negativfall trägt eine zweite, unabhängige Wurzel-Link-Pflicht als
    Positivkontrolle.** Ohne sie wäre „kein Verstoß" heute trivial erfüllt und
    der Test zahnlos — genau der Fehler, den Issue 077 erst im letzten Moment
    gefunden hat. Hier ist er vorweggenommen.
  - **Das E2E-Szenario `root-entrylink-mandatory` (5 Roster) unterscheidet
    3 von 5 gegen die heutige Engine.** Der Autor hat das offen berichtet statt
    es zu kaschieren: Roster 02 (Bullen vorhanden) und 03 („Ironskin Tribe",
    Bedingung greift nicht) fallen heute **nicht** — sie *können* es nicht, denn
    sie sagen Abwesenheit zu, und die Engine meldet ohnehin nichts. Ihr Zweck
    ist ein anderer: sie sind die Gegenprobe gegen eine Lösung, die die Pflicht
    *bedingungslos* feuern lässt. Das Szenario prüft also nicht nur, dass etwas
    entsteht, sondern auch, dass es an den beiden richtigen Stellen ausbleibt.
  - **Belegt gegen die Katalogdaten** (jeder Punkt am XML nachgeprüft, nicht
    übernommen): das Ziel `7754-8b3d-df99-d2d5` trägt **keine** eigene
    `force`- oder `roster`-Grenze, nur `scope="parent"`. Der Modifikator
    `set 1` auf `32ed-26da-3f27-5c04` ist der einzige im ganzen Fixture-Satz,
    der dieses Feld schreibt, und die `forceEntry`-Gruppe des „Ironskin Tribe"
    enthält nur Kategorie-Modifikatoren, keine Anhebung.
  - **Annahme (c) aus Checkpoint 1 ist beantwortet, und zwar mit Nein.** Der
    Ogre-Katalog führt zwar *beide* Wurzelformen — neben dem Link auch den
    Wurzel-Eintrag `8e1e-60e8-f125-780d` mit unbedingtem `min 1 scope="force"` —
    aber für **verschiedene** Pflichten. Kriterium 3 (Entdopplung derselben
    Pflicht in beiden Formen) hat also keinen echten Katalogfall und bleibt
    zu Recht am synthetischen Katalog gezeigt.
  - **Bewusst nicht zugesagt:** keinerlei `diagnostics`-Zusage im Szenario. Der
    Autor hatte keine aus den Daten ableitbare Grundlage für die
    Einengungsschlüssel und hat deshalb gar nichts zugesagt, statt zu breit
    zuzusagen. Das ist die Lehre aus Issue 077, richtig angewandt.

- **2026-07-29, Umsetzung — und ein Blocker, der eine ältere Lücke aufdeckte.**
  - Umgesetzt in drei Teilen nach D2/D4/D6/D7: der Resolver sammelt Wurzel-Links
    in eine **eigene** Sicht `rootEntryLinks` (nicht in die Wurzel-Definitionen,
    D4); `evalTree` bekommt `synthesizeRootEntryLinkPhantoms`, dessen Anker
    doppelt zugeschnitten ist — vorhandener `limitScopeFilter` **plus** neues
    `ownLimitsOnly`, das die vom Ziel geerbten Grenzen auslässt (D2, genau die
    dokumentierte Bruchstelle); `report.js` bekommt eine zweite Entdopplung über
    `(Rahmen, aufgelöste Ziel-Id)` (D3/D7).
  - **Der Implementer meldete sich blockiert statt zu raten** — richtig so. Das
    Szenario sagte für Roster 03 („Ironskin Tribe", Bedingung greift nicht) die
    Ankerart `offerAnchor` zu; die Engine liefert `mandatoryPhantom`. Alle
    übrigen Felder stimmten, auch `isMandatoryUnmet: false`.
  - **Selbst nachgeprüft, mit eigenem Probe-Katalog ohne einen einzigen
    `entryLink`:** Wurzel-`selectionEntry`, `min="0" scope="force"`, leeres
    Kontingent →
    `anchorKind "mandatoryPhantom", effectiveMin 0, isMandatoryUnmet false,
    violations: []`. Das Verhalten ist also **vorbestehend** und trifft die
    Eintrags-Form genauso. D6 verbietet, die Link-Form davon abweichen zu
    lassen.
  - **Woher der Irrtum kam.** Der E2E-Autor leitete die Zusage aus dem
    Präzedenzfall „Manbiters" in `offer-and-category-slots` ab — einem
    Wurzel-Link, der `offerAnchor` trägt. Der Schluss trägt nicht: „Manbiters"
    hat **gar keinen** `min`-Constraint, `32ed-…` hat einen, der nur auf 0
    steht. Zwei verschiedene Fälle. Der Autor hat hier aus **Engine-Verhalten**
    abgeleitet statt aus Katalogdaten — außerhalb seiner Leseerlaubnis, und
    genau deshalb ging es schief.
  - **Entschieden:** die Ankerart wird für diesen Fall **gar nicht** zugesagt —
    weder `offerAnchor` noch `mandatoryPhantom`. Weder die Katalogdaten noch die
    Kriterien dieses Issues entscheiden sie, und der `test-author` hatte sie
    ausdrücklich ungepinnt gelassen. `isMandatoryUnmet: false` trägt die Regel
    vollständig. Szenario, README und Testkatalog entsprechend korrigiert, mit
    Verweis auf das neue Issue.
  - **Nebenbefund, eigenes Issue 0108:** `AnchorKind.MANDATORY_PHANTOM` sagt im
    Vertragstext „Pflichtdefinition (`min > 0`)", wird aber am *Vorhandensein*
    einer MIN-Grenze aufgehängt, unabhängig vom effektiven Wert. Vertrag und
    Verhalten gehen seit jeher auseinander. Nicht mitbehoben: der Fund betrifft
    die `selectionEntry`-Form genauso und wäre dort eine Verhaltensänderung ohne
    Auftrag.
  - **Fakten nach der Auflösung:** `npx vitest run src/evaluator` → 54 Dateien,
    732 Tests, Exit 0. `npx vitest run src/evaluator/e2e.testcatalog.test.js` →
    131 Tests, Exit 0.

- **2026-07-29, Review Runde 1 — sieben Befunde, jeder mit Reproduktion.**
  Fakten: `npx vitest run` → 228 Dateien, 2350 Tests, **Exit 0**; `lint`,
  `typecheck`, `depcruise` je Exit 0; `measure-evaluator.js` → **0
  Drift-Meldungen**, Exit 1 nur an der dokumentierten 100-ms-Schwelle; `knip`
  zeilengleich zu `origin/main`.

  Triage:

  | # | Befund | Entscheidung |
  |---|---|---|
  | 1 | Rohes **NUL-Byte** in `report.js:227` — die Datei gilt `grep`/ripgrep seither als binär, jede Inhaltssuche überspringt sie stumm | **jetzt beheben** (` ` wie die Schwesterstelle drei Funktionen darüber) |
  | 2 | Zwei Wurzelformen mit **verschiedenen** Grenzwerten: die strengere Pflicht wird stumm verschluckt (gemeldet „0 von 1", verlangt sind 2) | **jetzt beheben**, siehe D11 |
  | 3 | „**aufgelöste** Ziel-Id" (D3) hat keinen Test mit Zähnen — Mutation auf rohe `targetId` läuft grün durch | **jetzt anpinnen** |
  | 4 | Die Zusicherung „ein Anker behält alle **eigenen** Grenzen" ist ungepinnt; ohne sie verschwindet ein echter Verstoß | **jetzt anpinnen** |
  | 5 | `limitScopeFilter` am neuen Anker ungepinnt; ein Link mit **beiden** Rahmen erzeugt ohne ihn doppelte Verstöße **und** eine unechte `unresolvedScope`-Diagnose | **jetzt anpinnen** |
  | 6 | Die beiden nach D5 benannten Tests **prüfen D5 nicht** — sie bleiben grün, wenn nur die Link-Id gezählt wird | **jetzt anpinnen** (beobachtbarer Effekt ist die doppelte Meldung) |
  | 7 | `hasOwnMinLimitInFrame` ungepinnt (nur überzählige Slots, keine Verstoßänderung) | **jetzt anpinnen** |

  Befund 3–7 sind allesamt derselbe Mangel: die Umsetzung ist richtig, aber
  **unbewiesen**. Sie sind genau das, wofür die Mutationsprobe da ist, und
  hätten ohne sie den PR erreicht.

- **D11 — verschiedene Grenzwerte sind nicht dieselbe Pflicht.** Die
  Entdopplung fasst zwei Wurzelform-Meldungen nur zusammen, wenn ihre
  **effektive Grenze gleich** ist. Sonst bleiben beide stehen. Grund: die
  Entdopplung existiert, damit **eine** Pflicht nicht zweimal erscheint (§9.9);
  zwei verschiedene Grenzwerte sind zwei verschiedene Aussagen, und die
  schwächere zu zeigen, während die strengere verschwindet, ist die schlechteste
  aller Ausgaben — der Nutzer erfüllt „0 von 1" und die Liste bleibt trotzdem
  illegal. D7 („die erste überlebt") galt stillschweigend nur für gleiche
  Grenzwerte; das war eine unerkannte Lücke in D7 und ist hiermit geschlossen.

- **D12 — die zwei fremden Armeebücher bleiben, wie sie sind (Default).** Die
  Wirkungsmessung des Reviewers über alle 127 Roster: 53 gewinnen neue
  blockierende Verstöße, davon drei **nicht** die Ogerbullen, sondern
  Wurzel-`entryLink`s namens **„Allow experimental rules?"** und **„Allow
  special characters?"** in Vampire Counts und Orcs & Goblins — Konfigurations-
  schalter, Basis `min 0`, per Link-Modifikator auf 1 gehoben. Sie fallen unter
  §9.9 wie jede andere Wurzelform: es sind echte Auswahlen, und „Allow special
  characters?" trägt sogar `defaultAmount="1"`, ein aus Battlescribe
  exportiertes Roster enthielte sie also. Unsere Testroster sind von Hand
  geschrieben und enthalten sie nicht — **das ist ein Artefakt der Fixtures,
  kein Fehler der Regel.** Deshalb keine Sonderbehandlung: eine Ausnahme für
  „sieht aus wie ein Schalter" hätte keine Grundlage in den Daten. **Als Default
  vermerkt** und dem Menschen offengelegt, weil es sichtbares Verhalten in zwei
  Armeebüchern ändert, die dieses Issue nie erwähnt.

## Checkpoints

### Before implementation

**Does this match what was asked?** Ja. Der Auftrag lautet, die Evaluator-Lücken
eine nach der anderen abzuarbeiten; dies ist die zweite. Die vier Kriterien
stehen, drei davon sind an echten Katalogdaten prüfbar. Zwei Korrekturen an der
Absicht waren nötig (Zeilennummern, und der Rahmen des Ogerbullen-Constraints
ist `force`, nicht `roster`) — beide oben eingearbeitet.

**What surprised me?** Dass der Abbruch, den der Intent als Fehler liest,
**Absicht** ist und von ADR-0032 gedeckt wird. Die naheliegende Lösung ist
belegt falsch und die bestehende Suite merkt es nicht: mit dem naiven Patch
liefen 48 Dateien / 649 Tests unverändert grün, obwohl er zwei Verstöße statt
einem erzeugt. Die Lücke sitzt also nicht dort, wo die Absicht sie vermutet.

**What am I assuming without having verified it?** Drei Dinge. (a) Dass die
`roster`-Wurzelform des Links überhaupt in freier Wildbahn vorkommt — kein
Katalog des Fixture-Satzes zeigt sie (D1, als Default vermerkt). (b) Dass ein
Wurzel-Link auf eine `selectionEntryGroup` nichts eigenes braucht; ungeprüft,
im Log als offener Punkt notiert. (c) Dass die Entdopplung aus Kriterium 3
keinen echten Katalogfall hat und deshalb an einem synthetischen Katalog
gezeigt werden muss — ob ein Fixture-Katalog dieselbe Pflicht doppelt führt,
ist ungeprüft geblieben.

### Before the PR

**Does this match what was asked?** Ja, und mehr als das: die vier Kriterien
halten, und zwei davon halten nachweislich erst seit der Review. Was **nicht**
zur Absicht gehört und trotzdem geschieht: drei Roster in Vampire Counts und
Orcs & Goblins bekommen neue blockierende Verstöße (D12). Das ist offengelegt,
als Default vermerkt und dem Menschen zur Umkehr angeboten — nicht stillschweigend
mitgenommen.

**What surprised me?** Dreierlei.

1. **Die Suite war grün und die Umsetzung trotzdem unbewiesen.** Fünf der sieben
   Befunde waren Mutationen, die glatt durchliefen. Ohne die Mutationsprobe wäre
   das so in den PR gegangen — inklusive der stumm verschluckten strengeren
   Pflicht (D11), die ein echter Nutzerschaden gewesen wäre.
2. **Der `test-author` hat meine Vorgabe widerlegt.** Mein Reproduktionsfall zu
   Befund 6 fängt keine der beiden Mutationen, weil `rosterIdentityIdsOf` die
   Link-Id immer enthält. Er hat den Fall neu gebaut (Kette `l1 → l2 → bulls`,
   in der rohe und aufgelöste Id auseinanderfallen) und den schwachen Test
   ausdrücklich als „reiner Pin, nicht mutationsempfindlich" gekennzeichnet,
   statt Deckung zu behaupten.
3. **Das E2E-Szenario ist schwächer, als es aussieht.** Der Reviewer hat gezeigt:
   die naive Lösung, die dieses Issue ausdrücklich ausschließt, lässt alle fünf
   Roster grün. Der Grund liegt in den Daten — das Ziel trägt keine eigene
   Rahmengrenze, das Szenario kann den Unterschied gar nicht sehen. Kriterium 2
   ruht vollständig auf dem synthetischen Unit-Test. Das ist keine Nachlässigkeit
   des Autors, sondern eine Grenze der echten Katalogdaten; festgehalten, damit
   niemand dem Szenario mehr Beweiskraft zuschreibt, als es hat.

**What am I assuming without having verified it?** Vier Dinge.

- **Dass die Schalter-Einträge („Allow special characters?") in echten,
  aus Battlescribe exportierten Rostern tatsächlich enthalten sind.** Abgeleitet
  aus `defaultAmount="1"`, **nicht** an einem echten Export geprüft — wir haben
  keinen im Repo. Trägt D12; fällt die Annahme, ist D12 neu zu bewerten.
- **Dass `result.bound` der richtige Gleichheitsbegriff für D11 ist.** Der
  Implementer schlüsselt auf den effektiven Wert, nicht auf `(Art, Wert)`. Seine
  Begründung — eine unerfüllte MAX-Grenze an einem Pflicht-Phantom mit Ist 0 ist
  nicht erreichbar — leuchtet ein, ist aber nicht durch einen Test belegt.
- **Dass die Ankerart-Frage (Issue 0108) folgenlos bleibt.** Der Reviewer hat
  gemessen, dass Slots von `offerAnchor` nach `mandatoryPhantom` kippen (je
  Messreihe rund ein bis drei). Sie werden dadurch berichtsfähig. Dass keiner
  davon eine unechte Meldung erzeugt, folgt aus „Exit 0" der Suite — aber die
  Suite deckt nicht jeden Katalog.
- **Dass D6 (gleiches Verhalten beider Wurzelformen) die richtige Leitplanke
  war.** Sie hat den Blocker entschieden. Sollte sich Issue 0108 gegen die
  heutige Einordnung entscheiden, ändern sich beide Formen gemeinsam — genau wie
  D6 es verlangt, aber dann eben auch die hier gerade festgeschriebene.

## Retro
