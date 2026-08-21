/**
 * `useRosterState` (Issue 0162, ADR-0038): der Zustandsknoten des Editors,
 * getrennt nach Änderungsfrequenz.
 *
 * Er hält das Roster, den Auswahl-Zustand der Oberfläche und die Kommandos und
 * gibt sie in drei Bündeln zurück:
 *
 * | Bündel | Inhalt | Identität |
 * |---|---|---|
 * | `commands` | `addUnit`, `removeUnit`, `copyUnit`, `subSelectionOperations`, `updateRosterName`, `save`, `undo`, `redo` | stabil über die gesamte Lebensdauer |
 * | `report` | die App-Auswertung plus `unresolvedSelections` | wechselt je Bearbeitung |
 * | Auswahl | `selectedRosterSelection`, `setSelectedRosterSelection` | wechselt je Klick |
 *
 * Die Kommandos sind identitätsstabil, weil ihre Implementierungen über eine Ref
 * laufen: jeder Aufruf greift die Fassung des aktuellen Renders ab, die nach
 * außen gereichte Funktion bleibt dieselbe. Nur so kann der Kommando-Kontext aus
 * ADR-0038 sein Versprechen halten — ein Verbraucher, der bloß einen Knopf
 * auslöst, rendert bei einer Roster-Bearbeitung nicht neu.
 *
 * `useRoster` in `src/ui/hooks/` ist die flache Sicht auf denselben Zustand und
 * bleibt der Aufrufer für die noch nicht umgestellten Komponenten.
 */

import { useState, useEffect, useMemo, useRef, useCallback } from 'react';

import {
  resolveEntry, syncRosterSelectionsWithSystem,
  childSelectionsOf, findSelectionInRoster, findForceContainingSelection,
  mapSelectionTree, replaceSelectionById,
  createSelectionFromDef as buildSelectionFromDef,
  withAddedInstance, withoutInstance, withChangedOptionCount
} from '../../domain/roster';
import { findMissingMandatoryListRules } from '../../domain/evaluation/mandatoryListRules';
import { findCapabilityEntry } from './capabilityEntries';
import { useRosterReportModel } from '../../domain/evaluation/rosterReport';
import { useUndoableState } from '../hooks/useUndoableState';
import {
  PERSISTENCE_FAILURE_MESSAGE_KEY,
  createPersistenceFailureReporter,
} from '../hooks/persistenceFailure';
import '../../shared/types.js';

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
 * @param {import('../../shared/types.js').Force[]} forces
 * @param {string|null} targetForceId
 * @returns {import('../../shared/types.js').Force|null}
 */
function findTargetForce(forces, targetForceId) {
  if (!forces?.length) return null;
  return forces.find(force => force.id === targetForceId) ?? forces[FALLBACK_FORCE_INDEX];
}

/**
 * Hält Roster, Auswahl und Kommandos eines Editors.
 * @param {import('../../shared/types.js').Roster} initialRoster
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
  const [selectedSelectionId, setSelectedSelectionId] = useState(null);

  // Validierung und Kosten kommen seit Issue 0121 (Tasks 5 und 7) aus dem
  // Evaluator-Bericht (ADR 0030/0034): Verletzungen, Fähigkeitsdatensätze,
  // Kostensummen je deklarierter Kostenart, die Datensatz-Beschreibung und die
  // Zuordnungen Selection-UUID bzw. Force-UUID → Slot-Pfad — synchron aus dem aktuellen Roster
  // abgeleitet, ohne gespiegelten State. Der frühere Solver-Kostenpfad
  // (`calculateRosterCosts` → `costs`) ist entfallen; jede Kosten-Anzeige
  // liest `costTotals` bzw. die Fähigkeitsdatensätze.
  const report = useRosterReportModel(system, roster);
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
   * @param {import('../../shared/types.js').Force|null|undefined} force
   */
  const catalogueIdOfForce = (force) => force?.catalogueId || roster?.catalogueId || null;

  /** Der Katalog des Kontingents, das die Selektion `selectionId` enthält. */
  const catalogueIdContaining = (selectionId) =>
    catalogueIdOfForce(findForceContainingSelection(roster, selectionId));

  // Geteilte Selektions-Fabrik (SSOT, ADR-0022): system/resolveEntry werden injiziert.
  // **Welche** Pflicht-Mitglieder mitkommen, sagt seit Issue 0157 der Bericht
  // (`capability.raiseMembers`, ADR-0034) — dieselbe Auskunft, aus der auch der vor
  // dem Ausheben angezeigte Preis (`raiseCosts`) stammt, sodass Anzeige und
  // angelegter Baum aus einem Durchlauf kommen. Der Katalog wird nur noch
  // aufgelöst, nicht mehr ausgewertet.
  /**
   * @param {Object} entry
   * @param {string|null} categoryId
   * @param {string|null} catalogueId
   * @param {ReadonlyArray<any>} [mandatoryMembers]
   */
  const createSelectionFromDef = (entry, categoryId, catalogueId, mandatoryMembers = []) =>
    buildSelectionFromDef({
      system, resolveEntry, catalogueId, entry, categoryId, mandatoryMembers
    });

  /** Die Pflicht-Mitglieder, die der Bericht dem Angebot `defId` unter `forceId` gibt. */
  const raiseMembersInForce = (forceId, defId) =>
    slots.findChildSlot(slots.pathOfForce(forceId), defId)?.raiseMembers ?? [];

  /** Dieselbe Frage unterhalb einer Einheit: eine Option hängt ggf. unter einem Gruppen-Anker. */
  const raiseMembersUnderSelection = (selectionId, defId) =>
    slots.findDescendantSlot(slots.pathOfSelection(selectionId), defId)?.raiseMembers ?? [];

  // Automatisches Setzen eindeutiger Pflicht-Listenregeln (Issue 0138, §9.9):
  // gated auf `isFreshRoster`, damit ein bereits bestehendes Roster nie
  // rückwirkend verändert wird (AC4). Läuft — wie der Katalog-Sync-Effekt —
  // über `replaceRoster`, also ohne eigenen Undo-Schritt: der Nutzer hat
  // diesen Eintrag nie selbst angeklickt.
  //
  // **Welche** Regeln das sind, sagt seit Issue 0157 der Bericht
  // (`findMissingMandatoryListRules`, ADR-0034): er zählt das Angebot des
  // Kontingents auf und markiert je Slot Listenregel, armeeweite Pflicht,
  // Sichtbarkeit und Belegung. Der Katalog wird nur noch für den **Eintrag**
  // gelesen, aus dem die Selektion gebaut wird. Kein Endlosschleifen-Risiko:
  // eine einmal hinzugefügte Regel steht im nächsten Bericht als `occupied`
  // und fehlt damit nicht mehr. Läuft je Force erneut bei jeder
  // Roster-Änderung in derselben Sitzung, sodass eine erst durch eine andere
  // Wahl sichtbar gewordene Pflichtregel im selben Zug ergänzt wird.
  useEffect(() => {
    if (!roster || !system || !isFreshRoster) return;

    let anyAdded = false;
    // Eine armeeweite Pflicht wird genau einmal gesetzt: was ein frueheres
    // Kontingent dieses Durchlaufs uebernommen hat, faellt fuer die spaeteren
    // heraus (der Bericht des naechsten Durchlaufs meldet sie dann als belegt).
    const claimedResolvedIds = new Set();
    const updatedForces = (roster.forces || []).map(force => {
      const catalogueId = catalogueIdOfForce(force);
      const carriedEntryIds = new Set(
        childSelectionsOf(force).map(selection => selection.entryLinkId || selection.selectionEntryId)
      );
      const missing = findMissingMandatoryListRules(slots, slots.pathOfForce(force.id), {
        entryOf: (capability) => findCapabilityEntry(system, capability, catalogueId),
        skipResolvedIds: claimedResolvedIds,
      }).filter(({ entry, defId }) => entry && !carriedEntryIds.has(defId));
      if (missing.length === 0) return force;

      missing.forEach(({ resolvedId }) => claimedResolvedIds.add(resolvedId));
      const newSelections = missing
        .map(({ entry, categoryId, mandatoryMembers }) =>
          createSelectionFromDef(entry, categoryId, catalogueId, mandatoryMembers))
        .filter(Boolean);
      if (newSelections.length === 0) return force;

      anyAdded = true;
      return { ...force, selections: [...childSelectionsOf(force), ...newSelections] };
    });

    if (anyAdded) {
      replaceRoster({ ...roster, forces: updatedForces });
    }
  }, [roster, system, isFreshRoster, replaceRoster, slots]);

  /**
   * Hebt `entry` in genau ein Kontingent aus.
   * @param {Object} entry Katalogeintrag, aus dem die Selektion gebaut wird
   * @param {string} categoryId Kategorie, unter der die Einheit geführt wird
   * @param {string} [targetForceId] Kontingent der aktiven Ansicht; ohne Angabe
   *   das erste Kontingent des Rosters
   */
  const addUnit = (entry, categoryId, targetForceId = null) => {
    const force = findTargetForce(roster?.forces, targetForceId);
    const newUnit = createSelectionFromDef(
      entry, categoryId, catalogueIdOfForce(force),
      raiseMembersInForce(force?.id, entry.id)
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
   * @param {(childSelections: import('../../shared/types.js').Selection[]) => import('../../shared/types.js').Selection[]} changeChildSelections
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
        optionDefinition, null, catalogueIdContaining(unitSelectionId),
        raiseMembersUnderSelection(unitSelectionId, optionDefinition.id)
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
        () => createSelectionFromDef(
          optionDefinition, null, catalogueIdContaining(unitSelectionId),
          raiseMembersUnderSelection(unitSelectionId, optionDefinition.id)
        )
      ));

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

  // Die Fassung dieses Renders. Die nach außen gereichten Kommandos rufen sie
  // über die Ref auf, statt selbst neu zu entstehen — daher ihre Identität.
  const currentCommandsRef = useRef(null);
  currentCommandsRef.current = {
    addUnit,
    removeUnit,
    copyUnit,
    addSubSelectionInstance,
    removeSubSelectionInstance,
    changeSubSelectionCount,
    updateRosterName,
    save,
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
      addUnit: call('addUnit'),
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
