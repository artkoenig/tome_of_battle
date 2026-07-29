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

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
