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
 * Roster hinein, Roster heraus; den Bericht holt sich der Anwendungsfall ueber
 * die eine Tuer des Lesemodells (`evaluateAppRoster`, gecacht je Paar aus System
 * und Roster). Die Bindung im Editor ruft ihn **im selben Undo-Schritt** wie die
 * ausloesende Aenderung, sodass ein Rueckgaengig beides zurueckholt.
 */

import { childSelectionsOf } from '../model/rosterTree.js';
import { evaluateAppRoster } from '../../ruleengine/readmodel/index.js';
import '../../../shared/rostermodel/types.js';

/**
 * Obergrenze der Durchlaeufe: eine Entfernung kann eine weitere Option
 * unerreichbar machen, die Kette ist aber endlich (das Roster schrumpft je
 * Durchlauf) — die Grenze schuetzt nur gegen einen nicht konvergierenden Bericht.
 */
const MAX_PASSES = 8;

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
