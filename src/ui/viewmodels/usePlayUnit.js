import { useMemo, useState } from 'react';
import {
  findEntryInSystem, resolveEntry,
  MODEL_COUNT_PROFILE_TYPES, groupProfilesByType, subSelectionsOf
} from '../../contexts/armylist/model';
import { costLimitLabelOf, costLimitTypeIdOf, EMPTY_SLOT_INDEX } from '../../contexts/ruleengine/readmodel/index.js';
import { profileCellDisplayOf } from './editor/useUnitCard';

/**
 * ViewModel der Einheitenkarte im Spielmodus (ADR-0038).
 *
 * Die Karte leitet nichts mehr im Render ab: Profil-Tabellen, Wunden, Kosten,
 * die eigenständigen Untereinheiten und der Aufklapp-Zustand entstehen hier.
 * Die Zellen-Darstellung kommt aus `editor/useUnitCard` — Editor-Tabelle und
 * Spiel-Tabelle teilen sie sich (die frühere `components/profileCellClasses.js`).
 */

const WOUND_CHARACTERISTIC_NAMES = ['w', 'wounds', 'l', 'lp', 'lebenspunkte'];

/**
 * Der höchste Wundenwert, den ein Profil des Eintrags (oder seiner Kinder)
 * nennt; ohne Fundstelle 1.
 */
export function maxWoundsOf(system, roster, selection) {
  const entryId = selection.entryLinkId || selection.selectionEntryId;
  const entry = findEntryInSystem(system, entryId, roster?.catalogueId);
  const resolved = resolveEntry(system, entry, roster?.catalogueId);
  if (!resolved) return 1;

  const searchProfiles = (profiles) => {
    if (!profiles) return null;
    for (const profile of profiles) {
      const characteristic = profile.characteristics?.find(
        c => WOUND_CHARACTERISTIC_NAMES.includes(c.name.toLowerCase()));
      if (characteristic && parseInt(characteristic.value)) return parseInt(characteristic.value);
    }
    return null;
  };

  let wounds = searchProfiles(selection.profiles)
    || searchProfiles(resolved.profiles)
    || searchProfiles(resolved.selectionEntries?.[0]?.profiles);

  if (!wounds && resolved.selectionEntries) {
    for (const child of resolved.selectionEntries) {
      wounds = searchProfiles(child.profiles);
      if (wounds) break;
    }
  }
  return wounds || 1;
}

/**
 * Die Modellzahl einer Auswahl: die eigene Anzahl für ein Modell, sonst die
 * Summe der Modell-Kinder — und ohne solche wieder die eigene Anzahl.
 */
export function modelCountOf(system, roster, selection) {
  const entryId = selection.entryLinkId || selection.selectionEntryId;
  const entry = findEntryInSystem(system, entryId, roster?.catalogueId);
  const resolved = resolveEntry(system, entry, roster?.catalogueId);

  if (!resolved) return selection.number || 1;
  if (resolved.type === 'model') return selection.number || 1;

  let totalModels = 0;
  let hasModelChildren = false;

  subSelectionsOf(selection).forEach(child => {
    const childEntryId = child.entryLinkId || child.selectionEntryId;
    if (childEntryId === null) return;
    const childEntry = findEntryInSystem(system, childEntryId, roster?.catalogueId);
    const childResolved = resolveEntry(system, childEntry, roster?.catalogueId);
    if (!childResolved) return;

    const isModel = childResolved.type === 'model'
      || child.type === 'model'
      || childResolved.profiles?.some(p =>
        MODEL_COUNT_PROFILE_TYPES.includes(p.profileTypeName?.toLowerCase()));

    if (isModel) {
      totalModels += (child.number || 1);
      hasModelChildren = true;
    }
  });

  if (!hasModelChildren) return selection.number || 1;
  return totalModels;
}

/**
 * Die Kopfzeilen einer Profil-Tabelle: jede Eigenschaft in der Reihenfolge
 * ihres ersten Auftretens.
 */
export function profileTableHeadersOf(profiles) {
  const headers = [];
  profiles.forEach(profile => {
    profile.characteristics?.forEach(c => {
      if (c.name && !headers.includes(c.name)) headers.push(c.name);
    });
  });
  return headers;
}

/**
 * @param {{
 *   selection: import('../../shared/rostermodel/types.js').Selection,
 *   system: object|null,
 *   roster: object|null,
 *   costTypes?: object[]|null,
 *   capability?: object|null,
 *   slots?: import('../../contexts/ruleengine/readmodel/index.js').SlotIndex,
 *   getUnitCurrentWounds: (selectionId: string, totalMaxWounds: number) => number,
 *   isSubUnit?: boolean,
 * }} args
 * @returns {Object} die Anzeigewerte einer Spielmodus-Einheitenkarte
 */
export function usePlayUnit({
  selection,
  system,
  roster,
  costTypes = null,
  capability = null,
  slots = EMPTY_SLOT_INDEX,
  getUnitCurrentWounds,
  isSubUnit = false,
}) {
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);

  const derived = useMemo(() => {
    // Eigenständige Untereinheiten bekommen ihre eigene Karte. Ob eine
    // Unter-Auswahl eine ist, sagt der Bericht (`capability.isIndependentSubUnit`,
    // Issue 0156) — die Spielansicht löst dafür keinen Katalog-Eintrag auf.
    const subUnits = subSelectionsOf(selection).filter(subSelection =>
      slots.isIndependentSubUnitSlot(subSelection));

    // Der Fähigkeitsdatensatz des Slots dieser Auswahl (ADR-0034): direkt
    // gereicht (`capability`) oder über den Slot-Index des Berichts.
    const slotCapability = capability ?? slots.slotOfSelection(selection);

    // Profil-Tabellen aus der Info-Projektion des Berichts, gruppiert nach
    // Profiltyp: Statblock zuerst, weitere Typen als eigene Tabelle.
    const profileGroups = groupProfilesByType(
      (slotCapability?.infoElements ?? []).filter(element => element.kind === 'profile'));

    const totalMaxWounds = modelCountOf(system, roster, selection)
      * maxWoundsOf(system, roster, selection);
    const costLimitTypeId = costLimitTypeIdOf(roster, costTypes);

    return {
      subUnits,
      hasSubUnits: subUnits.length > 0,
      slotCapability,
      name: slotCapability?.name ?? selection.name,
      modelGroup: profileGroups.find(group => group.isModel) ?? null,
      itemGroups: profileGroups.filter(group => !group.isModel),
      totalMaxWounds,
      // Kosten aus dem Bericht (ADR-0034): der Teilbaum-Betrag des Slots in der
      // Limit-Kostenart; das Label aus den Kostenarten der Beschreibung.
      totalCost: costLimitTypeId === null ? 0 : slotCapability?.totalCosts?.[costLimitTypeId] ?? 0,
      costLabel: costLimitLabelOf(roster, costTypes),
    };
  }, [selection, system, roster, costTypes, capability, slots]);

  const currentWounds = getUnitCurrentWounds(selection.id, derived.totalMaxWounds);

  return {
    ...derived,
    currentWounds,
    // Eine Karte mit eigenen Untereinheiten führt keinen eigenen Zähler und
    // gilt daher nie als vernichtet.
    isDead: derived.hasSubUnits ? false : currentWounds === 0,
    isDetailsOpen,
    toggleDetails: () => setIsDetailsOpen(open => !open),
    // Der Profil-Schalter erscheint nur auf einer Trägerkarte, die etwas zu
    // zeigen hat.
    showsDetailsToggle: !isSubUnit && (derived.modelGroup !== null || derived.itemGroups.length > 0),
    showsProfiles: !isSubUnit,
    profileCellOf: profileCellDisplayOf,
    profileTableHeadersOf,
  };
}
