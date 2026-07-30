---
status: active
branch: claude/new-session-mn1zyq
pr:
---

# Wurzel-Einträge aller Kataloge werden katalogfremd gepoolt

## Intent

Das BSData-Wiki (*Data structure overview*, *Force Entry*): „All selections
within must originate from a single catalogue." `docs/battlescribe-data-format.md`
§7.2 zieht daraus: ein Roster aus Katalog X ist gegen einen Datensatz ohne X
nicht auswertbar. Die XSD kennt zudem `importRootEntries` am `catalogueLink`
(Default `false`) — Wurzel-Einträge eines verlinkten Katalogs gehören nur
dann zum Angebot, wenn es gesetzt ist. (Diese Semantik ist aus Attributname
und Default gefolgert; die XSD liefert nur Attribut + Default, Wiki und
kanonische Doku erwähnen `importRootEntries` nicht — upstream unbelegt,
§15-Lücke. Die Klärung gehört als Entscheidung in diesen Lauf.)

Die Engine poolt stattdessen alles: `mergeCatalogues`
(`src/evaluator/catalogSet.js:17`) konkateniert `entries`/`forces`/`categories`
aller Dokumente, `armyLevelCandidates` (`src/evaluator/resolver.js:656`) und
die Pflicht-Phantom-Quellen entstehen aus dem gemergten Wald;
`importRootEntries` wird gar nicht gelesen (`readCatalogueLinks`,
`catalogReader.js:792`). Bei einem Datensatz `{gst, [A.cat, B.cat]}` bietet
eine Force aus A auch Bs Wurzel-Einheiten an (die Kategorien sind geteilte
`.gst`-Ids, kategorielose Einträge passieren den Filter ohnehin), und ein
`min scope="roster"` aus B schlägt in einer reinen A-Liste an.

ADR-0032 deckt die Global-by-ID-**Auflösung** („catalogueLink ist reine
Abhängigkeits-Deklaration"), sagt aber nichts über das Pooling von
Wurzel-Einträgen, Forces und Roster-Mins über Katalog-Grenzen. Ob die App je
mehr als einen Armee-Katalog in einen Datensatz gibt, entscheidet über die
Dringlichkeit — die Fassade lässt es zu.

Acceptance criteria:

1. Wurzel-Einträge und Wurzel-Forces eines Katalogs erscheinen nur im Angebot
   von Kontingenten, zu deren Katalog sie gehören (Spielsystem und per
   `catalogueLink` mit `importRootEntries="true"` importierte Kataloge
   eingeschlossen).
2. Ein `min scope="roster"`-Wurzeleintrag aus Katalog B erzeugt keinen
   Verstoß in einer Liste, die keinen Bezug zu B hat.
3. `importRootEntries` wird gelesen; ein verlinkter Bibliothekskatalog mit
   `importRootEntries="false"` trägt keine Wurzel-Einträge ins Angebot bei.
4. Die Abgrenzung zu ADR-0032 (Auflösung bleibt global-by-ID) ist als
   Entscheidung festgehalten; falls die Untersuchung ergibt, dass Datensätze
   konstruktionsbedingt immer genau einen Armee-Katalog enthalten, ist das
   als dokumentierte Invariante festzuhalten und dieses Issue entsprechend zu
   schließen.
5. Die bestehende Suite bleibt grün — mit Kommando, Umfang und Exit-Code
   belegt.

## Plan

**Module list und Verträge:**

1. **`catalogReader.js`** — `readCatalogueLinks` liest zusätzlich
   `importRootEntries` (Boolean-Attribut, Default `false`, wie im XSD). Jeder
   Eintrag der zurückgegebenen `catalogueLinks`-Liste trägt fortan
   `{ id, name, targetId, importRootEntries }` statt `{ id, name, targetId }`.
   *Warum am Reader:* die einzige Stelle, die die rohen `catalogueLink`-Knoten
   überhaupt sieht; der App-eigene Schreib-Modell-Parser liest das Attribut
   bereits für einen anderen Zweck (siehe Decisions) — beide Leser bleiben
   unabhängig.

2. **`catalogSet.js`** — neue Funktion
   `buildCatalogueRootEntryClosure(catalogueDocuments): Map<catalogueId, Set<catalogueId>>`.
   Für jeden Katalog: die Menge der Katalog-Ids, deren Wurzel-Angebot er führt
   — sich selbst plus, transitiv und zyklensicher, jeden über einen
   `catalogueLink` mit `importRootEntries === true` erreichbaren Katalog.
   *Warum eine eigene Funktion neben `buildPrimaryCatalogueIndex`/
   `buildDefinitionSourceIndex`:* dieselbe Symmetrie — ein weiterer
   Herkunftsindex, der nur die **einzelnen** Dokumente kennt, nicht das
   Aggregat.

3. **`datasetPreparation.js`** — `prepareDataset` baut den Closure-Index mit
   und legt ihn auf `PreparedDataset` als `catalogueRootEntryClosureById`
   ab, zusammen mit der schon vorhandenen `gameSystemDocument`. Kein neues
   Feld für die Spielsystem-Id nötig — `gameSystemDocument?.id ?? null`
   genügt an der Verbrauchsstelle.

4. **`evaluator.js`** (`evaluate`) — baut aus den drei Indizes
   (`sourceIdByDefId`, `primaryCatalogueByForceDefId`,
   `catalogueRootEntryClosureById`) und der Spielsystem-Id ein
   **`catalogueScope`-Kontextobjekt** und reicht es zusätzlich an
   `buildEvalTree(resolved, roster, catalogueScope)` und
   `attachOfferAnchors(root, resolved, catalogueScope)` durch. *Warum ein
   gebündeltes Objekt statt vier Einzelparameter:* beide Empfänger brauchen
   dieselben vier Werte für dieselbe Frage („gehört Herkunft S zum
   Katalog-Fußabdruck von Kontingent-Katalog P?") — ein Parameter statt vier
   hält die Signaturen stabil, falls der Fußabdruck später einen weiteren
   Baustein braucht.

5. **`evalTree.js`** — `buildEvalTree`/`synthesizeMandatoryPhantoms` erhalten
   den optionalen vierten Parameter `catalogueScope`. Fehlt er (bestehende
   Direktaufrufe aus Unit-Tests ohne Mehrkatalog-Bezug), bleibt das
   Verhalten unverändert (ungefiltert) — die Filterung ist **additiv**, kein
   Verhaltenswechsel für den Ein-Katalog-Fall. Mit Kontext: eine
   ROSTER-Grenze zählt nur, wenn ihre Herkunft (`sourceIdByDefId.get(def.id)`)
   im Fußabdruck **irgendeines** im Roster tatsächlich vorhandenen
   Kontingents liegt (oder das Spielsystem ist); eine FORCE-Grenze nur, wenn
   sie im Fußabdruck **dieses** Kontingents liegt.

6. **`offer.js`** — `attachOfferAnchors`/`candidatesFor` erhalten denselben
   optionalen `catalogueScope`-Parameter und wenden dieselbe
   Fußabdruck-Prüfung zusätzlich zur bestehenden Kategorie-Prüfung
   (`isCarriedByForce`) an, bevor ein Kandidat als wählbar gilt.

7. **Gemeinsamer Helfer** — eine kleine, in `catalogSet.js` oder einem neuen
   `catalogueScope.js` exportierte Funktion
   `isSourceInFootprint(sourceId, catalogueId, catalogueScope)`, die beide
   Verbrauchsstellen (5, 6) gegen dieselbe eine Definition prüfen, statt die
   Fußabdruck-Logik zweimal zu schreiben.

**Nicht geplant / bewusst ausgeklammert:** Änderungen an der globalen
`entryLink`/`infoLink`-Auflösung (ADR-0032) — die bleibt unverändert
global-by-id; nur das *Anbieten* und das *Pflicht-Erzwingen* wird
katalog-lokal.

## Tasks

## Decisions

- **Herkunft:** Intensiv-Audit der Reinraum-Engine gegen die BSData-Doku im
  Repo (2026-07-28); Mechanismus am Code verifiziert, in den Fixtures latent
  (die Bibliothek `Mercenaries.cat` trägt keine Wurzel-Selektionen).
- **Kriterium 4, Ausweichklausel entfällt:** Datensätze mit mehr als einem
  Armee-Katalog sind über den normalen Import-Weg real erreichbar, nicht nur
  konstruiert. `Importer.jsx` (`buildAllSelectedCats`, Zeilen ~26–32 und
  ~152) lässt mehrere `.cat`-Dateien eines Bundles gleichzeitig auswählen;
  `db/systemImport.js:66` speichert sie undifferenziert als
  `system.rawXmls.cat`; `evaluation/evaluationCache.js:87-99` reicht **alle**
  gespeicherten `.cat`-Dateien ungefiltert an `prepareDataset`. Die
  WHFB6-Definitive-Edition-Fixture selbst belegt es: `Ogre Kingdoms.cat`,
  `Orcs and goblins.cat` und `Vampire Counts.cat` tragen je eigene
  Wurzel-`selectionEntries`/`forceEntries` und je einen `catalogueLink` zu
  `Mercenaries.cat` ohne `importRootEntries`-Attribut (Default `false`).
  Kriterium 4 schließt das Issue also nicht — es bleibt ein echter Fix.
- **Abgrenzung zu ADR-0032:** ADR-0032 entscheidet, *wie* eine Referenz ihre
  Ziel-Id über alle gegebenen Kataloge hinweg findet (eine globale
  `id→Definition`-Tabelle; `catalogueLink` „reine
  Abhängigkeits-Deklaration, nicht als eigener Auflösungsmechanismus").
  Es sagt nichts darüber, *ob* Wurzel-Einträge, Wurzel-Forces und
  roster-skopierte Mins eines Katalogs außerhalb seiner eigenen Kontingente
  angeboten bzw. erzwungen werden sollen — das ist die Lücke, die dieses
  Issue schließt. Die globale Referenz-Auflösung selbst bleibt unverändert.
- **`importRootEntries` bereits andernorts konsumiert, hier nicht:** Der
  App-eigene Schreib-Modell-Parser (`src/parser/xmlParser.js:584-594`) liest
  `importRootEntries` bereits (getestet in
  `xmlParser.staticAttributes.test.js:37-52`); eine frühere Entscheidung
  (`docs/issues/25-battlescribe-xsd-konformitaet/09-.../issue.md:42-45`)
  hatte seinen *Konsum* für den Library-Import-/targetId-Auflösungspfad der
  App bewusst als PRD-out-of-scope eingestuft. Das betrifft einen anderen
  Layer (App-Schreib-Modell) als hier (Evaluator-Lesepfad
  `catalogReader.js`/`readCatalogueLinks`) — beide Entscheidungen
  widersprechen sich nicht, sie gelten für unterschiedliche Konsumenten.
- **Vorhandene Infrastruktur nutzen:** `catalogSet.js` trägt seit Issue
  077/0121 bereits `buildPrimaryCatalogueIndex` (Force→Katalog) und
  `buildDefinitionSourceIndex` (Definition→Quelldokument), beide auf
  `PreparedDataset` verdrahtet (`primaryCatalogueByForceDefId`,
  `sourceIdByDefId`) und von `report.js`/`query.js` bereits konsumiert. Der
  Fix hier baut auf diesen Indizes auf, statt neue
  Herkunfts-Infrastruktur einzuführen.

## Log

- 2026-07-29 — Doku-Abgleich (Goal-Lauf „Behauptungen gegen bsdata prüfen"):
  Intent ergänzt — die `importRootEntries`-Semantik ist eine Ableitung aus
  Attributname/Default, keine dokumentierte Formataussage (Wiki und
  kanonische Doku schweigen); als solche gekennzeichnet.
- 2026-07-30 — **Überraschung beim Implementieren, Regel „Stop on Surprise/
  Regression".** Die katalog-lokale Filterung (Kriterium 1) bricht zwei
  bestehende, grüne E2E-Szenarien (`offer-and-category-slots` Regel OCS-R2,
  `violation-classification` Regel VCC-R11): „Manbiters" (`0efb-7f63-7932-0655`,
  eine `sharedSelectionEntry` in `Mercenaries.cat`) wird dort **bewusst und
  dokumentiert** unter dem Vampire-Counts-Kontingent „Clan Blood Dragons"
  (`5e95-7d57-2b9c-d77d`) angeboten — obwohl `Vampire Counts.cat` **keinen**
  eigenen Verweis auf `0efb-…` trägt. Der anbietende Wurzel-`entryLink`
  (`e3c2-1778-d3d5-edd1`) ist ausschließlich in `Orcs and goblins.cat`
  deklariert; das Angebot unter Blood Dragons entsteht **allein**, weil das
  Kontingent die geteilte `.gst`-Kategorie „Regiment of Renown" (`ee09…`)
  trägt — das von OCS-R2 selbst als das korrekte, geprüfte Verhalten
  festgehaltene Idiom für „jede Armee darf Söldner/Regiments of Renown
  nehmen". Keiner der drei Armee-Kataloge markiert seinen `catalogueLink` zu
  Mercenaries mit `importRootEntries="true"`.
  Das zeigt: der Mechanismus „Wurzel-`entryLink` auf eine geteilte Definition
  einer Bibliothek, angeboten ueberall dort, wo die Kategorie passt" ist ein
  **zweiter, von `importRootEntries` unabhaengiger** Weg, wie BSData-Autoren
  katalogübergreifende Inhalte modellieren — orthogonal zu dem in Kriterium 1
  beschriebenen Fall (Bs **eigene** Wurzel-Einheit taucht faelschlich unter A
  auf). Kriterium 1 in seiner jetzigen Formulierung („Wurzel-Einträge **und**
  Wurzel-Forces eines Katalogs erscheinen nur im Angebot von Kontingenten, zu
  deren Katalog sie gehören") trifft auf Wurzel-`entryLink`s wie
  `e3c2-1778-…` woertlich auch zu, wuerde hier aber ein als korrekt
  verifiziertes, dokumentiertes Verhalten abschalten. Menschliche Entscheidung
  angefragt (siehe Chat), bevor an der Kriteriums-Grenze weitergearbeitet
  wird.
- 2026-07-30 — **Entscheidung des Menschen:** Wurzel-`entryLink`s bleiben von
  der neuen Katalog-Filterung ausgenommen — nur eigenstaendige Wurzel-
  `selectionEntry`/`forceEntry`-Definitionen werden katalog-lokal gefiltert
  (Kriterium 1 dahingehend praezisiert: „Wurzel-Eintraege und -Forces" meint
  die eigenstaendig deklarierten, nicht die per Wurzel-`entryLink` auf eine
  geteilte Definition verweisenden). Umgesetzt in `offer.js`/`candidatesFor`
  und `evalTree.js`/`synthesizeMandatoryPhantoms`:
  `def.kind === DefinitionKind.ENTRY_LINK` schaltet die
  `isInCatalogueScope`-Pruefung unbedingt frei. Beide zuvor gebrochenen
  E2E-Szenarien (`offer-and-category-slots`, `violation-classification`)
  sind wieder gruen, ohne Aenderung an Fixture oder Doku — das bestaetigt,
  dass es sich um eine Praezisierung der Kriteriums-Grenze handelt, nicht um
  eine Aenderung an belegtem Verhalten.
- 2026-07-30 — Bsdata-Wiki-Submodul war eingangs uninitialisiert (Recherche
  konnte den §15-Lücke-Befund zu `importRootEntries` deshalb nicht direkt am
  Wiki-Text pruefen). Submodul jetzt ausgecheckt (`f4949c3a`, `master`):
  `grep -rl importRootEntries docs/bsdata-catalogue-development-wiki/`
  findet nichts — die Luecke ist damit am tatsaechlichen Wiki-Text bestaetigt,
  nicht nur aus dem Attributnamen gefolgert.
- 2026-07-30 — **Verifikation (Kriterium 5):** `npx vitest run
  src/evaluator`, 68 Testdateien, 853 Tests, Exit 0. `npm run lint`
  (oxlint), Exit 0. `npm run typecheck` (tsc --noEmit), Exit 0. Die
  Aenderung betrifft ausschliesslich `src/evaluator/`; der volle `npm test`
  (inkl. Puppeteer-E2E unter `e2e/`) ist damit laut CLAUDE.md nicht
  erforderlich.

## Checkpoints

### Before implementation

- **Does this match what was asked?** Ja — die Akzeptanzkriterien verlangen
  katalog-lokales Anbieten und Erzwingen, keine Änderung an der
  ID-Auflösung selbst.
- **Was hat überrascht?** Die Herkunfts-Infrastruktur
  (`buildPrimaryCatalogueIndex`, `buildDefinitionSourceIndex`) existiert
  bereits aus Issue 077/0121 — der Fix ist kleiner als der ursprüngliche
  Issue-Text nahelegt, weil er auf vorhandenen Bausteinen aufbaut statt
  neue Herkunfts-Verfolgung einzuführen.
- **Was nehme ich ungeprüft an?** Dass `importRootEntries` transitiv gilt
  (ein Bibliothekskatalog kann selbst per `catalogueLink` einen weiteren
  Katalog importieren) — dafür gibt es in den Fixtures kein Beispiel; die
  Closure-Funktion behandelt es trotzdem korrekt (BFS/DFS), falls es
  vorkommt. Außerdem, dass ein Kontingent ohne bekannten
  `primaryCatalogueByForceDefId`-Eintrag (z. B. eine im Spielsystem selbst
  deklarierte Force) ungefiltert bleibt, statt fälschlich alles
  auszuschließen — noch nicht an einer Fixture verifiziert.

### Before the PR

- **Does this match what was asked?** Ja, mit einer vom Menschen
  bestaetigten Praezisierung: Kriterium 1 filtert eigenstaendige
  Wurzel-`selectionEntry`/`forceEntry`-Definitionen katalog-lokal, nimmt
  Wurzel-`entryLink`s (Verweise auf geteilte/Bibliotheks-Definitionen)
  bewusst aus. Kriterien 2/3/5 wie formuliert erfuellt; Kriterium 4 als
  Decision samt Abgrenzung zu ADR-0032 festgehalten (kein Schliessen des
  Issues — die Ausweichklausel greift nicht, siehe Decisions).
- **Was hat ueberrascht?** Der reale WHFB6-Datensatz nutzt Wurzel-`entryLink`s
  auf geteilte Bibliotheks-Eintraege (Mercenaries/Regiments of Renown) als
  zweiten, von `importRootEntries` unabhaengigen Mechanismus fuer
  katalogübergreifende Inhalte — die urspruengliche Fix-Version brach zwei
  bestehende, mit echten Katalogdaten verifizierte E2E-Szenarien, bevor die
  Ausnahme eingebaut wurde.
- **Was nehme ich ungeprüft an?** Dass bei leerem Roster (keine Kontingente)
  die Filterung komplett entfaellt (ungefiltert wie zuvor) statt
  restriktiver zu werden — das haelt die Ein-Katalog-Regressionswache gruen,
  ist aber fuer den Mehrkatalog-Fall mit leerem Roster nicht durch einen
  Test belegt. Ebenso ungeprüft: ein Kontingent ohne bekannten
  `primaryCatalogueByForceDefId`-Eintrag bleibt ungefiltert (keine Fixture
  mit einer im Spielsystem selbst deklarierten Force). Und: transitive
  `importRootEntries`-Ketten (Bibliothek importiert Bibliothek) sind nur
  durch die Zyklensicherheit der Closure-Funktion abgedeckt, nicht durch
  einen eigenen Test — kein Fixture-Beispiel dafuer vorhanden.
- 2026-07-30 — Zweiter Doku-Abgleich, gezielt zu Entry-Link/Info-Link, gegen
  das ausgecheckte Submodul
  (`docs/bsdata-catalogue-development-wiki/Data-structure-overview.md:284-312`):
  die Wiki-Doku sagt woertlich, das Ziel eines `entryLink`/`infoLink` "must
  be from the shared lists contained in the same catalogue. Because of
  game-system level import, that also includes shared entries from game
  system catalogue". Ein `catalogueLink`-Ziel in einer anderen, nicht per
  Spielsystem verbundenen Catalogue (wie im Manbiters/Mercenaries-Fall) wird
  an keiner Stelle erwaehnt oder legitimiert — `catalogueLink` selbst kommt
  im gesamten Submodul kein einziges Mal vor (`grep -ril catalogueLink
  docs/bsdata-catalogue-development-wiki/` → keine Treffer). Die
  Community-Doku deckt also nur den Spielsystem-Import als
  Cross-Catalogue-Kanal fuer `entryLink`/`infoLink` ab; der
  catalogueLink-Kanal ist reines Implementierungsdetail des
  BattleScribe-Readers. Bestaetigt indirekt die Menschen-Entscheidung,
  Wurzel-`entryLink`s auszunehmen: der Fixture-Pfad ist von der Doku nicht
  abgedeckt, aber vom echten Reader offenkundig unterstuetzt. Keine
  weiteren Implementierungshinweise zu `importRootEntries`/Wurzel-Pooling im
  Submodul gefunden.
- 2026-07-30 — **Review-Runde 1 (frischer Kontext, `metis:reviewer`):**
  Suite/Statik von mir unabhaengig reproduziert (68 Dateien/853 Tests, Exit
  0; lint Exit 0; typecheck Exit 0). Alle 5 Kriterien als erfuellt bewertet.
  Ein Fund ausserhalb der Kriterien: root `categoryEntry`-Definitionen
  (`DefinitionKind.CATEGORY`) sind in `synthesizeMandatoryPhantoms` (beide
  Schleifen) und `candidatesFor` NICHT wie `ENTRY_LINK` von der neuen
  Katalog-Scope-Pruefung ausgenommen, obwohl das echte WHFB6-Fixture exakt
  dasselbe Cross-Catalogue-Idiom fuer Kategorien nutzt: `Mercenaries (6th
  definitive edition).cat` deklariert die Kategorien "Mercenaries"
  (`b640-…`) und "Regiment of Renown" (`ee09-…`) selbst, `Vampire Counts
  (6th definitive edition).cat` referenziert sie per eigenem `categoryLink`
  (Zeile ~29308) ohne jedes `importRootEntries="true"`. Kein bestehender
  Test bricht nur, weil diese beiden Kategorien im echten Datensatz zufaellig
  keine `min`-Constraint tragen; der Reviewer hat den Fehlerfall mit einer
  minimalen Nachbildung des exakt gleichen Musters (Kategorie mit
  roster-`min`, per `categoryLink` aus einer anderen Catalogue referenziert,
  Roster nur mit der referenzierenden Catalogue) reproduziert: die Verletzung
  bleibt faelschlich aus. Kriterien 1–3 nennen woertlich nur
  `selectionEntry`/`forceEntry`, daher verletzt der Fund keins woertlich —
  ist aber dieselbe Luecke, die die Menschen-Entscheidung fuer `ENTRY_LINK`
  bereits als real anerkannt hat, nur fuer `CATEGORY` noch offen. Triage:
  wird jetzt selbst behoben (kein Delegieren an `metis:implementer`, siehe
  Standing-Instruction), da der Parallel-Fall so direkt ist, dass eine
  inkonsistente Behandlung von `entryLink` vs. `categoryLink` keinen Sinn
  ergibt.
- 2026-07-30 — **Fund behoben (selbst implementiert):** In
  `evalTree.js`/`synthesizeMandatoryPhantoms` schaltet
  `def.kind === DefinitionKind.CATEGORY` die `isInCatalogueScope`-Pruefung
  jetzt genauso unbedingt frei wie `DefinitionKind.ENTRY_LINK`, in beiden
  Schleifen (ROSTER- und FORCE-Rahmen). `offer.js` brauchte keine Aenderung:
  `candidatesFor` filtert ausschliesslich `resolved.armyLevelCandidates`
  (nur `catalogue.entries`, siehe `collectArmyLevelCandidates` in
  `resolver.js:736`) — `catalogue.categories` fliesst dort nie ein, eine
  Kategorie kann also ohnehin nie selbst ein Angebots-Kandidat sein.
  Regressionstest ergaenzt (`crossCatalog.rootEntryScope.test.js`, neue
  Describe „Review-Runde 1"): das exakte Reviewer-Muster (Kategorie mit
  roster-MIN in Katalog B, per `categoryLink` an einem Wurzel-Eintrag aus
  Katalog A referenziert, Roster nur mit As Kontingent) nachgebildet, per
  `git stash` am unveraenderten `evalTree.js` als tatsaechlich fehlschlagend
  verifiziert, danach mit dem Fix wieder gruen. Wichtige Selbstkorrektur
  beim Schreiben: der erste Testentwurf erwartete faelschlich KEINE
  Verletzung — die richtige Erwartung (wie vom Reviewer benannt: „sollte
  weiterhin feuern") ist das Gegenteil, symmetrisch zu Kriterium 1s
  Wurzel-`entryLink`-Tests, die ebenfalls unbedingtes Feuern statt
  Filterung erwarten. **Ungeprüfte Annahme, hier explizit festgehalten:**
  die Ausnahme macht Kategorie-MIN-Grenzen wieder katalog-unabhaengig
  (gepoolt) — genau wie beim Wurzel-`entryLink` reisst das die neue
  Katalog-Filterung fuer diese eine Definitionsart wieder ein, in Kauf
  genommen aus Konsistenz mit der bereits vom Menschen gebilligten
  `entryLink`-Ausnahme. Der reale WHFB6-Datensatz entscheidet das nicht, da
  weder "Mercenaries" noch "Regiment of Renown" dort eine MIN-Grenze tragen
  (nur MAX) — die Reviewer-Verifikation belegte ausschliesslich, dass der
  Code-Pfad existiert und ohne Ausnahme faelschlich still bleibt, nicht
  welches Verhalten fuer eine echte Katalog-MIN-Grenze an einer Kategorie
  korrekt waere.
- 2026-07-30 — **Verifikation nach dem Fix:** `npx vitest run
  src/evaluator`, 68 Testdateien, 855 Tests (2 neu), Exit 0. `npm run lint`
  (oxlint), Exit 0. `npm run typecheck` (tsc --noEmit), Exit 0.

## Retro
