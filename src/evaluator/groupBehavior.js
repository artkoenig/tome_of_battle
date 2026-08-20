import { ConstraintKind, ModifierKind } from '../parser/schema/battlescribeSchema.generated.js';
import { AnchorKind } from './model.js';

/**
 * Das **Wahlverhalten** einer `selectionEntryGroup`, aus den Katalogdaten
 * abgeleitet und im Bericht gemeldet (Issue 0156, ADR-0034).
 *
 * Zwei Fragen stellt jede Oberflaeche, die eine Options-Gruppe zeichnet, und
 * beide beantwortete sie bisher selbst am Katalog:
 *
 * 1. **Ist die Gruppe echte Einzelwahl** (ein Radiobutton-Block)? Sie ist es,
 *    sobald ihr effektives Max hoechstens 1 ist UND kein Modifikator dieses Max
 *    ueber 1 heben kann. Der zweite Halbsatz loest den Ruestung+Schild-Kreis:
 *    ohne Schild waere das aktuelle Max 1, aber gerade das Waehlen des Schilds
 *    hebt es. Die Frage nach dem **potentiellen** Max ist deshalb bewusst
 *    statisch — Bedingungen der Modifikatoren werden nicht geprueft.
 * 2. **Wiederholt sich eine Option innerhalb ihrer Gruppe**? Eine nominell auf
 *    max=1 gedeckelte Gruppe traegt dafuer einen `increment`-Modifikator mit
 *    `<repeat>`, der ihr eigenes `max` je gewaehlter Kopie **genau dieser**
 *    Option anhebt (`docs/battlescribe-data-format.md` §9.7) — BattleScribes
 *    Kodierung fuer Magiegegenstaende, von denen man mehrere nehmen darf
 *    (Dispel Scroll, Power Stone). Eine so getragene Option ist kein
 *    Radiobutton, sondern ein Mengensteller.
 *
 * Beide Antworten haengen allein an Definitionen, nicht am Zustand des Rosters
 * — bis auf das effektive Max, das der Bericht am Gruppen-Anker ohnehin schon
 * meldet und das hier nur mitgelesen wird.
 */

/**
 * Ein auf genau diesen Wert gedeckeltes Gruppen-Max bietet **eine** einander
 * ausschliessende Wahl an; ein Modifikator, der darueber hinaushebt, macht die
 * Gruppe zur Mehrfachauswahl.
 */
const SINGLE_CHOICE_GROUP_MAX = 1;

/**
 * Die Definitionen, an denen die Grenzen und Modifikatoren einer Gruppe stehen:
 * die Gruppe selbst und — bei einem `entryLink type="selectionEntryGroup"` — ihr
 * aufgeloestes Ziel. Ein Verweis erbt die Grenzen seines Ziels und traegt seine
 * eigenen dazu; fuer die statische Frage nach dem *moeglichen* Max zaehlen beide.
 */
function declarationsOf(groupDef) {
  return groupDef?.resolved ? [groupDef, groupDef.resolved] : [groupDef].filter(Boolean);
}

/** Die Modifikatoren einer Definition, Modifikatorgruppen beliebiger Tiefe eingeschlossen. */
function* modifiersOf(source) {
  yield* source?.modifiers ?? [];
  for (const group of source?.modifierGroups ?? []) {
    yield* modifiersOf(group);
  }
}

/** Alle Modifikatoren einer Gruppendefinition, ueber Verweis und Ziel hinweg. */
function* groupModifiersOf(groupDef) {
  for (const declaration of declarationsOf(groupDef)) {
    yield* modifiersOf(declaration);
  }
}

/** Alle `max`-Grenzen einer Gruppendefinition, ueber Verweis und Ziel hinweg. */
function maxLimitsOf(groupDef) {
  return declarationsOf(groupDef)
    .flatMap(declaration => declaration.limits ?? [])
    .filter(limit => limit.kind === ConstraintKind.MAX);
}

/**
 * Der Wert, den ein Modifikator einer Grenze **potentiell** gaebe — die reine
 * Arithmetik, ohne seine Bedingungen zu pruefen. Ein Modifikator, dessen Art
 * keinen Zahlenwert setzt, laesst den Wert unveraendert.
 */
function potentialValueOf(baseValue, modifier) {
  // Der Leser traegt den Modifikator-Wert **roh** (als Attributtext) weiter — die
  // auswertende Schicht deutet ihn je Feldart. Fuer die statische Frage nach dem
  // moeglichen Max zaehlt allein seine Zahl; ein nicht-numerischer Wert (Text,
  // `true`/`false`) laesst die Grenze unveraendert.
  const amount = typeof modifier.value === 'number' ? modifier.value : Number.parseFloat(modifier.value);
  if (!Number.isFinite(amount)) return baseValue;
  switch (modifier.kind) {
    case ModifierKind.SET: return amount;
    case ModifierKind.INCREMENT: return baseValue + amount;
    case ModifierKind.DECREMENT: return baseValue - amount;
    case ModifierKind.MULTIPLY: return baseValue * amount;
    default: return baseValue;
  }
}

/**
 * Ob ein Modifikator diese `max`-Grenze ueber die Einzelwahl-Deckelung heben
 * kann. Das schon behandelte Muster `increment` + `<repeat>` (§9.7 — eine
 * Hebung je Kopie **desselben** Gegenstands) ist ausgenommen: es kennzeichnet
 * einen wiederholbaren Gegenstand, keine von Haus aus mehrfach waehlbare Gruppe.
 */
function raisesMaxAboveSingleChoice(modifier, maxLimit) {
  if (modifier.field !== maxLimit.id) return false;
  if ((modifier.repeats ?? []).length > 0) return false;
  return potentialValueOf(maxLimit.value, modifier) > SINGLE_CHOICE_GROUP_MAX;
}

/**
 * Ob **irgendein** Modifikator der Gruppe eine ihrer `max`-Grenzen ueber 1 heben
 * kann — rein statisch, unabhaengig davon, ob seine Bedingung gerade haelt.
 */
export function canGroupMaxBeRaisedAboveSingleChoice(groupDef) {
  const maxLimits = maxLimitsOf(groupDef);
  if (maxLimits.length === 0) return false;
  const modifiers = [...groupModifiersOf(groupDef)];
  return maxLimits.some(maxLimit => modifiers.some(modifier => raisesMaxAboveSingleChoice(modifier, maxLimit)));
}

/**
 * Die Definitions-IDs der Optionen, die **innerhalb** dieser Gruppe wiederholbar
 * sind: Ziel eines `increment`-Modifikators mit `<repeat>`, der eine `max`-Grenze
 * der Gruppe selbst anhebt. Ein `<repeat childId="any">` benennt keine einzelne
 * Option und zaehlt deshalb nicht.
 */
function repeatableMemberIdsOf(groupDef) {
  const maxLimitIds = new Set(maxLimitsOf(groupDef).map(limit => limit.id));
  const ids = new Set();
  for (const modifier of groupModifiersOf(groupDef)) {
    if (modifier.kind !== ModifierKind.INCREMENT) continue;
    if (!maxLimitIds.has(modifier.field)) continue;
    for (const repeat of modifier.repeats ?? []) {
      // `targetChildId` ist `null`, wenn der Katalog `childId="any"` schreibt —
      // dann benennt die Wiederholung keine einzelne Option und kennzeichnet
      // folglich keine als wiederholbar.
      if (repeat.targetChildId) ids.add(repeat.targetChildId);
    }
  }
  return ids;
}

/**
 * Baut die Verhaltensauskunft **einmal je Bericht**: je Gruppen-Anker seine
 * statische Max-Hebbarkeit, und je Traeger-Knoten die Menge der Options-IDs, die
 * eine seiner Gruppen als wiederholbar traegt.
 *
 * Der Traeger ist der gemeinsame Elternknoten von Gruppen-Anker und Options-Slot
 * — im Auswertungsbaum haengen beide nebeneinander unter der Auswahl, denn eine
 * Gruppe ist im Roster kein eigener Knoten (`evalTree.js`,
 * `annotateGroupFrameMembers`).
 *
 * @param {object} root  Wurzel des Auswertungsbaums.
 * @returns {{ isGroupMaxRaisable: (node: object) => boolean, repeatableIdsUnder: (node: object) => Set<string> }}
 */
export function createGroupBehavior(root) {
  const raisableByAnchor = new Map();
  const repeatableIdsByCarrier = new Map();

  const visit = (node) => {
    if (node.anchorKind === AnchorKind.GROUP_ANCHOR) {
      raisableByAnchor.set(node, canGroupMaxBeRaisedAboveSingleChoice(node.def));
      const repeatable = repeatableMemberIdsOf(node.def);
      if (repeatable.size > 0 && node.parent) {
        const known = repeatableIdsByCarrier.get(node.parent);
        if (known === undefined) repeatableIdsByCarrier.set(node.parent, repeatable);
        else for (const id of repeatable) known.add(id);
      }
    }
    for (const child of node.children ?? []) visit(child);
  };
  visit(root);

  return {
    isGroupMaxRaisable: (node) => raisableByAnchor.get(node) === true,
    repeatableIdsUnder: (node) => repeatableIdsByCarrier.get(node) ?? EMPTY_IDS,
  };
}

const EMPTY_IDS = Object.freeze(new Set());
