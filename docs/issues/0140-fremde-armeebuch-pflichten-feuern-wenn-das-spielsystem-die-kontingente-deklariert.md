---
status: active
branch: claude/ergofang-vampire-fehler-6vva1b
pr:
---

# Fremde Armeebuch-Pflichten feuern, wenn das Spielsystem die Kontingente deklariert

## Intent

Ein leeres Vampire-Counts-Roster (ergofang, Kontingent „Standard", 0/2000 Punkte)
meldet im Lagerbericht sieben Fehler, von denen **fünf einem fremden Armeebuch
gehören** — gemeldet vom Maintainer per Screenshot:

| Meldung | Herkunft der Definition | gehört ins VC-Roster? |
|---|---|---|
| „needs at least 3 × Core" | Spielsystem | ja |
| „needs a General" | Spielsystem | ja |
| „Who Is the general? Nobody knows, roll the dice to see what it shows." | `High Elf.cat` | **nein** |
| „needs a Bulls" | `Ogre Kingdoms.cat` | **nein** |
| „needs at least 3 × Chaos Dwarf Warrior" | `RH Chaos Dwarfs.cat` | **nein** |
| „needs a Tomb kings General" | `Tomb Kings.cat` | **nein** |
| „needs a Hierophant" | `Tomb Kings.cat` | **nein** |

Reproduziert an den echten ergofang-Katalogdaten (alle 16 `.cat` plus die `.gst`
des Forks `artkoenig/Warhammer-Fantasy-6th-edition`, Roster = ein leeres
Kontingent `7d9d-6c8d-4ea0-b7ad`): der Bericht trägt genau diese sieben
Verletzungen, alle mit `scope="roster"`.

Die Engine hat für genau diesen Fall bereits einen Katalog-Bezugsrahmen
(`isInCatalogueScope`, Issue 0098): eine Pflicht eines fremden Armeebuchs soll in
einem Kontingent, das nicht aus diesem Buch stammt, weder erzwungen noch
angeboten werden. Der Rahmen greift hier aber nicht, weil er das Armeebuch eines
Kontingents **allein aus den Katalogdaten** ableitet
(`buildPrimaryCatalogueIndex`: nur `forceEntry`s, die in einer `.cat` stehen).
Die ergofang-Kataloge deklarieren ihre Kontingente jedoch in der
**Spielsystemdatei** — der Index kennt das Kontingent `7d9d-…` also nicht, die
Referenzmenge bleibt leer, und `isInCatalogueScope` fällt bestimmungsgemäß
**offen** aus: keinerlei Filterung. Dieselbe leere Referenzmenge trifft die
Angebots-Schicht (`offer.js`), die den Wurzel-Einträgen fremder Armeebücher damit
ebenfalls einen Slot gibt.

Welches Armeebuch gemeint ist, weiß das Roster selbst: jedes Kontingent trägt
seinen Katalog (`force.catalogueId` im App-Modell, `catalogueId`-Attribut am
`<force>` einer `.ros`). Diese Angabe erreicht die Engine bisher nicht.

Gewünschtes beobachtbares Verhalten: Im Lagerbericht eines Vampire-Counts-Rosters
stehen nur Pflichten, die dem Vampire-Counts-Buch oder dem Spielsystem gehören.

Acceptance criteria:

1. Trägt ein Kontingent des Rosters die Id seines Armeebuchs, benutzt die Engine
   **diese** als sein Armeebuch — auch dann, wenn die Kontingent-Definition aus
   der Spielsystemdatei stammt und deshalb in keinem `.cat` steht.
2. Ein leeres ergofang-VC-Kontingent (`7d9d-6c8d-4ea0-b7ad`, Katalog
   `ea4b-9294-3427-1fc1`) über dem vollständigen ergofang-Datensatz meldet die
   Pflichten des Spielsystems (`General`, `Core`) und **keine** der fünf
   fremden Pflichten aus obiger Tabelle.
3. Für dasselbe Kontingent bietet die Engine keinen Wurzel-Eintrag eines fremden
   Armeebuchs als Slot an.
4. Trägt ein Kontingent des Rosters **keine** Armeebuch-Id, bleibt das Verhalten
   unverändert: es gilt der bisherige Herkunftsindex aus den Katalogdaten, und
   ist auch der ohne Antwort, filtert die Engine wie bisher nicht.
5. Enthält ein Roster zwei Kontingente aus **verschiedenen** Armeebüchern, gilt
   für jedes sein eigenes Buch: eine Pflicht des einen Buchs feuert nicht wegen
   des anderen Kontingents, und ein roster-weiter Bezugsrahmen umfasst beide
   Bücher.
6. Der Bezugsrahmen `primary-catalogue` beantwortet dieselbe Frage aus derselben
   Quelle: trägt ein Kontingent seine Armeebuch-Id, löst der Rahmen darüber auf,
   statt ihn als `unresolvedScope` zu melden.
7. Die App reicht die Angabe durch: eine im App-Roster gesetzte Armeebuch-Id
   eines Kontingents kommt in der Auswertung an.
8. Die bestehenden Testschichten bleiben grün (`npx vitest run src/evaluator`,
   `npm test`).

## Plan

## Tasks

## Decisions

- **~~Die Angabe des Rosters schlägt den Herkunftsindex.~~ Revidiert (siehe
  unten): der Index schlägt das Roster, wo er antwortet.**
- **Der Herkunftsindex antwortet zuerst; das Roster füllt nur die Lücke.**
  Quelle: das E2E-Szenario `docs/testing/primary-catalogue-scope`, Roster 10 —
  ein Black-Box-Fall, der genau den Widerspruchsfall aus den Katalogdaten
  ableitet: eine VC-Kontingent-**Definition**, deren `.ros` `catalogueId="Ogre
  Kingdoms"` behauptet, bleibt Vampire Counts. Das ist richtig: steht die
  Kontingent-Definition in einem Armeebuch, *ist* sie dessen Kontingent, und ein
  widersprechendes Roster-Attribut ist Metadatenmüll. Die ursprüngliche
  Vorrangregel war eine Vermutung ohne Beleg; dieses Szenario ist der Beleg
  dagegen. Für ergofang ändert das nichts — dort schweigt der Index, also
  antwortet das Roster, und genau das ist der Defekt dieses Issues.
- **Ein Bibliothekskatalog ist nie ein fremdes Armeebuch.** Quelle: der schon
  festgelegte Vertrag aus Issue 0121, Task 19, Punkt 5 — „Spielsystem- und
  Bibliothekseinträge erscheinen weiterhin überall"
  (`CategoryUnitAdder.forceCatalogue.test.jsx`), plus Kriterium 10 aus Issue
  0135. Ohne Ausnahme verliert ein Kontingent mit `.gst`-Kontingent-Definition
  seine Söldner-/Bibliotheksangebote — eine Regression, die der Filter vor
  diesem Issue nur deshalb nicht auslöste, weil er dort gar nicht griff.
  `isInCatalogueScope` nimmt Bibliothekskataloge deshalb ebenso aus wie das
  Spielsystem. In den ergofang-Daten gibt es null `library="true"`-Kataloge; die
  Ausnahme kann den gemeldeten Fehler also nicht wieder einschleppen.
- **Der Adapter liest nur `force.catalogueId`, ohne Rückfall auf
  `roster.catalogueId`.** Quelle: Vorgabe, revidiert gegen die frühere
  Entscheidung unten. `roster.catalogueId` ist das Buch der **Liste**; auf ein
  Kontingent angewandt, das keines nennt, ordnete es einem verbündeten
  Kontingent das falsche Buch zu — aktiv falsch gefiltert ist schlechter als
  ungefiltert. `buildRoster` setzt das Feld je Kontingent seit jeher, also ist
  kein reales Roster betroffen.
- **`primary-catalogue` wird mitgezogen (Kriterium 6).** Quelle: Vorgabe, ohne
  Rückfrage. Zwei verschiedene Antworten auf „aus welchem Armeebuch stammt
  dieses Kontingent?" in einer Engine wären eine Bruchstelle. Risiko geprüft:
  die ergofang-Kataloge enthalten **null** Vorkommen von
  `scope="primary-catalogue"` (`grep -c` über alle 17 Dateien), in den
  Definitive-Edition-Katalogen stehen die Kontingente in den `.cat`s und der
  Index antwortet dort schon heute gleich — die Änderung kann dort also keine
  andere Antwort erzeugen.

- **~~Der Adapter liest `force.catalogueId ?? roster.catalogueId`.~~ Revidiert
  (siehe oben): nur `force.catalogueId`.** Ursprüngliche Quelle: das
  App-Schreibmodell wendet den Rückfall an (`useRoster.js:164`,
  `rosterSerialization.js:132`). Verworfen, weil der Rückfall ein verbündetes
  Kontingent dem Buch der Liste zuschlüge.

- **Eine Armeebuch-Id, die der Datensatz nicht kennt, zählt wie keine Angabe.**
  Quelle: Vorgabe, unbeantwortet — vom `test-author` als offene Randfrage
  gemeldet. Sonst hätte ein Kontingent, dessen Katalog nicht geladen ist, eine
  Referenzmenge ohne jeden Treffer, und der Filter schlösse **alles** aus: ein
  still leeres Armeebuch. Der Rahmen fällt seit Issue 0098 bei fehlender Angabe
  bewusst offen aus; eine unbekannte Id ist derselbe Fall — sie fällt auf den
  Herkunftsindex zurück und, wenn auch der schweigt, offen aus.
- **Ein Bibliothekskatalog als Armeebuch eines Kontingents bekommt keine
  Sonderregel.** Quelle: Vorgabe, unbeantwortet. `buildCatalogueRootEntryClosure`
  führt Bibliotheken ohnehin; ob ein Roster so etwas deklarieren darf, entscheidet
  dieses Issue nicht.

## Log

- Reproduktion an den echten ergofang-Daten (Fork-Stand vom 2026-07-31):
  `prepareDataset` + `evaluate` über `.gst` + 16 `.cat`, Roster = ein leeres
  Kontingent `7d9d-6c8d-4ea0-b7ad` → 7 Verletzungen, identisch zum Screenshot.
  `primaryCatalogueByForceDefId` hat dabei **eine** Zuordnung (für ein
  Kontingent, das ein einzelner Katalog selbst deklariert); das
  VC-Kontingent ist nicht darunter.
- Der `implementer` meldete die Umsetzung als **blockiert** mit drei
  Kollisionen; alle drei sind oben entschieden. Belege, die dabei entstanden:
  Szenario 10 aus `primary-catalogue-scope` kippte allein durch das Lesen des
  `catalogueId`-Attributs im `.ros`-Leser (`e575-…` verschwand, `b830-…` feuerte
  neu); elf UI-Tests in drei Dateien fielen, ausnahmslos daran, dass
  Bibliothekseinträge aus dem Angebot verschwanden bzw. eine Vorbedingung
  „der Bericht bietet die fremde Einheit an, die Oberfläche blendet sie aus"
  nicht mehr gilt.
- Herkunft der fünf fremden Anker per `sourceIdByDefId` bestätigt:
  `7754-…` → Ogre Kingdoms, `9e4b-…` → RH Chaos Dwarfs, `4cea-…`/`4e75-…` →
  Tomb Kings, `a4dc-…` → High Elf; `a37e-…` (General) → Spielsystem.

## Checkpoints

### Before implementation

- **Does this match what was asked?** Ja. Der Maintainer meldete „ergofang
  Vampire, falsche Fehler" mit Screenshot; die sieben Meldungen sind an den
  echten Katalogdaten exakt reproduziert, und die Kriterien benennen genau die
  fünf, die verschwinden müssen, samt der zwei, die bleiben müssen.
- **What surprised me?** Zweierlei. Erstens: die Engine hat den nötigen Filter
  seit Issue 0098 — er fällt hier nur still offen aus, statt zu greifen; der
  Defekt ist kein fehlendes Konzept, sondern eine leere Eingabe. Zweitens: die
  Definitive-Edition-Kataloge deklarieren ihre Kontingente in den `.cat`s, die
  ergofang-Kataloge in der `.gst` — die gesamte bestehende E2E-Abdeckung läuft
  auf DE-Daten und konnte diesen Pfad deshalb nie treffen.
- **What am I assuming without having verified it?** Dass gespeicherte
  Alt-Roster in IndexedDB durchweg ein `catalogueId` je Kontingent tragen. Falls
  nicht, greift Kriterium 4 (unverändertes Verhalten ohne Angabe) — der Fehler
  bliebe für ein solches Roster bestehen, verschlimmert sich aber nicht.

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
