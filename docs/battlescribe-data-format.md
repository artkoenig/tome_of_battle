# BattleScribe-Datenformat (BSData) — Technische Dokumentation

> Die **kanonische Referenz** zum Aufbau von BattleScribe-Datendateien (`.gst` / `.cat` / `.ros`)
> für dieses Projekt, inklusive der aus vergangenen Bug-Analysen gesammelten Domänen-Erkenntnisse.
> Diese Seite ist nur der Index: die Kapitel stehen unter [`battlescribe/`](battlescribe/), ihre
> Nummerierung (§7.6, §9.4 …) ist unverändert, ein Verweis auf einen Paragraphen bleibt gültig.
>
> **Quellen:** das offizielle BSData-Wiki als Submodul unter
> [`bsdata-catalogue-development-wiki/`](bsdata-catalogue-development-wiki/) (aktuell ziehen mit
> `git submodule update --remote`) sowie reale WHFB-6th-Edition-Kataloge — zur Laufzeit aus dem
> externen Fork (ADR-0014), eingefroren unter `src/tests/__fixtures__/whfb6/`. Alle XML-Beispiele
> stammen aus echten Dateien. Wie das Projekt das Format parst und auswertet, steht in
> [`CLAUDE.md`](../CLAUDE.md), in [`src/contexts/ruleengine/engine/`](../src/contexts/ruleengine/engine/)
> (beurteilt ein Roster) und in [`src/contexts/armylist/model/`](../src/contexts/armylist/model/)
> (erzeugt und editiert eines).

## Grundlagen

- [§1–4 Überblick, Dateitypen, Grundprinzipien, Objektmodell](battlescribe/overview.md) — was BSData ist, IDs, Vererbung, Kontext-Threading

## Dateien

- [§5 Game System (`.gst`)](battlescribe/files/game-system.md) — Cost Types, Profile Types, Kategorien, Force Entries
- [§6 Catalogue (`.cat`)](battlescribe/files/catalogue.md) — Armeebuch: shared Einträge, Katalog-Links

## Bausteine

- [§7.1 Selection Entry & Selection Entry Group](battlescribe/building-blocks/selection-entry.md) — Einheiten, Modelle, Upgrades und ihre Gruppen
- [§7.2 Entry Link, Info Link, Category Link](battlescribe/building-blocks/links.md) — Verweise statt Kopien, und was sie erben
- [§7.3–7.4 Profile, Characteristic, Rule](battlescribe/building-blocks/profile-and-rule.md) — Werte und Regeltexte an einem Eintrag
- [§7.5 Cost & Cost Type](battlescribe/building-blocks/cost.md) — Punkte und weitere Kostenarten
- [§7.6 Constraint](battlescribe/building-blocks/constraint.md) — Grenzen: `min`/`max`, `field`, `scope`, Zähl-Flags
- [§7.7 Modifier, Condition, Condition Group, Repeat](battlescribe/building-blocks/modifier.md) — bedingte Änderungen an allem oben
- [§8 Kategorien & Sichtbarkeit](battlescribe/building-blocks/category-and-visibility.md) — `primary`, Tag-Kategorien, `hidden`

## Praxis

- [§9 Häufige Muster](battlescribe/patterns/common-patterns.md) — wiederkehrende Modellierungen echter Kataloge
- [§10 Collective Entries](battlescribe/patterns/collective-entries.md) — eine Auswahl für viele Modelle
- [§11 Best Practices](battlescribe/patterns/best-practices.md) — Katalog-Guidelines und Datenmodellierung
- [§12 Workflow](battlescribe/patterns/workflow.md) — Erstellen, Versionieren, Veröffentlichen

## Referenz

- [§13 Referenztabellen](battlescribe/reference/tables.md) — Enum-Werte, `field` je Kontext, gemeinsame Attribute
- [§14 Glossar](battlescribe/reference/terminology.md) — die Begriffe des Formats in einem Satz
- [§15 Lücken der Quelle](battlescribe/reference/source-gaps.md) — wo das Wiki schweigt und das Projekt entscheidet
