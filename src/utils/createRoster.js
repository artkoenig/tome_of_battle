/**
 * Baut aus den Eingaben des Anlege-Dialogs ein vollständiges Roster-Objekt.
 *
 * Bewusst ein reiner Helfer neben {@link ./rosterDefaults.js}: der Objektaufbau
 * (Default-Kostenart aus dem System, initialer Spielzustand, erste Streitmacht)
 * lag zuvor inline in `App.jsx` und ist ein eigener, isoliert testbarer Belang.
 */

import { DEFAULT_ROSTER_COST_LIMIT, createInitialGameState } from './rosterDefaults';

/**
 * Erzeugt ein neues Roster aus den Formularwerten und der Systemdefinition.
 *
 * Kein reiner Wert im strengen Sinn — `crypto.randomUUID` liefert je Aufruf neue
 * Ids —, aber ohne verdeckte Seiteneffekte: gleiche Eingaben ergeben dieselbe
 * Struktur. Katalogspezifische Ids (Kostenart, Streitmacht) werden aus der
 * Systemdefinition abgeleitet und niemals erfunden.
 *
 * @param {{name: string, systemId: string, catId: string, forceEntryId?: string, limit?: string|number}} formValues
 * @param {{costTypes?: {id: string}[], forceEntries?: {id: string}[]}|undefined} systemDef
 * @returns {Object} das neue Roster-Objekt
 */
export function buildRoster({ name, systemId, catId, forceEntryId, limit }, systemDef) {
  // Ein neues Roster wird in der ersten vom System deklarierten Kostenart geführt;
  // eine Kostenart-id ist katalogspezifisch und darf nicht erfunden werden.
  const costType = systemDef?.costTypes?.[0]?.id ?? null;

  return {
    id: crypto.randomUUID(),
    name,
    systemId,
    catalogueId: catId,
    costLimit: parseInt(limit) || DEFAULT_ROSTER_COST_LIMIT,
    costLimitType: costType,
    forces: [{
      id: crypto.randomUUID(),
      forceEntryId: forceEntryId || systemDef?.forceEntries?.[0]?.id || null,
      catalogueId: catId,
      selections: []
    }],
    gameState: createInitialGameState()
  };
}
