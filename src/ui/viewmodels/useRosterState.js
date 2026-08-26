/**
 * `useRosterState` (Issue 0162, ADR-0038): der Zustandsknoten des Editors,
 * getrennt nach Änderungsfrequenz.
 *
 * Er hält das Roster, den Auswahl-Zustand der Oberfläche und die Kommandos und
 * gibt sie in drei Bündeln zurück:
 *
 * | Bündel | Inhalt | Identität |
 * |---|---|---|
 * | `commands` | `raiseUnit`, `removeUnit`, `copyUnit`, `subSelectionOperations`, `updateRosterName`, `save`, `undo`, `redo` | stabil über die gesamte Lebensdauer |
 * | `report` | die App-Auswertung plus `unresolvedSelections` | wechselt je Bearbeitung |
 * | Auswahl | `selectedRosterSelection`, `setSelectedRosterSelection` | wechselt je Klick |
 *
 * Die Kommandos sind identitätsstabil, weil ihre Implementierungen über eine Ref
 * laufen: jeder Aufruf greift die Fassung des aktuellen Renders ab, die nach
 * außen gereichte Funktion bleibt dieselbe. Nur so kann der Kommando-Kontext aus
 * ADR-0038 sein Versprechen halten — ein Verbraucher, der bloß einen Knopf
 * auslöst, rendert bei einer Roster-Bearbeitung nicht neu.
 *
 * Was hier steht, ist der Zustandsapparat. Die Schreib-Kommandos liegen in
 * `rosterCommandBindings.js` — dünne Bindungen an die Anwendungsfälle des
 * Listen-Kontexts (Issue 0188) —, Katalog-Abgleich und Autosave in `useRosterPersistence.js`,
 * das automatische Setzen von Pflicht-Listenregeln in
 * `useMandatoryListRuleAutoAdd.js` (Issue 0176).
 */

import { useState, useMemo, useRef, useCallback } from 'react';

import { findSelectionInRoster } from '../../contexts/armylist/model';
import { rosterReportOf } from '../../contexts/ruleengine/readmodel/index.js';
import { useUndoableState } from './useUndoableState';
import { bindRosterCommands } from './rosterCommandBindings';
import { useRosterPersistence } from './useRosterPersistence';
import { useMandatoryListRuleAutoAdd } from './useMandatoryListRuleAutoAdd';
import '../../shared/rostermodel/types.js';

/** Verschiebung der Anzahl, die eine einzelne Nutzeraktion auslöst. */
const COUNT_INCREASE = 1;
const COUNT_DECREASE = -1;

/** Keine Auswahl markiert. */
/** @type {string|null} */
const NO_SELECTION = null;

/**
 * Die Kommandos vor dem ersten Render-Durchlauf. Als `null`-Literal in `useRef`
 * faellt die Ref auf den Typ `null` und traegt die Kommandos nie.
 *
 * @type {Record<string, Function>}
 */
const NO_COMMANDS_YET = {};

/**
 * Hält Roster, Auswahl und Kommandos eines Editors.
 * @param {import('../../shared/rostermodel/types.js').Roster} initialRoster
 * @param {Object} system
 * @param {Function} saveRosterCallback
 * @param {(message: string) => void} [reportError] app-wide error channel; a failed
 *   autosave reaches the user through it instead of ending in the console.
 * @param {boolean} [isFreshRoster] true when `initialRoster` was created in this
 *   session (Issue 0138): gates the automatic addition of unconditional mandatory
 *   list rules (§9.9). Omitted or false for every existing caller keeps a
 *   pre-existing roster untouched — the safe default.
 */
export function useRosterState(initialRoster, system, saveRosterCallback, reportError, isFreshRoster) {
  const {
    state: roster,
    setState: setRoster,
    replace: replaceRoster,
    undo,
    redo,
    canUndo,
    canRedo
  } = useUndoableState(initialRoster);
  const [selectedSelectionId, setSelectedSelectionId] = useState(NO_SELECTION);

  // Validierung und Kosten kommen seit Issue 0121 (Tasks 5 und 7) aus dem
  // Evaluator-Bericht (ADR 0030/0034): Verletzungen, Fähigkeitsdatensätze,
  // Kostensummen je deklarierter Kostenart, die Datensatz-Beschreibung und die
  // Zuordnungen Selection-UUID bzw. Force-UUID → Slot-Pfad — synchron aus dem aktuellen Roster
  // abgeleitet, ohne gespiegelten State. Der frühere Solver-Kostenpfad
  // (`calculateRosterCosts` → `costs`) ist entfallen; jede Kosten-Anzeige
  // liest `costTotals` bzw. die Fähigkeitsdatensätze.
  const report = rosterReportOf(system, roster);
  const { slots } = report;

  // Die ausgewählte Selection wird per ID aus dem Roster abgeleitet, statt
  // eine (schnell veraltende) Objektreferenz zu halten.
  const selectedRosterSelection = useMemo(
    () => findSelectionInRoster(roster, selectedSelectionId),
    [roster, selectedSelectionId]
  );

  const setSelectedRosterSelection = useCallback((selectionOrId) => {
    if (!selectionOrId) {
      setSelectedSelectionId(null);
    } else {
      setSelectedSelectionId(typeof selectionOrId === 'string' ? selectionOrId : selectionOrId.id);
    }
  }, []);

  const { saveNow } = useRosterPersistence({
    roster, system, replaceRoster, saveRosterCallback, reportError,
  });

  useMandatoryListRuleAutoAdd({ roster, system, slots, isFreshRoster, replaceRoster });

  // Die Fassung dieses Renders. Die nach außen gereichten Kommandos rufen sie
  // über die Ref auf, statt selbst neu zu entstehen — daher ihre Identität.
  const currentCommandsRef = useRef(NO_COMMANDS_YET);
  currentCommandsRef.current = {
    ...bindRosterCommands({
      roster, system, slots, setRoster, selectedSelectionId, setSelectedSelectionId, saveNow,
    }),
    undo,
    redo
  };

  /**
   * Die benannten Änderungsoperationen auf den Unter-Auswahlen einer Einheit.
   * Die Oberfläche erhält sie als ein Bündel, sodass jede Ebene der
   * Editor-Komponenten genau eine Stütze durchreicht statt vier.
   */
  const commands = useMemo(() => {
    const call = (name) => (...args) => currentCommandsRef.current[name](...args);
    return {
      raiseUnit: call('raiseUnit'),
      removeUnit: call('removeUnit'),
      copyUnit: call('copyUnit'),
      subSelectionOperations: {
        addInstance: call('addSubSelectionInstance'),
        removeInstance: call('removeSubSelectionInstance'),
        increaseCount: (unitSelectionId, optionDefinition) =>
          currentCommandsRef.current.changeSubSelectionCount(
            unitSelectionId, optionDefinition, COUNT_INCREASE),
        decreaseCount: (unitSelectionId, optionDefinition) =>
          currentCommandsRef.current.changeSubSelectionCount(
            unitSelectionId, optionDefinition, COUNT_DECREASE)
      },
      updateRosterName: call('updateRosterName'),
      save: call('save'),
      undo: call('undo'),
      redo: call('redo')
    };
  }, []);

  return {
    roster,
    report,
    selectedRosterSelection,
    setSelectedRosterSelection,
    commands,
    canUndo,
    canRedo
  };
}
