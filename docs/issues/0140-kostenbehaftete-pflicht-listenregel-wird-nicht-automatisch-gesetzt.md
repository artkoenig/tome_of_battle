---
status: active
branch: claude/army-general-dice-game-4gcv1o
pr:
---

# Eine Pflicht-Listenregel mit Kosten wird nicht automatisch gesetzt

## Intent

Issue 0138 setzt eindeutige Pflicht-Listenregeln in einem frisch angelegten
Kontingent automatisch. Sein Prädikat
`isUnconditionalMandatoryListRule` (`src/roster/listRules.js`) verlangt dafür
unter anderem **Kostenfreiheit über jede Kostenart**. Diese Bedingung schließt
Einträge aus, die trotz Kosten gar keine Wahl sind.

Belegter Fall (ergofang-Quelle, `High Elf.cat`, Eintrag
`a4dc-9040-d98e-7bc1` „Who Is the general? Nobody knows, roll the dice to see
what it shows."): `type="upgrade"`, Wurzel-`selectionEntry`,
`constraint type="min" scope="roster" value="1"` **und**
`constraint type="max" scope="roster" value="1"`, keine Unterauswahlen,
`hidden="false"`. Er kostet 0 Punkte, aber `2.0 Casting Dice` und
`2.0 Dispel Dice` — und fällt allein daran durch das Prädikat. Der Nutzer
sieht stattdessen die blockierende Meldung „The army still needs a "Who Is
the general? …"." (`validation.evaluator.selectionCount.min.roster_one`).

Verschärfend: der einzige `categoryLink` dieses Eintrags („General") trägt
`primary="false"`. Die Ankreuzliste gruppiert über die **primäre** Kategorie
(`collectPrimaryCategoryEntries`), der Eintrag erscheint also in keiner
Ankreuzliste — er ist heute in der Oberfläche gar nicht von Hand anhakbar.
Das ist ein eigener Mangel und **nicht** Gegenstand dieser Issue; er ist
separat zu erfassen. Diese Issue behebt nur das automatische Setzen.

Die Kostenbedingung ist an dieser Stelle sachlich falsch: ein Wurzeleintrag
vom Typ `upgrade` mit eigenem `min ≥ 1` in `scope="force"`/`scope="roster"`,
ohne eigene Unterauswahlen und nicht ausgeblendet, lässt dem Nutzer keine
Entscheidung — die Armee muss ihn führen und seine Kosten zahlen, was immer
sie sind. Die übrigen Merkmale des Prädikats (Typ `upgrade`, kein Behälter,
explizit geschriebener Scope) schließen echte, wählbare Einheiten bereits aus;
die Kostenfreiheit trägt dazu nichts bei.

Gemessener Blast Radius über **alle** Katalogdateien beider konfigurierten
Quellen (17 ergofang + 19 Definitive Edition, Stand 2026-07-31): Fällt die
Kostenbedingung weg, kommen genau **zwei** Einträge neu hinzu — der oben
belegte High-Elf-Eintrag und „Forces of Dwarfs' Army Rules"
(`Dwarfs (2001) (6th definitive edition).cat`, `min=1 scope="force"`,
`hidden="false"`, keine Unterauswahlen, `2 Dispel Dice`). Beide sind echte
Pflicht ohne Wahl. Kein Eintrag mit Kosten in einer **Punkte**-Kostenart ist
betroffen.

Acceptance criteria:

1. Ein Wurzel-Listenregel-Eintrag, der alle übrigen Merkmale aus Issue 0138
   Kriterium 1 erfüllt (Typ `upgrade`, eigener `min`-Constraint ≥ 1 mit
   explizitem `scope="force"` oder `scope="roster"` direkt am Eintrag/Link,
   keine eigenen Unterauswahlen, nicht ausgeblendet), gilt **auch dann** als
   eindeutige Pflicht-Listenregel, wenn er in einer oder mehreren Kostenarten
   einen Wert ungleich 0 trägt.
2. In einem **neu angelegten** Kontingent des ergofang-High-Elf-Katalogs ist
   der Eintrag `a4dc-9040-d98e-7bc1` („Who Is the general? …") automatisch in
   `force.selections` vorhanden; die Meldung
   `validation.evaluator.selectionCount.min.roster_one` erscheint für ihn
   nicht mehr.
3. Alle übrigen Merkmale des Prädikats bleiben unverändert wirksam: ein
   Eintrag mit eigenen Unterauswahlen, ohne `min`-Constraint, mit `min ≥ 1`
   ohne explizit geschriebenen Scope (`scope` fehlend oder `parent`), oder mit
   effektivem `min < 1` wird weiterhin **nicht** automatisch gesetzt — auch
   dann nicht, wenn er kostenfrei ist.
4. Ein **vor** dieser Änderung bereits bestehendes Roster wird beim Öffnen
   nicht rückwirkend verändert (Issue 0138 Kriterium 4 bleibt unangetastet).
5. Die Kosten eines automatisch gesetzten Eintrags zählen im Bericht wie die
   jeder anderen Selektion — es gibt keine Sonderbehandlung, die sie
   ausblendet.

## Plan

## Tasks

## Decisions

- **Die Kostenbedingung fällt ersatzlos weg**, statt sie auf budgetierte
  Kostenarten (Punkte) einzuschränken. Quelle: Antwort des Menschen,
  2026-07-31, auf die vorgelegte Wahl zwischen beiden. Begründung im Intent:
  die einschränkende Variante koppelt `src/roster/listRules.js` an die
  Roster-Kostengrenzen und löst einen Fall, den heute kein Katalog liefert
  (kein Kandidat trägt Punktekosten).
- **Bestandsroster werden nicht nachgerüstet.** Quelle: Antwort des Menschen,
  2026-07-31. Folge, dem Menschen vorgelegt und angenommen: eine bestehende
  High-Elf-Liste behält den Fehler und kann ihn mangels Primärkategorie des
  Eintrags nicht von Hand beheben; sie muss neu angelegt werden.
- **Die fehlende Primärkategorie des Eintrags wird hier nicht behoben.** Sie
  verletzt kein Kriterium dieser Issue und bekommt eine eigene Issue.

## Log

- Ursache empirisch festgestellt: die Katalogdateien beider Quellen wurden
  über `raw.githubusercontent.com` (`catpkg.json` je Quelle) geladen und nach
  Wurzeleinträgen vom Typ `upgrade` mit `min ≥ 1` in `scope=force|roster`
  durchsucht. Treffer mit Kosten ≠ 0: die zwei im Intent genannten.

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
