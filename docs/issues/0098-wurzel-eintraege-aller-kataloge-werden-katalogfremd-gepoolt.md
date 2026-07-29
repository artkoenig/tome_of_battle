---
status: backlog
branch:
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
