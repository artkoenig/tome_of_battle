/**
 * Der Anwendungsfall "eine Auswahl, die eine Aenderung unerreichbar macht, faellt
 * mit dieser Aenderung weg" (Issue 0203).
 *
 * Unerreichbar ist eine belegte Option, deren Slot im Bericht **zugleich**
 * effektiv versteckt (`isHidden`) und effektiv auf Max 0 gedeckelt
 * (`effectiveMax === 0`) ist: der Konfigurator bietet sie nicht mehr an, also
 * kann der Nutzer sie auch nicht mehr abwaehlen, und der Bericht truege zwei
 * Meldungen, die niemand beheben kann. Beispiel: der Langbogen des
 * Waldelfen-Adligen (Min 1, beim Ausheben gesetzt) wird versteckt und auf Max 0
 * gesetzt, sobald der Adlige Armeestandartentraeger wird.
 *
 * Nur eine der beiden Bedingungen genuegt nicht: eine versteckte Auswahl mit
 * Max ueber 0 oder eine sichtbare mit Max 0 bleibt stehen (der Bericht meldet
 * sie wie bisher, der Nutzer erreicht sie noch).
 *
 * Entfernt wird nur, was **diese** Aenderung unerreichbar gemacht hat: eine
 * Auswahl, die schon im Roster davor unerreichbar war — etwa aus einem
 * geladenen, importierten oder migrierten Roster (Issue 0119) —, bleibt liegen
 * und behaelt ihre Meldungen. Wurzel-Selektionen (Einheiten) bleiben
 * grundsaetzlich unberuehrt; es geht um Optionen unterhalb einer Einheit.
 *
 * Die Gegenrichtung gilt spiegelbildlich (`settleSelectionReachability`): eine
 * Option, die **diese** Aenderung wieder erreichbar und verpflichtend gemacht hat
 * (davor versteckt, auf Max 0 oder ohne Min; jetzt sichtbar mit Min > 0 und
 * unbelegt), wird auf ihr Min angelegt — mit derselben Pflicht-Mitglieder-Logik
 * wie beim Ausheben (`capability.raiseMembers` ueber `changeOptionCount`). Ein
 * offenes Min, das schon im Roster davor offen war (geladenes Roster), bleibt
 * offen; nichts wird angelegt, was der Nutzer nicht haette nehmen koennen.
 *
 * Roster hinein, Roster heraus; den Bericht holt sich der Anwendungsfall ueber
 * die eine Tuer des Lesemodells (`evaluateAppRoster`, gecacht je Paar aus System
 * und Roster). Die Bindung im Editor ruft ihn **im selben Undo-Schritt** wie die
 * ausloesende Aenderung, sodass ein Rueckgaengig beides zurueckholt.
 */

import { childSelectionsOf } from '../model/rosterTree.js';
import { findEntryInSystem } from '../model/catalogResolver.js';
import { evaluateAppRoster } from '../../ruleengine/readmodel/index.js';
import { catalogueIdContaining } from './rosterSelectionFactory.js';
import { changeOptionCount } from './subSelectionUseCases.js';
import '../../../shared/rostermodel/types.js';

/**
 * Obergrenze der Durchlaeufe: eine Entfernung kann eine weitere Option
 * unerreichbar machen, die Kette ist aber endlich (das Roster schrumpft je
 * Durchlauf) — die Grenze schuetzt nur gegen einen nicht konvergierenden Bericht.
 */
const MAX_PASSES = 8;

/** Die Ankerarten eines **unbelegten** Options-Slots (`AnchorKind` der Engine). */
const UNOCCUPIED_OPTION_ANCHOR_KINDS = new Set(['mandatoryPhantom', 'offerAnchor']);
const OCCUPIED_ANCHOR_KIND = 'occupied';
const GROUP_ANCHOR_KIND = 'groupAnchor';

/** @type {ReadonlySet<string>} */
const NOTHING_UNREACHABLE = new Set();

/**
 * Entfernt jede Option, die zwischen `previousRoster` und `roster` unerreichbar
 * (versteckt und Max 0) geworden ist.
 *
 * @param {import('../../../shared/rostermodel/types.js').Roster} roster
 *   das Roster nach der ausloesenden Aenderung.
 * @param {Object} context
 * @param {Object|null|undefined} context.system  das App-System (mit `rawXmls`).
 * @param {import('../../../shared/rostermodel/types.js').Roster|null|undefined} context.previousRoster
 *   das Roster vor der Aenderung; was dort schon unerreichbar war, bleibt.
 * @returns {import('../../../shared/rostermodel/types.js').Roster}
 *   dasselbe Roster-Objekt, wenn nichts zu entfernen war — sonst das bereinigte.
 */
export function withoutUnreachableSelections(roster, { system, previousRoster }) {
  if (!roster || !system) return roster;

  const alreadyUnreachable = previousRoster
    ? unreachableSelectionIds(previousRoster, system)
    : NOTHING_UNREACHABLE;

  let current = roster;
  for (let pass = 0; pass < MAX_PASSES; pass++) {
    const doomed = new Set(
      [...unreachableSelectionIds(current, system)].filter(id => !alreadyUnreachable.has(id))
    );
    if (doomed.size === 0) return current;
    current = withoutSelections(current, doomed);
  }
  return current;
}

/**
 * Die Ids aller belegten Optionen (unterhalb einer Einheit), deren Slot
 * versteckt und auf Max 0 gedeckelt ist.
 *
 * @param {import('../../../shared/rostermodel/types.js').Roster} roster
 * @param {Object} system
 * @returns {Set<string>}
 */
function unreachableSelectionIds(roster, system) {
  const { slots } = evaluateAppRoster(system, roster);
  /** @type {Set<string>} */
  const ids = new Set();

  /** @param {import('../../../shared/rostermodel/types.js').Selection[]} selections */
  const visit = (selections) => {
    for (const selection of selections) {
      const capability = slots.slotOfSelection(selection);
      if (capability?.isHidden === true && capability.effectiveMax === 0) {
        ids.add(selection.id);
      }
      visit(childSelectionsOf(selection));
    }
  };

  for (const force of roster.forces ?? []) {
    for (const unit of childSelectionsOf(force)) visit(childSelectionsOf(unit));
  }
  return ids;
}

/**
 * Das Roster ohne die Selektionen `selectionIds` (beliebiger Tiefe unterhalb
 * einer Einheit). Unberuehrte Teilbaeume behalten ihre Referenz.
 *
 * @param {import('../../../shared/rostermodel/types.js').Roster} roster
 * @param {Set<string>} selectionIds
 * @returns {import('../../../shared/rostermodel/types.js').Roster}
 */
function withoutSelections(roster, selectionIds) {
  /**
   * @param {import('../../../shared/rostermodel/types.js').Selection[]} selections
   * @returns {import('../../../shared/rostermodel/types.js').Selection[]}
   */
  const prune = (selections) => {
    let changed = false;
    const kept = [];
    for (const selection of selections) {
      if (selectionIds.has(selection.id)) {
        changed = true;
        continue;
      }
      const children = childSelectionsOf(selection);
      const prunedChildren = prune(children);
      if (prunedChildren !== children) {
        changed = true;
        kept.push({ ...selection, selections: prunedChildren });
      } else {
        kept.push(selection);
      }
    }
    return changed ? kept : selections;
  };

  return {
    ...roster,
    forces: (roster.forces ?? []).map(force => {
      const units = childSelectionsOf(force);
      const prunedUnits = units.map(unit => {
        const children = childSelectionsOf(unit);
        const prunedChildren = prune(children);
        return prunedChildren === children ? unit : { ...unit, selections: prunedChildren };
      });
      return prunedUnits.every((unit, index) => unit === units[index])
        ? force
        : { ...force, selections: prunedUnits };
    }),
  };
}

/**
 * Die eine Bindung des Editors (Issue 0203): erst faellt weg, was die Aenderung
 * unerreichbar gemacht hat, dann wird angelegt, was sie wieder erreichbar und
 * verpflichtend gemacht hat.
 *
 * @param {import('../../../shared/rostermodel/types.js').Roster} roster
 * @param {Object} context
 * @param {Object|null|undefined} context.system
 * @param {import('../../../shared/rostermodel/types.js').Roster|null|undefined} context.previousRoster
 * @returns {import('../../../shared/rostermodel/types.js').Roster}
 */
export function settleSelectionReachability(roster, { system, previousRoster }) {
  const pruned = withoutUnreachableSelections(roster, { system, previousRoster });
  return withReachableMandatoryOptions(pruned, { system, previousRoster });
}

/**
 * Legt jede Option auf ihr Min an, die zwischen `previousRoster` und `roster`
 * erreichbar und verpflichtend geworden und noch unbelegt ist.
 *
 * @param {import('../../../shared/rostermodel/types.js').Roster} roster
 * @param {Object} context
 * @param {Object|null|undefined} context.system
 * @param {import('../../../shared/rostermodel/types.js').Roster|null|undefined} context.previousRoster
 * @returns {import('../../../shared/rostermodel/types.js').Roster}
 *   dasselbe Roster-Objekt, wenn nichts anzulegen war.
 */
export function withReachableMandatoryOptions(roster, { system, previousRoster }) {
  if (!roster || !system || !previousRoster) return roster;

  const slots = evaluateAppRoster(system, roster).slots;
  const previousSlots = evaluateAppRoster(system, previousRoster).slots;
  const additions = [];

  for (const selection of allSelectionsOf(roster)) {
    const path = slots.pathOfSelection(selection.id);
    const previousPath = previousSlots.pathOfSelection(selection.id);
    if (path === undefined || previousPath === undefined) continue;

    const previousOptions = optionSlotsOfFrame(previousSlots, previousPath);
    for (const { capability } of optionSlotsOfFrame(slots, path)) {
      if (!UNOCCUPIED_OPTION_ANCHOR_KINDS.has(capability.anchorKind)) continue;
      if (!isReachableMandatory(capability)) continue;
      if ((capability.current ?? 0) >= capability.effectiveMin) continue;
      const before = previousOptions.find(slot => slot.capability.defId === capability.defId);
      if (before && isReachableMandatory(before.capability)) continue;
      additions.push({ unitSelectionId: selection.id, defId: capability.defId, count: capability.effectiveMin });
    }
  }

  let current = roster;
  for (const { unitSelectionId, defId, count } of additions) {
    const optionDefinition = findEntryInSystem(
      system, defId, catalogueIdContaining(current, unitSelectionId)
    );
    if (!optionDefinition) continue;
    // Eine neue Option entsteht mit Anzahl 1 (samt Pflicht-Mitgliedern), der
    // Rest des Min hebt ihre Anzahl — derselbe Weg wie der Mengensteller.
    for (const countDelta of count > 1 ? [1, count - 1] : [1]) {
      current = changeOptionCount(current, {
        unitSelectionId, optionDefinition, countDelta, system,
        slots: evaluateAppRoster(system, current).slots,
      });
    }
  }
  return current;
}

/**
 * Sichtbar, mit Min > 0 und einem Max, das Platz laesst — eine Option, die der
 * Nutzer nehmen kann und muss.
 * @param {Object} capability
 * @returns {boolean}
 */
function isReachableMandatory(capability) {
  return capability.isHidden !== true
    && (capability.effectiveMin ?? 0) > 0
    && (capability.effectiveMax === null || capability.effectiveMax === undefined
      || capability.effectiveMax > 0);
}

/**
 * Die Options-Slots im **eigenen** Rahmen einer Selektion: ihre Kind-Slots,
 * durch Gruppen-Anker hindurch, aber nie in eine belegte Kind-Selektion hinein.
 *
 * @param {import('../../ruleengine/readmodel/index.js').SlotIndex} slots
 * @param {string} framePath
 * @returns {Array<{ path: string, capability: any }>}
 */
function optionSlotsOfFrame(slots, framePath) {
  const found = [];
  for (const slot of slots.childSlotsOf(framePath)) {
    if (slot.capability.anchorKind === OCCUPIED_ANCHOR_KIND) continue;
    if (slot.capability.anchorKind === GROUP_ANCHOR_KIND) {
      found.push(...optionSlotsOfFrame(slots, slot.path));
    } else {
      found.push(slot);
    }
  }
  return found;
}

/**
 * Jede Selektion des Rosters, Einheiten eingeschlossen, in Baumreihenfolge.
 * @param {import('../../../shared/rostermodel/types.js').Roster} roster
 * @returns {import('../../../shared/rostermodel/types.js').Selection[]}
 */
function allSelectionsOf(roster) {
  const all = [];
  /** @param {import('../../../shared/rostermodel/types.js').Selection[]} selections */
  const visit = (selections) => {
    for (const selection of selections) {
      all.push(selection);
      visit(childSelectionsOf(selection));
    }
  };
  for (const force of roster.forces ?? []) visit(childSelectionsOf(force));
  return all;
}
