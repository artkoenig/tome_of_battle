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

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
