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

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

### Before the PR

- Does this match what was asked?
- What surprised me?
- What am I assuming without having verified it?

## Retro
