import { useState, useEffect, useMemo, useRef } from 'react';

import {
  resolveEntry, syncRosterSelectionsWithSystem,
  childSelectionsOf, findSelectionInRoster, findForceContainingSelection,
  mapSelectionTree, replaceSelectionById, computeRosterCounts, aggregateRosterCategoryCounts,
  buildModifierEvalContext, createSelectionFromDef as buildSelectionFromDef,
  withAddedInstance, withoutInstance, withChangedOptionCount
} from '../roster';
import { unresolvedSelectionsOf } from '../evaluation/datasetDiagnostics';
import { useEvaluation } from '../evaluation/useEvaluation';
import { useUndoableState } from './useUndoableState';
import {
  PERSISTENCE_FAILURE_MESSAGE_KEY,
  createPersistenceFailureReporter,
} from '../utils/persistenceFailure';
import '../types.js';

const AUTOSAVE_DEBOUNCE_MS = 150;

/** Verschiebung der Anzahl, die eine einzelne Nutzeraktion auslöst. */
const COUNT_INCREASE = 1;
const COUNT_DECREASE = -1;

/** Ohne benanntes Ziel-Kontingent hebt die App in das erste des Rosters aus. */
const FALLBACK_FORCE_INDEX = 0;

/**
 * Das eine Kontingent, in das eine ausgehobene Einheit gehört: das der aktiven
 * Ansicht, ersatzweise das erste des Rosters. Ein `.ros`-Import bringt beliebig
 * viele Kontingente mit, deshalb muss das Ziel eindeutig bestimmt sein.
 * @param {import('../types.js').Force[]} forces
 * @param {string|null} targetForceId
 * @returns {import('../types.js').Force|null}
 */
function findTargetForce(forces, targetForceId) {
  if (!forces?.length) return null;
  return forces.find(force => force.id === targetForceId) ?? forces[FALLBACK_FORCE_INDEX];
}

/**
 * Hook to manage a roster state, cost calculations, validations and updates.
 * @param {import('../types.js').Roster} initialRoster
 * @param {Object} system
 * @param {Function} saveRosterCallback
 * @param {(message: string) => void} [reportError] app-wide error channel; a failed
 *   autosave reaches the user through it instead of ending in the console.
 */
export function useRoster(initialRoster, system, saveRosterCallback, reportError) {
  const {
    state: roster,
    setState: setRoster,
    replace: replaceRoster,
    undo,
    redo,
    canUndo,
    canRedo
  } = useUndoableState(initialRoster);
  const [selectedSelectionId, setSelectedSelectionId] = useState(null);

  // Validierung und Kosten kommen seit Issue 0121 (Tasks 5 und 7) aus dem
  // Evaluator-Bericht (ADR 0030/0034): Verletzungen, Fähigkeitsdatensätze,
  // Kostensummen je deklarierter Kostenart, die Datensatz-Beschreibung und die
  // Zuordnung Selection-UUID → Slot-Pfad — synchron aus dem aktuellen Roster
  // abgeleitet, ohne gespiegelten State. Der frühere Solver-Kostenpfad
  // (`calculateRosterCosts` → `costs`) ist entfallen; jede Kosten-Anzeige
  // liest `costTotals` bzw. die Fähigkeitsdatensätze.
  const { violations, capabilities, description, costTotals, pathBySelectionId, diagnostics } =
    useEvaluation(system, roster);

  // Auswahlen, deren Definition der Katalog nicht mehr kennt (stilles
  // Katalog-Update, ADR 0018). Sie sind keine Regelverletzung, muessen dem
  // Nutzer aber gemeldet werden — die Engine uebergeht sie sonst stumm.
  const unresolvedSelections = useMemo(
    () => unresolvedSelectionsOf(diagnostics, roster),
    [diagnostics, roster]
  );

  // Die ausgewählte Selection wird per ID aus dem Roster abgeleitet, statt
  // eine (schnell veraltende) Objektreferenz zu halten.
  const selectedRosterSelection = useMemo(
    () => findSelectionInRoster(roster, selectedSelectionId),
    [roster, selectedSelectionId]
  );

  const setSelectedRosterSelection = (selectionOrId) => {
    if (!selectionOrId) {
      setSelectedSelectionId(null);
    } else {
      setSelectedSelectionId(typeof selectionOrId === 'string' ? selectionOrId : selectionOrId.id);
    }
  };

  const saveCallbackRef = useRef(saveRosterCallback);
  saveCallbackRef.current = saveRosterCallback;
  const pendingSaveRef = useRef(null);
  // Über eine Ref, weil das Persistieren aus einem Timeout heraus läuft und dort sonst
  // einen veralteten Kanal aus dem Erzeugungs-Render sähe.
  const reportErrorRef = useRef(reportError);
  reportErrorRef.current = reportError;

  const persistRoster = (rosterToSave) => {
    const save = saveCallbackRef.current;
    if (!save) return;

    const reportFailure = createPersistenceFailureReporter(
      PERSISTENCE_FAILURE_MESSAGE_KEY.roster,
      reportErrorRef.current
    );

    try {
      const savePromise = save(rosterToSave);
      if (savePromise && typeof savePromise.catch === 'function') {
        savePromise.catch(reportFailure);
      }
    } catch (error) {
      reportFailure(error);
    }
  };

  // Katalog-Abgleich und Autosave. Die Verzögerung wirkt ausschließlich auf das
  // Persistieren — Anzeige und Validierung leiten sich synchron aus dem Roster ab.
  useEffect(() => {
    if (!roster || !system) return;

    const syncedRoster = syncRosterSelectionsWithSystem(roster, system);
    if (syncedRoster !== roster) {
      replaceRoster(syncedRoster);
      return;
    }

    pendingSaveRef.current = roster;
    const persistHandler = setTimeout(() => {
      persistRoster(roster);
      pendingSaveRef.current = null;
    }, AUTOSAVE_DEBOUNCE_MS);

    return () => clearTimeout(persistHandler);
  }, [roster, system, replaceRoster]);

  // Noch ausstehende Änderungen beim Unmount wegschreiben (z. B. bei schneller Navigation)
  useEffect(() => {
    return () => {
      if (pendingSaveRef.current) {
        persistRoster(pendingSaveRef.current);
        pendingSaveRef.current = null;
      }
    };
  }, []);

  /**
   * Der Katalog, gegen den die Verweise eines Kontingents auflösen: seiner, ersatzweise
   * der der Liste. Bei mehreren gleichzeitig geladenen Katalogen (ADR-0018) ist eine
   * Eintrags-Id nur innerhalb ihres Katalogs eindeutig, deshalb wird er mitgegeben.
   * @param {import('../types.js').Force|null|undefined} force
   */
  const catalogueIdOfForce = (force) => force?.catalogueId || roster?.catalogueId || null;

  /** Der Katalog des Kontingents, das die Selektion `selectionId` enthält. */
  const catalogueIdContaining = (selectionId) =>
    catalogueIdOfForce(findForceContainingSelection(roster, selectionId));

  /**
   * Bewertungskontext für die effektive `min`-Seite der Fabrik: damit ein bedingt
   * erhöhtes Gruppen-/Options-`min` (eine erzwungene Pflichtwahl) beim Ausheben als
   * solche bevölkert wird. Ohne geladenes System/Roster gibt es keinen Kontext — die
   * Fabrik fällt dann auf das rohe `min` zurück (unverändertes Verhalten).
   */
  const buildFactoryContext = (catalogueId) => {
    if (!system || !roster) return null;
    const { selectionCounts, categoryCounts } = computeRosterCounts(roster, system);
    return buildModifierEvalContext({
      roster,
      system,
      categorySlices: {
        selectionCounts,
        forceCategoryCounts: aggregateRosterCategoryCounts(categoryCounts)
      },
      parentCatalogueId: catalogueId
    });
  };

  // Geteilte Selektions-Fabrik (SSOT, ADR-0022): system/resolveEntry werden injiziert,
  // sodass Ausheben und Aushebe-Verfügbarkeit dieselbe Pflicht-Kind-Bevölkerung sehen.
  const createSelectionFromDef = (entry, categoryId, catalogueId) =>
    buildSelectionFromDef({
      system, resolveEntry, catalogueId, entry, categoryId,
      evaluationContext: buildFactoryContext(catalogueId)
    });

  /**
   * Hebt `entry` in genau ein Kontingent aus.
   * @param {Object} entry Katalogeintrag, aus dem die Selektion gebaut wird
   * @param {string} categoryId Kategorie, unter der die Einheit geführt wird
   * @param {string} [targetForceId] Kontingent der aktiven Ansicht; ohne Angabe
   *   das erste Kontingent des Rosters
   */
  const addUnit = (entry, categoryId, targetForceId = null) => {
    const newUnit = createSelectionFromDef(
      entry, categoryId, catalogueIdOfForce(findTargetForce(roster?.forces, targetForceId))
    );
    if (!newUnit) return;

    setRoster(prev => {
      const targetForce = findTargetForce(prev.forces, targetForceId);
      if (!targetForce) return prev;

      const updatedForces = prev.forces.map(force => (
        force === targetForce
          ? { ...force, selections: [...childSelectionsOf(force), newUnit] }
          : force
      ));
      return {
        ...prev,
        forces: updatedForces
      };
    });

    setSelectedSelectionId(newUnit.id);
  };

  const removeUnit = (selectionId) => {
    setRoster(prev => {
      const updatedForces = prev.forces.map(force => {
        return {
          ...force,
          selections: force.selections.filter(s => s.id !== selectionId)
        };
      });
      return {
        ...prev,
        forces: updatedForces
      };
    });

    if (selectedSelectionId === selectionId) {
      setSelectedSelectionId(null);
    }
  };

  const copyUnit = (selectionId) => {
    // Jede Selection des Teilbaums erhält eine frische Id, damit die Kopie mit
    // dem Original nicht kollidiert.
    const cloneSelection = (unit) => mapSelectionTree(unit, (selection, clonedChildren) => ({
      ...selection,
      id: crypto.randomUUID(),
      selections: clonedChildren
    }));

    setRoster(prev => {
      let unitToCopy = null;
      for (const force of prev.forces) {
        unitToCopy = force.selections?.find(s => s.id === selectionId);
        if (unitToCopy) break;
      }
      if (!unitToCopy) return prev;

      const clonedUnit = cloneSelection(unitToCopy);

      const updatedForces = prev.forces.map(force => {
        if (force.selections?.some(s => s.id === selectionId)) {
          const idx = force.selections.findIndex(s => s.id === selectionId);
          const newSelections = [...force.selections];
          newSelections.splice(idx + 1, 0, clonedUnit);
          return {
            ...force,
            selections: newSelections
          };
        }
        return force;
      });

      return {
        ...prev,
        forces: updatedForces
      };
    });
  };

  /**
   * Ersetzt die Kind-Liste der Einheit `unitSelectionId` — beliebiger Tiefe im
   * Roster — durch das Ergebnis von `changeChildSelections`. Die gemeinsame
   * Verdrahtung aller Unter-Auswahl-Operationen mit dem Roster-State.
   * @param {string} unitSelectionId
   * @param {(childSelections: import('../types.js').Selection[]) => import('../types.js').Selection[]} changeChildSelections
   */
  const updateUnitChildSelections = (unitSelectionId, changeChildSelections) => {
    setRoster(prev => {
      const updatedForces = prev.forces.map(force => {
        const currentSelections = childSelectionsOf(force);
        const updatedSelections = replaceSelectionById(currentSelections, unitSelectionId, unit => ({
          ...unit,
          selections: changeChildSelections(childSelectionsOf(unit))
        }));
        if (updatedSelections === currentSelections) return force;
        return { ...force, selections: updatedSelections };
      });

      return { ...prev, forces: updatedForces };
    });
  };

  /** Legt eine weitere, eigenständig geführte Instanz einer Option an. */
  const addSubSelectionInstance = (unitSelectionId, optionDefinition) =>
    updateUnitChildSelections(unitSelectionId, childSelections =>
      withAddedInstance(childSelections, createSelectionFromDef(
        optionDefinition, null, catalogueIdContaining(unitSelectionId)
      )));

  /** Entfernt eine einzeln geführte Instanz anhand ihrer Selection-Id. */
  const removeSubSelectionInstance = (unitSelectionId, instanceSelectionId) =>
    updateUnitChildSelections(unitSelectionId, childSelections =>
      withoutInstance(childSelections, instanceSelectionId));

  const changeSubSelectionCount = (unitSelectionId, optionDefinition, countDelta) =>
    updateUnitChildSelections(unitSelectionId, childSelections =>
      withChangedOptionCount(
        childSelections,
        optionDefinition.id,
        countDelta,
        () => createSelectionFromDef(optionDefinition, null, catalogueIdContaining(unitSelectionId))
      ));

  /**
   * Die benannten Änderungsoperationen auf den Unter-Auswahlen einer Einheit.
   * Die Oberfläche erhält sie als ein Bündel, sodass jede Ebene der
   * Editor-Komponenten genau eine Stütze durchreicht statt vier.
   */
  const subSelectionOperations = {
    addInstance: addSubSelectionInstance,
    removeInstance: removeSubSelectionInstance,
    increaseCount: (unitSelectionId, optionDefinition) =>
      changeSubSelectionCount(unitSelectionId, optionDefinition, COUNT_INCREASE),
    decreaseCount: (unitSelectionId, optionDefinition) =>
      changeSubSelectionCount(unitSelectionId, optionDefinition, COUNT_DECREASE)
  };

  const updateRosterName = (newName) => {
    setRoster(prev => ({
      ...prev,
      name: newName
    }));
  };

  const save = async () => {
    if (saveCallbackRef.current) {
      await saveCallbackRef.current(roster);
    }
  };

  return {
    roster,
    violations,
    capabilities,
    description,
    costTotals,
    pathBySelectionId,
    unresolvedSelections,
    selectedRosterSelection,
    setSelectedRosterSelection,
    addUnit,
    removeUnit,
    copyUnit,
    subSelectionOperations,
    updateRosterName,
    save,
    undo,
    redo,
    canUndo,
    canRedo
  };
}
