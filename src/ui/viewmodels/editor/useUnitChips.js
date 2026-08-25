import { useMemo } from 'react';
import {
  resolveEntry,
  findEntryInSystem,
  groupProfilesByType,
  UPGRADE_DETAILS_KEYWORDS,
} from '../../../domain/roster';
import { useRosterReport } from '../rosterContexts';
import { publicationRefOf, upgradeDetailElementsOf } from './upgradeDetailElements.js';

/**
 * ViewModel der Chip-Reihen einer Einheit (ADR-0038).
 *
 * Aufwertungs- und Regel-Chips lesen denselben Bericht wie die Karte: die
 * gewählten Unter-Auswahlen ohne die eigenständigen Untereinheiten
 * (`capability.isIndependentSubUnit`) und die Info-Projektion des Slots
 * (`capability.infoElements`). Die Komponente bekommt fertige Chips und muss
 * den Slot-Index des Berichts nicht kennen.
 */

/** Die Profil-Einträge der Info-Projektion eines Slots (`kind: 'profile'`). */
const profileElementsOf = (slot) =>
  (slot?.infoElements ?? []).filter(element => element.kind === 'profile');

/**
 * Die gewählten Unter-Auswahlen einer Einheit, die als Chip erscheinen: der
 * Teilbaum ohne die **eigenständigen Untereinheiten** — die tragen ihre eigene
 * Karte und ihre eigenen Chips. Die Katalog-Auflösung daneben bleibt reines
 * Beiwerk für Detail-/Regeltexte.
 */
const getSelectedUpgrades = (sel, system, activeCatalogueId, slots) => {
  const list = [];
  const collect = (node) => {
    if (!node.selections) return;
    node.selections.forEach(subSel => {
      const entryId = subSel.entryLinkId || subSel.selectionEntryId;
      const entry = findEntryInSystem(system, entryId, activeCatalogueId);
      const resolved = resolveEntry(system, entry, activeCatalogueId);

      const isIndependent = slots.isIndependentSubUnitSlot(subSel);

      if (resolved && !isIndependent) {
        list.push({
          id: subSel.id,
          name: subSel.name,
          number: subSel.number || 1,
          resolved: resolved,
          capability: slots.slotOfSelection(subSel) ?? null,
        });
        collect(subSel);
      }
    });
  };
  collect(sel);
  return list;
};

/** Die Regeltexte der Info-Projektion eines Slots (`kind: 'rule'`). */
const ruleElementsOf = (capability) =>
  (capability?.infoElements ?? []).filter(element => element.kind === 'rule');

/**
 * Ob die Aufwertung einen eigenen Regeltext mitbringt — gefragt wird der
 * Bericht (`capability.infoElements`), nicht mehr der Katalog unter dem Namen
 * des Eintrags.
 */
const hasLore = (capability) =>
  ruleElementsOf(capability).some(rule => rule.text && rule.text.trim());

/**
 * Die Aufwertungen, die als Chip erscheinen: die gewählten Unter-Auswahlen ohne
 * die, die bereits in einer Profil-Tabelle der Karte stehen — es sei denn, sie
 * tragen einen eigenen Regeltext.
 *
 * Welche Profile die Karte tabelliert, sagt der **Bericht**
 * (`capability.infoElements`): dieselbe Info-Projektion, aus der die Karte ihre
 * Tabellen zeichnet, statt eines zweiten Katalog-Durchlaufs. Ob eine Aufwertung
 * darin steht, entscheidet die Id ihres Profil-Eintrags — ersatzweise (für
 * Profile, die unter einem anderen Namen tabelliert sind) der Name.
 */
const getVisibleUpgrades = (sel, system, activeCatalogueId, slots) => {
  const unitSlot = slots.slotOfSelection(sel);
  const tableProfiles = groupProfilesByType(profileElementsOf(unitSlot))
    .filter(g => !g.isModel).flatMap(g => g.profiles);
  const tableProfileIds = new Set(tableProfiles.map(p => p.id).filter(Boolean));

  const isNameMatch = (selN, profN) => {
    if (!selN || !profN) return false;
    const s = selN.toLowerCase().trim();
    const p = profN.toLowerCase().trim();
    return s === p ||
           (s.endsWith('s') && s.slice(0, -1) === p) ||
           (p.endsWith('s') && p.slice(0, -1) === s) ||
           s.includes(p) ||
           p.includes(s);
  };

  const hasOwnValue = (res, capability) => {
    if (!res) return false;
    const hasCost = (res.costs || []).some(c => Math.abs(parseFloat(c.value) || 0) > 0);
    const hasProfile = (res.profiles || []).length > 0;
    return hasCost || hasProfile || hasLore(capability);
  };

  const isEmptyWrapper = (res, capability) => {
    if (!res || hasOwnValue(res, capability)) return false;
    const childCount = (res.selectionEntries?.length || 0) +
                       (res.entryLinks?.length || 0) +
                       (res.selectionEntryGroups?.length || 0);
    return childCount > 0;
  };

  return getSelectedUpgrades(sel, system, activeCatalogueId, slots).filter(upgrade => {
    const res = upgrade.resolved;
    if (isEmptyWrapper(res, upgrade.capability)) return false;
    const name = upgrade.name || res?.name;
    const inTable = profileElementsOf(upgrade.capability).some(p => tableProfileIds.has(p.id)) ||
                    (name && tableProfiles.some(p => isNameMatch(name, p.name)));
    if (!inTable) return true;
    return hasLore(upgrade.capability);
  });
};

/**
 * Der Kurztext eines Aufwertungs-Chips — aus der Info-Projektion des Slots
 * (`capability.infoElements`) und seiner eigenen Buchquelle
 * (`capability.source`), nie aus einem zweiten Katalog-Durchlauf.
 */
const getUpgradeDescription = (capability) => {
  if (!capability) return '';
  const descriptions = [];
  const suffixOf = (source) => {
    const ref = publicationRefOf(source);
    return ref ? ` ${ref}` : '';
  };

  ruleElementsOf(capability).forEach(rule => {
    if (rule.text) descriptions.push(`${rule.text}${suffixOf(rule.source)}`);
  });
  profileElementsOf(capability).forEach(profile => {
    const typeLower = profile.profileTypeName?.toLowerCase() || '';
    if (!UPGRADE_DETAILS_KEYWORDS.some(k => typeLower.includes(k))) return;
    (profile.characteristics ?? []).forEach(c => {
      if (c.value) descriptions.push(`${c.name}: ${c.value}${suffixOf(profile.source)}`);
    });
  });
  if (descriptions.length === 0) {
    const ownRef = publicationRefOf(capability.source);
    if (ownRef) descriptions.push(ownRef);
  }
  return descriptions.join(' | ');
};

const normalizeChipName = (n) => (n || '').toLowerCase().replace(/[^a-z0-9]/g, '');

/**
 * @param {{ selection: import('../../../shared/rostermodel/types.js').Selection }} args
 * @returns {{ upgrades: object[], rules: object[], system: Object|null }}
 */
export function useUnitChips({ selection }) {
  const { report, system, activeCatalogue } = useRosterReport();
  const { slots } = report;
  const activeCatalogueId = activeCatalogue?.id ?? null;

  return useMemo(() => {
    const selectedUpgrades = getSelectedUpgrades(selection, system, activeCatalogueId, slots);
    const upgrades = getVisibleUpgrades(selection, system, activeCatalogueId, slots).map(upgrade => ({
      id: upgrade.id,
      name: upgrade.name,
      number: upgrade.number,
      resolved: upgrade.resolved,
      chipName: upgrade.resolved?.name || upgrade.name,
      descText: getUpgradeDescription(upgrade.capability),
      detailElements: upgradeDetailElementsOf(upgrade.capability),
    }));

    // Die Regeln kommen aus der Info-Projektion des Slots
    // (`capability.infoElements`, Einträge `{ kind: 'rule', name, text }`) —
    // samt der von belegten Unter-Auswahlen geerbten. Die Entdopplung gegen die
    // Aufwertungs-Chips läuft über die **gewählten** Unter-Auswahlen: eine
    // Regel, die schon als Aufwertungs-Chip erscheint, wird nicht doppelt gezeigt.
    const slotCapability = slots.slotOfSelection(selection);
    const upgradeChipNames = new Set(
      selectedUpgrades.map(u => normalizeChipName(u.name || u.resolved?.name)).filter(Boolean)
    );
    const rules = (slotCapability?.infoElements ?? [])
      .filter(element => element.kind === 'rule')
      .filter(rule => !upgradeChipNames.has(normalizeChipName(rule.name)))
      .map((rule, index) => ({
        key: rule.id || index,
        name: rule.name,
        text: rule.text || '',
      }));

    return { upgrades, rules, system };
  }, [selection, system, activeCatalogueId, slots]);
}
