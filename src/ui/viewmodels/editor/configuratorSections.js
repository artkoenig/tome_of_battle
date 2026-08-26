import { getUnitOptions } from '../../../contexts/armylist/model';
import { subSelectionCountOf } from './optionRowDerivations.js';
import { buildStandaloneSection } from './standaloneRow.js';

/**
 * Der **Abschnittsbaum** des Auswahl-Konfigurators (ADR-0038; ADR-0035/0036).
 *
 * Die Gruppen-/Optionsliste entsteht aus den Slots des Evaluator-Berichts
 * unterhalb eines Rahmen-Pfads: belegte Slots, Pflicht-Phantome, Gruppen-Anker
 * und Angebots-Anker erscheinen; versteckte Slots (`isHidden`) erscheinen nicht.
 *
 * Die **Mitgliedschaft** Option→Gruppe bleibt Struktur des geparsten Systems
 * (Options-Sammler `getUnitOptions`); sie ordnet die Slots den Gruppen zu,
 * liefert aber weder Kandidaten noch Zustände. Der Sammler wird deshalb in
 * seiner **ungefilterten** Form befragt: welche Option sichtbar ist, sagt allein
 * der Bericht (ADR-0035).
 */

/** Die Ankerarten, deren Slots als Options-Zeilen erscheinen. */
const OPTION_ANCHOR_KINDS = new Set(['occupied', 'offerAnchor', 'mandatoryPhantom']);

/** Gruppennamen, deren Mitglieder als eigenständige Zeilen erscheinen (Alt-Verhalten). */
const ROLE_GROUP_NAMES = new Set(['rolle', 'rollen', 'role', 'roles']);

/** Ob eine Gruppe des Sammlers eine Rollen-Gruppe ist — ihre Mitglieder stehen einzeln. */
export const isRoleGroupName = (groupName) => ROLE_GROUP_NAMES.has((groupName || '').toLowerCase());

/** True, sobald irgendwo in diesem Abschnitt oder darunter etwas gewählt ist. */
export const holdsSelection = (section) => {
  if (section.kind === 'standalone') return section.count > 0;
  return section.group.items.some(({ option }) => subSelectionCountOf(section.frameSelection, option.id) > 0)
    || section.children.some(holdsSelection);
};

/**
 * Die Slots eines Rahmens, nach Zweck sortiert: Gruppen-Anker je Gruppen-Id,
 * Options-Anker je Definitions-Id. Ein Anker eines verlinkten Ziels trägt zwei
 * Ids (Link und aufgelöstes Ziel) und ist unter beiden ansprechbar.
 */
const indexFrameSlots = (slots, framePath) => {
  const optionCapabilityByDefId = new Map();
  const groupAnchorByGroupKey = new Map();
  for (const { path, capability } of slots.childSlotsOf(framePath)) {
    if (capability.anchorKind === 'groupAnchor') {
      const anchorInfo = { sortIndex: capability.sortIndex, name: capability.name };
      if (capability.defId != null && !groupAnchorByGroupKey.has(capability.defId)) {
        groupAnchorByGroupKey.set(capability.defId, anchorInfo);
      }
      if (capability.targetDefId != null && !groupAnchorByGroupKey.has(capability.targetDefId)) {
        groupAnchorByGroupKey.set(capability.targetDefId, anchorInfo);
      }
      continue;
    }
    if (!OPTION_ANCHOR_KINDS.has(capability.anchorKind)) continue;
    if (capability.defId != null && !optionCapabilityByDefId.has(capability.defId)) {
      optionCapabilityByDefId.set(capability.defId, { path, capability });
    }
    if (capability.targetDefId != null && !optionCapabilityByDefId.has(capability.targetDefId)) {
      optionCapabilityByDefId.set(capability.targetDefId, { path, capability });
    }
  }
  return { optionCapabilityByDefId, groupAnchorByGroupKey };
};

/**
 * Der Name, den der Katalog jeder in dieser Struktur vorkommenden Gruppe gibt —
 * vorab gesammelt, weil ein reiner Container seinen Namen NUR über die
 * Ahnenkette eines Nachfahren erreicht (Issue 0143, Defekt A).
 */
const catalogueGroupNamesOf = (structureItems) => {
  const byId = new Map();
  const remember = (groupId, groupName) => {
    if (groupId == null || !groupName || byId.has(groupId)) return;
    byId.set(groupId, groupName);
  };
  for (const item of structureItems) {
    if (item.ownerSelectionId) continue;
    (item.groupAncestors || []).forEach(({ id, name }) => remember(id, name));
    remember(item.groupId, item.groupName);
  }
  return byId;
};

/**
 * Primär aufsteigend nach `sortIndex` (Issue 0133), je Ebene des
 * Abschnittsbaums für sich; ein stabiler Sortierlauf erhält die
 * Bericht-/Katalogreihenfolge für den ungetaggten Rest.
 */
const sortSectionsRecursively = (list) => {
  list.sort((a, b) => {
    if (a.sortIndex === null && b.sortIndex === null) return 0;
    if (a.sortIndex === null) return 1;
    if (b.sortIndex === null) return -1;
    return a.sortIndex - b.sortIndex;
  });
  for (const section of list) {
    if (section.children?.length > 0) sortSectionsRecursively(section.children);
  }
  return list;
};

/**
 * Baut die Abschnitte eines Rahmens (Selection + ihr Slot-Pfad): Gruppen in
 * Slot-Reihenfolge, dazwischen die eigenständigen Options-Zeilen.
 *
 * Die Anker des Berichts liegen **flach** unter dem Rahmen (ADR-0036: ein
 * Angebots-Anker ist immer ein Blatt). Die Verschachtelung der Gruppen
 * ineinander ist — wie die Mitgliedschaft Option→Gruppe — Struktur des
 * geparsten Systems und kommt aus der Ahnenkette des Options-Sammlers
 * (`groupAncestors`).
 *
 * @param {Object} frameSelection
 * @param {string} framePath
 * @param {Object} context `{ slots, system, activeCatalogueId, costTypeId, costTypeLabel, subSelectionOperations }`
 * @returns {Object[]} die Wurzel-Abschnitte des Rahmens
 */
export function buildSections(frameSelection, framePath, context) {
  const { slots, system, activeCatalogueId } = context;
  const structureItems = getUnitOptions(system, activeCatalogueId, frameSelection);
  const { optionCapabilityByDefId, groupAnchorByGroupKey } = indexFrameSlots(slots, framePath);
  const catalogueGroupNameById = catalogueGroupNamesOf(structureItems);

  const orderedSections = [];
  const groupSectionByKey = new Map();
  const groupInfoById = new Map();
  /** Gruppen-Schlüssel → Schlüssel der umschließenden Gruppe (`null` = oberste Ebene). */
  const parentKeyByGroupKey = new Map();
  const seenDefIds = new Set();

  const rememberParentKey = (groupKey, parentKey) => {
    if (!groupKey || parentKeyByGroupKey.has(groupKey)) return;
    parentKeyByGroupKey.set(groupKey, parentKey ?? null);
  };

  const ensureGroupSection = (groupKey, fallbackName) => {
    let section = groupSectionByKey.get(groupKey);
    if (section) return section;
    const info = groupInfoById.get(groupKey);
    const anchor = groupAnchorByGroupKey.get(groupKey);
    section = {
      kind: 'group',
      key: groupKey,
      frameSelection,
      framePath,
      children: [],
      sortIndex: anchor?.sortIndex ?? null,
      group: {
        id: info?.id ?? groupKey,
        name: info?.name ?? anchor?.name ?? catalogueGroupNameById.get(groupKey) ?? fallbackName,
        constraints: info?.constraints ?? [],
        modifiers: info?.modifiers ?? [],
        items: [],
      },
    };
    groupSectionByKey.set(groupKey, section);
    orderedSections.push(section);
    return section;
  };

  for (const item of structureItems) {
    if (item.ownerSelectionId) continue;
    const ancestorKeys = (item.groupAncestors || []).map(ancestor => ancestor.id);
    ancestorKeys.forEach((key, index) => rememberParentKey(key, index === 0 ? null : ancestorKeys[index - 1]));
    ancestorKeys.forEach(key => ensureGroupSection(key, null));
    const enclosingKey = ancestorKeys.length > 0 ? ancestorKeys[ancestorKeys.length - 1] : null;

    const isRoleGroup = isRoleGroupName(item.groupName);
    const groupKey = (item.groupId || item.groupName) && !isRoleGroup ? (item.groupId || item.groupName) : null;
    if (groupKey !== null && !groupInfoById.has(groupKey)) {
      groupInfoById.set(groupKey, {
        id: item.groupId || item.groupName,
        name: item.groupName,
        constraints: item.groupConstraints || [],
        modifiers: item.groupModifiers || [],
      });
    }
    rememberParentKey(groupKey, enclosingKey);

    const found = optionCapabilityByDefId.get(item.option.id);
    if (!found) continue;
    const { path, capability } = found;
    if (capability.isHidden) continue;
    if (seenDefIds.has(capability.defId)) continue;
    seenDefIds.add(capability.defId);

    if (groupKey) {
      const section = ensureGroupSection(groupKey, item.groupName);
      section.group.items.push({ option: item.option, ownerSelectionId: null });
    } else {
      orderedSections.push(buildStandaloneSection({
        frameSelection, path, capability, option: item.option, context,
      }));
    }
  }

  // Kennt der Sammler die Struktur dieses Rahmens gar nicht, bleibt ein
  // Gruppen-Anker aus der obigen Schleife aussen vor: er haengt an keinem
  // Item. Er behaelt seinen Abschnitt trotzdem, allein aus dem Bericht.
  for (const groupKey of groupAnchorByGroupKey.keys()) {
    if (!groupSectionByKey.has(groupKey)) ensureGroupSection(groupKey, null);
  }

  // Sicherheitsnetz: eine Kapazitaet des Berichts ohne Gegenstueck in der
  // Katalogstruktur erscheint wenigstens, hinter allen strukturell
  // einsortierten Abschnitten, in Berichtsreihenfolge.
  for (const { path, capability } of slots.childSlotsOf(framePath)) {
    if (capability.isHidden) continue;
    if (!OPTION_ANCHOR_KINDS.has(capability.anchorKind)) continue;
    if (seenDefIds.has(capability.defId)) continue;
    seenDefIds.add(capability.defId);
    orderedSections.push(buildStandaloneSection({
      frameSelection, path, capability,
      option: { id: capability.defId, name: capability.name },
      context,
    }));
  }

  /**
   * Der Abschnitt, in dem `section` hängt: die nächste umschließende Gruppe,
   * die selbst einen Abschnitt hat.
   */
  const parentSectionOf = (section) => {
    const visited = new Set([section.key]);
    let key = parentKeyByGroupKey.get(section.key) ?? null;
    while (key !== null && !visited.has(key)) {
      const parent = groupSectionByKey.get(key);
      if (parent && parent !== section) return parent;
      visited.add(key);
      key = parentKeyByGroupKey.get(key) ?? null;
    }
    return null;
  };

  const rootSections = [];
  for (const section of orderedSections) {
    const parent = section.kind === 'standalone' ? null : parentSectionOf(section);
    if (parent) parent.children.push(section);
    else rootSections.push(section);
  }

  // Ein Abschnitt ohne Optionszeilen UND ohne verbliebene Mitgliedsgruppen hat
  // nichts zu zeigen und erscheint nicht (Issue 0131). Das setzt voraus, dass
  // der Konfigurator die Struktur dieses Rahmens kennt; liefert der Sammler
  // nichts, sagt allein der Bericht, was auf der Karte steht.
  const knowsFrameStructure = structureItems.length > 0;
  const keepSection = (section) => {
    if (section.kind === 'standalone') return true;
    section.children = section.children.filter(keepSection);
    if (!knowsFrameStructure) return true;
    return section.group.items.length > 0 || section.children.length > 0;
  };

  const kept = sortSectionsRecursively(rootSections.filter(keepSection));
  const markHolds = (section) => {
    if (section.kind === 'standalone') return;
    section.children.forEach(markHolds);
    section.hasSelectedDescendant = section.children.some(holdsSelection);
  };
  kept.forEach(markHolds);
  return kept;
}
