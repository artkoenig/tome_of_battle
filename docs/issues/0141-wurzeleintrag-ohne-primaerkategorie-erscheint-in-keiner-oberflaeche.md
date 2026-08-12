---
status: backlog
branch:
pr:
---

# Ein Wurzeleintrag ohne Primärkategorie erscheint in keiner Oberfläche

## Intent

Die Oberfläche gruppiert Wurzeleinträge ausschließlich über ihre **effektive
Primärkategorie**: `collectPrimaryCategoryEntries`
(`src/roster/entryVisibility.js`) sammelt je Kategorie-Sektion nur Einträge,
für die `isEntryPrimaryInCategory` gilt — also solche mit einem
`categoryLink primary="true"` auf genau diese Kategorie. Sowohl der
„+"-Adder (`CategoryUnitAdder`) als auch die Listenregel-Ankreuzliste bauen
darauf auf.

Ein Katalog-Wurzeleintrag, dessen sämtliche `categoryLink`s
`primary="false"` tragen, hat damit keine Sektion, in der er auftauchen
könnte. Er ist in der App weder auszuheben noch anzuhaken — er existiert für
den Nutzer nicht, obwohl der Katalog ihn als wählbaren Eintrag führt.

Belegter Fall (ergofang-Quelle, `High Elf.cat`): Eintrag
`a4dc-9040-d98e-7bc1` „Who Is the general? Nobody knows, roll the dice to see
what it shows.", `type="upgrade"`, einziger `categoryLink` auf „General" mit
`primary="false"`. Der Eintrag trägt zugleich `min=1 scope="roster"`, der
Evaluator meldet also berechtigt „The army still needs a …" — der Nutzer hat
aber keinen Weg, die Meldung von Hand zu beheben. Issue 0140 setzt diesen
Eintrag in **neu angelegten** Kontingenten automatisch und entschärft den Fall
damit dort; ein **bestehendes** Roster (und jeder andere Eintrag ohne
Primärkategorie, der keine Pflicht ist) bleibt unerreichbar.

Offen und vor der Umsetzung zu klären: ob ein solcher Eintrag in der Sektion
seiner nicht-primären Kategorie erscheinen soll, in einer eigenen
Sammel-Sektion, oder ob die Battlescribe-Semantik einen Eintrag ohne
Primärkategorie überhaupt als wählbar meint (`docs/battlescribe-data-format.md`
prüfen — die Antwort entscheidet, ob dies ein Fehler der App oder ein
Katalogfehler ist).

Acceptance criteria:

1. Geklärt und im Issue festgehalten ist, was die Battlescribe-Semantik für
   einen Wurzeleintrag ohne `categoryLink primary="true"` vorsieht — mit
   Belegstelle in `docs/battlescribe-data-format.md` bzw. dem
   BSData-Wiki-Submodul.
2. Ergibt Kriterium 1, dass ein solcher Eintrag wählbar sein muss: er ist in
   der Oberfläche erreichbar (aushebbar bzw. anhakbar), und der Ort, an dem er
   erscheint, folgt datengetrieben aus dem Katalog (ADR 0003) — kein
   hartkodierter Kategoriename.
3. Ergibt Kriterium 1 das Gegenteil: die Entscheidung ist im Issue und, wo sie
   eine Aussage falsch macht, in der betroffenen Dokumentation festgehalten;
   am Code ändert sich nichts.
4. Bestehendes Gruppierungsverhalten für Einträge **mit** Primärkategorie
   bleibt unverändert — insbesondere die modifier-getriebene
   Umkategorisierung (`set-primary`/`unset-primary`).

## Plan

## Tasks

## Decisions

## Log

- 2026-08-12 (re-check, independent probe) — **The mechanism reproduces, and the
  fixtures carry the pattern**, though not the entry this file cites.
  - Synthetic control: two root entries, both linking the category "General",
    one `primary="true"` and one `primary="false"`.
    `collectPrimaryCategoryEntries(system, catalogue, 'cat-general')` returns
    **only** the primary one — the other is in no section, hence neither
    addable nor checkable.
  - Data: the cited High Elf entry `a4dc-9040-d98e-7bc1` is not in this
    repository (no `High Elf.cat` among the 19 fixture catalogues). Two frozen
    fixture root entries do show the pattern and are reachable from no category
    section at all: **"Dogs of War Army"** (`2641-7ec9-2243-7715`,
    `Dogs of War.cat`, type=upgrade) and **"SELECT FOR USING AS DOGS OF WAR ?"**
    (`aa6a-68b4-a6ae-4abc`, `Ogre Kingdoms.cat`, type=upgrade). Measured by
    enumerating every category id of system and catalogue and intersecting with
    the root entries that carry `categoryLink`s but none with `primary="true"`.
    The eleven definitive-edition catalogues carry no such root entry.

- Aufgefallen bei der Ursachenanalyse zu Issue 0140: der dort behandelte
  Eintrag ist mangels Primärkategorie in keiner Ankreuzliste sichtbar. Der
  Mensch hat entschieden, Bestandsroster nicht nachzurüsten — womit dieser
  Mangel für bestehende Listen stehen bleibt und eine eigene Issue braucht.

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
