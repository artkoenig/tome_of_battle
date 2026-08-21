import { ConstraintKind, SelectionEntryKind } from '../../data/parser/schema/battlescribeSchema.generated.js';
import { DefinitionKind, ScopeKeyword } from './model.js';

/**
 * Die **statischen Eintragsmerkmale**, die jede Oberflaeche an einem Slot
 * ablesen will und bislang selbst am Katalog beantwortete (Issue 0156,
 * ADR-0034): ist dieser Slot eine *Listenregel* statt einer Einheit, ist er eine
 * *eigenstaendige Untereinheit*, und ist er eine *eindeutige Pflicht-Listenregel*.
 *
 * Alle drei haengen allein an Definitionen — an `type`, `collective`, den
 * eigenen Auswahl-Kindern und den eigenen Grenzen —, nicht am Zustand des
 * Rosters. Sie gehoeren deshalb neben das Wahlverhalten der Gruppen
 * (`groupBehavior.js`) in den Bericht, statt in einer Komponente noch einmal aus
 * dem Katalog erschlossen zu werden.
 */

/** Nur diese Eintragsarten koennen eine eigenstaendige Untereinheit sein. */
const SUB_UNIT_ENTRY_KINDS = new Set([SelectionEntryKind.UNIT, SelectionEntryKind.MODEL]);

/** Die Bezugsrahmen, in denen eine Pflicht §9.9 armeeweit gemeint ist. */
const ARMY_WIDE_SCOPES = new Set([ScopeKeyword.FORCE, ScopeKeyword.ROSTER]);

/**
 * Die Definitionen, an denen die Merkmale eines Slots stehen: die Definition
 * selbst und — bei einem `entryLink` — ihr aufgeloestes Ziel. Dieselbe
 * Link-und-Ziel-Lesart wie in `groupBehavior.js`.
 */
function declarationsOf(def) {
  return def?.resolved ? [def, def.resolved] : [def].filter(Boolean);
}

/**
 * Der wirksame `type` eines Slots: der eigene, sonst der seines Verweisziels.
 * Ein `entryLink` traegt selbst keinen `type` — die Art steht am Ziel.
 */
function entryTypeOf(def) {
  for (const declaration of declarationsOf(def)) {
    if (declaration.type) return declaration.type;
  }
  return null;
}

/**
 * True, wenn der Slot eine **Listenregel** traegt: ein `upgrade`-Eintrag, also
 * eine listenweite Einstellung statt einer kampffeldrelevanten Einheit
 * (`unit`/`model`). Ein unbekannter Typ gilt bewusst nicht als Listenregel.
 */
export function isListRuleDef(def) {
  return entryTypeOf(def) === SelectionEntryKind.UPGRADE;
}

/**
 * True, wenn die Definition (oder ihr Ziel) eigene **Auswahl**-Kinder mitbringt.
 *
 * `children` einer Definition führt neben Einträgen, Gruppen und Verweisen auch
 * die `categoryLink`s (`catalogReader.js`, `readSelectionChildren`) — und die
 * sind keine Wahl, die dem Nutzer offensteht. Ein Eintrag ohne jede
 * Unterauswahl, der bloss eine Kategorie deklariert, galt sonst als
 * „Behälter" und damit weder als eindeutige Pflicht-Listenregel noch als
 * eigenständige Untereinheit (Issue 0157).
 */
function hasSelectableChildren(def) {
  return declarationsOf(def).some(declaration => (declaration.children ?? [])
    .some(child => child?.kind !== DefinitionKind.CATEGORY_LINK));
}

/** True, wenn die Definition (oder ihr Ziel) als kollektiv gefuehrt wird. */
function isCollective(def) {
  return declarationsOf(def).some(declaration => declaration.isCollective === true);
}

/**
 * True, wenn der Slot eine **eigenstaendige Untereinheit** ist: vom Typ `unit`
 * oder `model`, nicht kollektiv (jede Instanz wird einzeln gefuehrt) und mit
 * eigenen Auswahlmoeglichkeiten. Dieselbe eine Definition, die frueher in
 * Editor, Spielansicht und Serialisierung je fuer sich am Katalog stand.
 */
export function isIndependentSubUnitDef(def) {
  return SUB_UNIT_ENTRY_KINDS.has(entryTypeOf(def))
    && !isCollective(def)
    && hasSelectableChildren(def);
}

/**
 * True, wenn der Slot eine **eindeutige Pflicht-Listenregel** ist (§9.9): eine
 * eigene `min`-Grenze ≥ 1 mit ausgeschriebenem Bezugsrahmen `force`/`roster` —
 * ein ungeschriebener Rahmen meint die eigene Instanzgrenze, nicht die armeeweite
 * Pflicht — und keine eigenen Unterauswahlen. Ihre Ankreuzzeile ist gesperrt,
 * solange die Regel im Roster steht.
 */
export function isMandatoryListRuleDef(def) {
  if (!isListRuleDef(def)) return false;
  if (hasSelectableChildren(def)) return false;
  return declarationsOf(def)
    .flatMap(declaration => declaration.limits ?? [])
    .some(limit => limit.kind === ConstraintKind.MIN
      && ARMY_WIDE_SCOPES.has(limit.scope)
      && limit.value >= 1);
}
