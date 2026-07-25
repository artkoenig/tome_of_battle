/**
 * Gemeinsame Testnaht fuer die **echten** Definitive-Edition-Katalogdaten
 * (`whfb6-definitive/`, ADR-0032). Alle real-daten-getriebenen E2E-Tests (Scheiben
 * 01–03) beziehen ihre Quellen und die verifizierten Konstanten von hier — statt
 * jeweils eigene Pfad-Logik und ID-Konstanten zu erfinden.
 *
 * Der Loader liest die versionierten XML-Bytes aus dem Repository (kein Nachbau)
 * und liefert je Armee einen Datensatz `{ gameSystem, catalogues }` in der Form,
 * die die Fassade `evaluate` erwartet — die Armee-`.cat` bereits mit ihrer
 * gemeinsamen `Mercenaries`-Abhaengigkeit gepaart (Stern-Struktur, siehe
 * `whfb6-definitive/README.md`).
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// Relativ zum Projekt-Wurzelverzeichnis (dem cwd des Testlaufs) aufgeloest — wie
// die uebrigen fixture-lesenden Tests des Projekts.
const FIXTURE_DIR = 'src/evaluator/__fixtures__/whfb6-definitive';

const File = Object.freeze({
  GAME_SYSTEM: 'Warhammer Fantasy Battles (6th definitive edition).gst',
  MERCENARIES: 'Mercenaries (6th definitive edition).cat',
  OGRE_KINGDOMS: 'Ogre Kingdoms (6th definitive edition).cat',
  ORCS_AND_GOBLINS: 'Orcs and goblins (6th definitive edition).cat',
  VAMPIRE_COUNTS: 'Vampire Counts (6th definitive edition).cat',
});

/** Liest eine Fixture-Datei als UTF-8-Text. */
function readFixture(fileName) {
  return readFileSync(resolve(FIXTURE_DIR, fileName), 'utf8');
}

/**
 * Ein vollstaendiger Armee-Datensatz: die `.gst`, die Armee-`.cat` **und** ihre
 * gemeinsame `Mercenaries`-Abhaengigkeit (Stern-Struktur — jede Armee deklariert
 * denselben `catalogueLink` auf Mercenaries).
 */
function armyDataset(armyFile) {
  return {
    gameSystem: readFixture(File.GAME_SYSTEM),
    catalogues: [readFixture(armyFile), readFixture(File.MERCENARIES)],
  };
}

/**
 * Derselbe Armee-Datensatz **ohne** die deklarierte `Mercenaries`-Abhaengigkeit —
 * ein absichtlich unvollstaendiger Satz (`MISSING_CATALOGUE_DEPENDENCY`), an dem
 * die kataloguebergreifende Auflösung als Diagnose statt eines Absturzes sichtbar wird.
 */
function armyDatasetWithoutMercenaries(armyFile) {
  return {
    gameSystem: readFixture(File.GAME_SYSTEM),
    catalogues: [readFixture(armyFile)],
  };
}

/** Spielsystem-Id der `.gst` (Wurzel-`id`; Revision 1) — siehe README. */
export const GAME_SYSTEM_ID = '0d13-7737-ea86-4662';

/** Katalog-Id der gemeinsamen `Mercenaries`-Abhaengigkeit (Ziel jedes `catalogueLink`). */
export const MERCENARIES_CATALOGUE_ID = 'fc47-8392-a6c8-452a';

// Eine Definition, die **ausschliesslich** ueber die Mercenaries-`.cat` aufloest
// (Dogs-of-War-Einheit „Pikemen"): der Beleg der kataloguebergreifenden
// `catalogueLink`-Auflösung an echten Daten. Ohne Mercenaries baumelt ihr
// `entryLink`, mit Mercenaries loest er auf.
export const MERCENARIES_ONLY_ENTRY_ID = 'f7d8-66b4-21ee-00dd';
export const MERCENARIES_ONLY_ENTRY_NAME = 'Pikemen';

// ── Armeeweite Pflicht- und Bedingungs-Regeln der `.gst` ──────────────────────
// Die folgenden Regeln sind **im Spielsystem** definiert (nicht in einer Armee-
// `.cat`) und gelten daher fuer **jede** Armee gleich — die sicheren Anker der
// real-daten-getriebenen E2E-Tests (verifiziert an Ogre, Orcs & Goblins und
// Vampire Counts).

/**
 * Die armeeweite Pflichtregel „General": min 1 Selektion der Kategorie „General"
 * je Kontingent (force-scope). Anker der Grenze ist die Kategorie-Definition.
 */
export const GENERAL_MIN_ID = '1077-7379-f142-f382';
export const GENERAL_CATEGORY_ID = 'a37e-7207-de6d-acb0';
export const GENERAL_CATEGORY_NAME = 'General';
export const GENERAL_MIN_VALUE = 1;

/**
 * Die armeeweite Pflichtregel „Core": min 2 Selektionen der Kategorie „Core" je
 * Kontingent (force-scope). Ihr **bedingter** `set→1`-Modifikator senkt die
 * effektive Untergrenze auf 1, sobald die Selektion „Border Patrols rules"
 * (rein selektionsbasiert, daher engine-schaltbar) im Roster liegt.
 */
export const CORE_MIN_ID = '35c2-d478-392a-aeb1';
export const CORE_CATEGORY_ID = '64bf-efb4-9978-26df';
export const CORE_CATEGORY_NAME = 'Core';
export const CORE_MIN_BASE_VALUE = 2;
export const CORE_MIN_WITH_BORDER_PATROLS_VALUE = 1;

/**
 * Die gst-weit geteilte „General"-Aufwertung (`sharedSelectionEntry`, `type=upgrade`):
 * sie traegt den `categoryLink` auf die Kategorie „General" und erfuellt damit —
 * einmal ins Roster gelegt — die General-Pflichtregel jeder Armee.
 */
export const GENERAL_DESIGNATOR_ID = '1b7c-2c90-6d96-28c9';

/**
 * Die Selektion „Border Patrols rules", auf deren Vorhandensein die Bedingung des
 * Core-`set→1`-Modifikators haengt (`atLeast 1`, scope=roster). Ein verstecktes
 * Upgrade (`defaultAmount=1`); als reine Selektion ist es engine-schaltbar (die
 * punktebasierten Core-Stufen 3/4/5/6 sind bewusst nicht Teil der Tests).
 */
export const BORDER_PATROLS_SELECTION_ID = '4e15-0353-165f-5528';
export const BORDER_PATROLS_SELECTION_NAME = 'Border Patrols rules';

// ── Ogre Kingdoms ─────────────────────────────────────────────────────────────

/** Das reale Kontingent „Standard (OK-AB)" der Ogre-`.cat` (Traeger der Auswahlen). */
export const OGRE_FORCE_ID = '729f-9246-5cd3-5044';
export const OGRE_FORCE_NAME = 'Standard (OK-AB)';

/** Zwei reale Core-Einheiten der Ogre-`.cat` (Gnoblars, Gnoblar Trappers). */
export const OGRE_CORE_UNIT_IDS = Object.freeze(['1e26-0d1a-bb3c-f47a', '041b-7d95-6ff9-754a']);

/**
 * Die reale, **unbedingte** „Tyrant"-Obergrenze: max 1 Tyrant im Roster
 * (roster-scope). Zwei Tyrants erzeugen die Verletzung Ist 2, Grenze 1.
 */
export const TYRANT_ID = '2679-58f4-1771-662d';
export const TYRANT_MAX_ID = 'cb1c-3389-8f55-d6c6';
export const TYRANT_MAX_VALUE = 1;

/**
 * Der vollstaendige, reale Ogre-Kingdoms-Datensatz: die `.gst` plus die
 * Ogre-`.cat` **und** ihre `Mercenaries`-Abhaengigkeit.
 */
export function ogreDataset() {
  return armyDataset(File.OGRE_KINGDOMS);
}

/** Der Ogre-Datensatz **ohne** die deklarierte `Mercenaries`-Abhaengigkeit. */
export function ogreDatasetWithoutMercenaries() {
  return armyDatasetWithoutMercenaries(File.OGRE_KINGDOMS);
}

// ── Orcs and Goblins ──────────────────────────────────────────────────────────

/** Das reale Kontingent „Standard (OG-AB)" der Orcs-and-Goblins-`.cat`. */
export const ORCS_AND_GOBLINS_FORCE_ID = '2bfa-e64a-7123-895f';

/** Zwei reale Core-Einheiten der Orcs-and-Goblins-`.cat` (Orc Boyz, Orc Arrer Boyz). */
export const ORCS_AND_GOBLINS_CORE_UNIT_IDS = Object.freeze(['ac23-b9d3-4046-23b7', 'bc74-bb63-2abd-4e0b']);

/** Der vollstaendige, reale Orcs-and-Goblins-Datensatz (`.gst` + `.cat` + Mercenaries). */
export function orcsAndGoblinsDataset() {
  return armyDataset(File.ORCS_AND_GOBLINS);
}

/** Der Orcs-and-Goblins-Datensatz **ohne** die deklarierte `Mercenaries`-Abhaengigkeit. */
export function orcsAndGoblinsDatasetWithoutMercenaries() {
  return armyDatasetWithoutMercenaries(File.ORCS_AND_GOBLINS);
}

// ── Vampire Counts ────────────────────────────────────────────────────────────

/** Das reale Kontingent „Standard (VC-AB)" der Vampire-Counts-`.cat`. */
export const VAMPIRE_COUNTS_FORCE_ID = 'e989-15b8-7eb6-9668';

/** Zwei reale Core-Einheiten der Vampire-Counts-`.cat` (Skeletons, Zombies). */
export const VAMPIRE_COUNTS_CORE_UNIT_IDS = Object.freeze(['9ac2-f4c1-bcc3-3aee', '749f-cf91-6317-7ac0']);

/** Der vollstaendige, reale Vampire-Counts-Datensatz (`.gst` + `.cat` + Mercenaries). */
export function vampireCountsDataset() {
  return armyDataset(File.VAMPIRE_COUNTS);
}

/** Der Vampire-Counts-Datensatz **ohne** die deklarierte `Mercenaries`-Abhaengigkeit. */
export function vampireCountsDatasetWithoutMercenaries() {
  return armyDatasetWithoutMercenaries(File.VAMPIRE_COUNTS);
}
