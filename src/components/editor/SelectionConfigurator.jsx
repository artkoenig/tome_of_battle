import React from 'react';
import { Plus, Minus } from 'lucide-react';
import {
  resolveEntry, computeRosterCounts, isIndependentSubUnit,
  getUnitOptions, findForceContainingSelection,
  resolveCostLimitTypeId, resolveCostLimitLabel,
  countSelections, classifyStandaloneOption,
  UPGRADE_DETAILS_KEYWORDS
} from '../../roster';
import { childSlotsOf } from '../../evaluation/slotLookups';
import OptionGroupComponent from './OptionGroup';
import { renderUpgradeDetails } from './upgradeDetails';
import RuleChipIcon from './RuleChipIcon';
import { findSelectionById, resolveRowSelectionId } from './optionNesting';
import { useTranslation } from '../../i18n/useTranslation';

/**
 * Auswahl-Konfigurator einer Selection (Issue 0121, Task 6; ADR-0035/0036).
 *
 * Die Gruppen-/Optionsliste entsteht aus den **Slots des Evaluator-Berichts**
 * unterhalb des Slot-Pfads der Selection (`pathBySelectionId` →
 * `capabilities`): belegte Slots, Pflicht-Phantome, Gruppen-Anker und
 * Angebots-Anker erscheinen; versteckte Slots (`isHidden`) und die Slots
 * fremder Selektionen erscheinen nicht. Zustand, Grenzen, Kosten und Namen
 * werden je Slot abgelesen (ADR-0035: Verfügbarkeit ist eine Eigenschaft des
 * Berichts, kein Rechenergebnis der Oberfläche).
 *
 * Die **Mitgliedschaft** Option→Gruppe bleibt Struktur des geparsten Systems
 * (Options-Sammler des Schreibmodells `src/roster/`); sie ordnet die Slots den Gruppen zu,
 * liefert aber weder Kandidaten noch Zustände. Eine belegte Unter-Auswahl ist
 * selbst ein Rahmen: ihre Kind-Slots rendern eingerückt unter ihrer Zeile.
 */

/** Die Ankerarten, deren Slots als Options-Zeilen erscheinen. */
const OPTION_ANCHOR_KINDS = new Set(['occupied', 'offerAnchor', 'mandatoryPhantom']);

/** Gruppennamen, deren Mitglieder als eigenständige Zeilen erscheinen (Alt-Verhalten). */
const ROLE_GROUP_NAMES = new Set(['rolle', 'rollen', 'role', 'roles']);

export default function SelectionConfigurator({
  selection,
  capabilities,
  pathBySelectionId,
  system,
  roster,
  subSelectionOperations,
  activeCatalogue,
  handleMouseEnter,
  handleMouseMove,
  handleMouseLeave,
  setActiveInfo,
  onShowRule,
  isListRule = false
}) {
  const { t } = useTranslation();
  const { selectionCounts, categoryCounts } = computeRosterCounts(roster, system);
  const costTypeId = resolveCostLimitTypeId(roster, system);
  const costTypeLabel = resolveCostLimitLabel(roster, system);
  const activeForce = findForceContainingSelection(roster, selection.id);
  const forceCategoryCounts = activeForce ? (categoryCounts[activeForce.id] || {}) : {};

  // Helper to compile a clean description string for an upgrade/magic item
  const getOptionDescription = (res) => {
    if (!res) return '';
    const descriptions = [];

    let rules = res.rules || [];
    if (rules.length === 0 && res.name) {
      const lowerName = res.name.toLowerCase().trim();
      let foundRule = system.sharedRules?.find(r => r.name?.toLowerCase().trim() === lowerName);
      if (!foundRule) {
        for (const cat of system.catalogues || []) {
          foundRule = cat.sharedRules?.find(r => r.name?.toLowerCase().trim() === lowerName);
          if (foundRule) break;
        }
      }
      if (foundRule) {
        rules = [foundRule];
      }
    }

    if (rules.length > 0) {
      rules.forEach(r => {
        if (r.description) {
          const ref = r.publicationRef ? ` ${r.publicationRef}` : '';
          descriptions.push(`${r.description}${ref}`);
        }
      });
    }
    if (res.profiles && res.profiles.length > 0) {
      res.profiles.forEach(p => {
        const typeLower = p.profileTypeName?.toLowerCase() || '';
        if (UPGRADE_DETAILS_KEYWORDS.some(k => typeLower.includes(k))) {
          const stats = p.characteristics.map(c => `${c.name}: ${c.value}`).join(', ');
          const ref = p.publicationRef ? ` ${p.publicationRef}` : '';
          descriptions.push(`${p.name} (${stats})${ref}`);
        }
      });
    }
    if (descriptions.length === 0 && res.publicationRef) {
      descriptions.push(res.publicationRef);
    }
    return descriptions.join(' | ');
  };

  const getSubSelectionCount = (unitSelection, optionEntryId) => {
    const matchesOption = (sel) =>
      (sel.entryLinkId || sel.selectionEntryId) === optionEntryId;
    return countSelections(unitSelection.selections, {
      includeChildSelections: true,
      predicate: matchesOption,
    });
  };

  // Struktur-Kontext des Options-Sammlers: er liefert die Mitgliedschaft
  // Option→Gruppe und die Options-Objekte für die Schreiboperationen — die
  // Kandidaten selbst kommen aus den Slots des Berichts.
  const visibilityContext = { roster, selectionCounts, forceCategoryCounts, force: activeForce };

  /**
   * Baut die Abschnitte eines Rahmens (Selection + ihr Slot-Pfad): Gruppen in
   * Slot-Reihenfolge, dazwischen die eigenständigen Options-Zeilen.
   *
   * Die Anker des Berichts liegen **flach** unter dem Rahmen (ADR-0036: ein
   * Angebots-Anker ist immer ein Blatt). Die Verschachtelung der Gruppen
   * ineinander ist — wie die Mitgliedschaft Option→Gruppe — Struktur des
   * geparsten Systems und kommt aus der Ahnenkette des Options-Sammlers
   * (`groupAncestorIds`). Eine Gruppe, deren Kinder ausschließlich Links auf
   * andere Gruppen sind („Container-Gruppe"), hält ihre Mitglieder damit im
   * eigenen Abschnitt, statt sie als Geschwister neben sich zu stellen
   * (Issue 0131).
   */
  const buildSections = (frameSelection, framePath) => {
    const structureItems = getUnitOptions(system, activeCatalogue?.id, frameSelection, visibilityContext);

    // Mitgliedschaft und Gruppen-Struktur der DIREKTEN Optionen dieses Rahmens
    // (re-emittierte Items fremder Unter-Auswahlen gehören deren Rahmen).
    const membershipByOptionId = new Map();
    const groupInfoById = new Map();
    /** Gruppen-Schlüssel → Schlüssel der umschließenden Gruppe (`null` = oberste Ebene). */
    const parentKeyByGroupKey = new Map();

    const rememberParentKey = (groupKey, parentKey) => {
      if (!groupKey || parentKeyByGroupKey.has(groupKey)) return;
      parentKeyByGroupKey.set(groupKey, parentKey ?? null);
    };

    for (const item of structureItems) {
      if (item.ownerSelectionId) continue;
      // Die Ahnenkette nennt jede umschließende Gruppe — auch die, die selbst
      // keine Option beisteuert (der Container-Fall).
      const ancestorKeys = item.groupAncestorIds || [];
      ancestorKeys.forEach((key, index) => rememberParentKey(key, index === 0 ? null : ancestorKeys[index - 1]));
      const enclosingKey = ancestorKeys.length > 0 ? ancestorKeys[ancestorKeys.length - 1] : null;

      if (!item.groupId && !item.groupName) {
        if (!membershipByOptionId.has(item.option.id)) {
          membershipByOptionId.set(item.option.id, { item, groupKey: null });
        }
        continue;
      }
      const isRoleGroup = ROLE_GROUP_NAMES.has((item.groupName || '').toLowerCase());
      const groupKey = isRoleGroup ? null : (item.groupId || item.groupName);
      if (groupKey !== null && !groupInfoById.has(groupKey)) {
        groupInfoById.set(groupKey, {
          id: item.groupId || item.groupName,
          name: item.groupName,
          constraints: item.groupConstraints || [],
          modifiers: item.groupModifiers || [],
        });
      }
      rememberParentKey(groupKey, enclosingKey);
      if (!membershipByOptionId.has(item.option.id)) {
        membershipByOptionId.set(item.option.id, { item, groupKey });
      }
    }

    const orderedSections = [];
    const groupSectionByKey = new Map();
    const seenDefIds = new Set();

    const ensureGroupSection = (groupKey, fallbackName, sortIndex = null) => {
      let section = groupSectionByKey.get(groupKey);
      if (section) {
        // Der Gruppen-Anker traegt den massgeblichen sortIndex; kam die Sektion
        // (Reihenfolge-Zufall) schon vorher ueber ein Mitglieds-Item zustande,
        // wird der Anker-Wert nachgetragen, sobald er eintrifft.
        if (section.sortIndex === null && sortIndex !== null) section.sortIndex = sortIndex;
        return section;
      }
      const info = groupInfoById.get(groupKey);
      section = {
        key: groupKey,
        children: [],
        sortIndex,
        group: {
          id: info?.id ?? groupKey,
          name: info?.name ?? fallbackName,
          constraints: info?.constraints ?? [],
          modifiers: info?.modifiers ?? [],
          items: [],
        },
      };
      groupSectionByKey.set(groupKey, section);
      orderedSections.push(section);
      return section;
    };

    for (const { path, capability } of childSlotsOf(capabilities, framePath)) {
      if (capability.isHidden) continue;

      if (capability.anchorKind === 'groupAnchor') {
        const groupKey = groupInfoById.has(capability.defId)
          ? capability.defId
          : (capability.targetDefId && groupInfoById.has(capability.targetDefId)
            ? capability.targetDefId
            : capability.defId);
        const section = ensureGroupSection(groupKey, capability.name, capability.sortIndex);
        // Der Anker eines verlinkten Ziels und die Struktur-Gruppe sind derselbe
        // Abschnitt — beide Schlüssel zeigen auf ihn.
        if (capability.targetDefId) groupSectionByKey.set(capability.targetDefId, section);
        continue;
      }

      if (!OPTION_ANCHOR_KINDS.has(capability.anchorKind)) continue;
      if (seenDefIds.has(capability.defId)) continue;
      seenDefIds.add(capability.defId);

      const membership = membershipByOptionId.get(capability.defId)
        ?? (capability.targetDefId ? membershipByOptionId.get(capability.targetDefId) : undefined);

      if (membership?.groupKey) {
        const section = ensureGroupSection(membership.groupKey, membership.item.groupName);
        section.group.items.push({ option: membership.item.option, ownerSelectionId: null });
      } else {
        orderedSections.push({
          standalone: true,
          path,
          capability,
          sortIndex: capability.sortIndex,
          option: membership?.item.option ?? { id: capability.defId, name: capability.name },
        });
      }
    }

    /**
     * Der Abschnitt, in dem `section` hängt: die nächste umschließende Gruppe,
     * die selbst einen Abschnitt hat. Eine Gruppe ohne Grenze bekommt keinen
     * Anker und damit keinen Abschnitt — ihre Kinder rücken dann eine Ebene auf,
     * statt heimatlos zu werden.
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
      const parent = section.standalone ? null : parentSectionOf(section);
      if (parent) parent.children.push(section);
      else rootSections.push(section);
    }

    // Ein Abschnitt ohne Optionszeilen UND ohne verbliebene Mitgliedsgruppen hat
    // nichts zu zeigen und erscheint nicht (Issue 0131).
    //
    // Das setzt voraus, dass der Konfigurator die Struktur dieses Rahmens kennt:
    // die Mitgliedschaft Option→Gruppe kommt aus dem Sammler, nicht aus dem
    // Bericht. Liefert der Sammler zu diesem Rahmen gar nichts — etwa weil die
    // Definition im geparsten System nicht auflöst —, gehört keine Option
    // irgendeiner Gruppe an; dann sagt allein der Bericht, was auf der Karte
    // steht, und ein Gruppen-Anker behält seinen Abschnitt samt Grenze. Leer
    // aussehen heißt dort nur „nicht zugeordnet", nicht „inhaltslos".
    const knowsFrameStructure = structureItems.length > 0;
    const keepSection = (section) => {
      if (section.standalone) return true;
      section.children = section.children.filter(keepSection);
      if (!knowsFrameStructure) return true;
      return section.group.items.length > 0 || section.children.length > 0;
    };

    // Primaer aufsteigend nach sortIndex (Issue 0133, Kriterium 4), je Ebene
    // des Abschnittsbaums fuer sich: Sektionen ohne sortIndex bleiben
    // untereinander in der bisherigen Bericht-/Slot-Reihenfolge — ein stabiler
    // Sortierlauf ueber die schon in dieser Reihenfolge aufgebaute Liste
    // erhaelt sie fuer den ungetaggten Rest. Container-Verschachtelung
    // (Issue 0131, Nest-PR) haengt Sektionen als `.children` an — jede Ebene
    // sortiert unabhaengig von ihren Geschwistern.
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

    return sortSectionsRecursively(rootSections.filter(keepSection));
  };

  /**
   * Die Kind-Slots einer belegten Zeilen-Auswahl, eingerückt unter ihrer Zeile
   * gerendert (die Auswahl ist selbst ein Rahmen). `null`, solange die Zeile
   * nicht gewählt ist oder ihr Rahmen keine Abschnitte hat.
   */
  const renderOwnedChildren = (rowSelectionId) => {
    if (!rowSelectionId) return null;
    const childPath = pathBySelectionId?.get(rowSelectionId);
    if (childPath === undefined) return null;
    const childSelection = findSelectionById(selection, rowSelectionId);
    if (!childSelection) return null;
    const childSections = buildSections(childSelection, childPath);
    if (childSections.length === 0) return null;
    return (
      <div className="nested-option-block">
        {childSections.map(section => renderSection(section, childSelection, childPath))}
      </div>
    );
  };

  const renderStandaloneRow = (section, frameSelection) => {
    const { capability, option, path } = section;
    const count = (() => {
      const byOptionId = getSubSelectionCount(frameSelection, option.id);
      if (byOptionId > 0) return byOptionId;
      return capability.targetDefId ? getSubSelectionCount(frameSelection, capability.targetDefId) : byOptionId;
    })();

    const minLimit = capability.effectiveMin ?? 0;
    const maxLimit = capability.effectiveMax ?? Infinity;
    const points = capability.costs?.[costTypeId] ?? 0;
    const optionName = capability.name;
    const { isMandatory, isBinary } = classifyStandaloneOption({ minLimit, maxLimit });

    // Auflösung nur noch als Beiwerk (Detail-/Regeltexte, Untereinheiten-Form) —
    // Zustand, Grenzen und Namen kommen aus dem Bericht.
    const res = resolveEntry(system, option, activeCatalogue?.id);
    const isSubUnitWithOwnOptions = isIndependentSubUnit(res);
    const descText = getOptionDescription(res);

    const isSelectDisabled = capability.isBlocked === true;
    const editTargetId = frameSelection.id;
    // The roster selection this row stands for, so its own sub-options can nest
    // beneath it (null while unselected). Independent sub-units render their own
    // card elsewhere and never nest here.
    const rowSelectionId = isSubUnitWithOwnOptions ? null : resolveRowSelectionId(
      frameSelection, null, option, { id: capability.defId, targetId: capability.targetDefId }
    );

    // Nicht wählbar, weil noch nicht ausgewählt und aktuell gesperrt.
    const isUnavailable = count === 0 && isSelectDisabled;
    const isClickable = !isMandatory && !isUnavailable;
    const handleRowClick = (e) => {
      if (e.target.closest('button') || e.target.closest('input')) {
        return;
      }
      if (isClickable) {
        if (isSubUnitWithOwnOptions) {
          if (count < maxLimit && !isSelectDisabled) {
            subSelectionOperations.addInstance(editTargetId, option);
          }
        } else if (isBinary) {
          if (count > 0) {
            if (count > minLimit) {
              subSelectionOperations.decreaseCount(editTargetId, option);
            }
          } else if (!isSelectDisabled) {
            subSelectionOperations.increaseCount(editTargetId, option);
          }
        } else if (count < maxLimit && !isSelectDisabled) {
          subSelectionOperations.increaseCount(editTargetId, option);
        }
      }
    };

    return (
      <React.Fragment key={path}>
      <div
        className={`sub-selection-row ${isClickable ? 'clickable' : 'disabled'}${isUnavailable ? ' sub-selection-row--unavailable' : ''}`}
        onClick={handleRowClick}
      >
        <div className="sub-selection-label">
          <span className={`sub-selection-option-name${isUnavailable ? ' sub-selection-option-name--unavailable' : ''}`}>
            {optionName}
            <RuleChipIcon
              name={optionName}
              hasInfo={!!descText}
              onShowRule={onShowRule}
              onInfoClick={() => {
                if (res && window.innerWidth <= 900) {
                  setActiveInfo({ title: optionName, text: renderUpgradeDetails(res, system) });
                }
              }}
              onInfoEnter={(e) => { if (res) handleMouseEnter(optionName, renderUpgradeDetails(res, system), e); }}
              onInfoMove={handleMouseMove}
              onInfoLeave={handleMouseLeave}
            />
          </span>
        </div>
        <div className="sub-selection-controls">
          {points > 0 && <span className="text-gold text-label sub-selection-cost">+{points} {costTypeLabel}</span>}
          {isSubUnitWithOwnOptions ? (
            <button
              type="button"
              className="btn-primary text-label sub-selection-add-btn"
              onClick={(e) => {
                e.stopPropagation();
                subSelectionOperations.addInstance(editTargetId, option);
              }}
              disabled={isSelectDisabled || count >= maxLimit}
            >
              <Plus size={12} className="sub-selection-add-btn-icon" />
              {t('common.add')}
            </button>
          ) : isBinary ? (
            <input
              type="checkbox"
              checked={count > 0 || isMandatory}
              disabled={isMandatory || (count === 0 && isSelectDisabled) || (count > 0 && count <= minLimit)}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                if (!isMandatory && !(count > 0 && count <= minLimit)) {
                  if (e.target.checked) {
                    subSelectionOperations.increaseCount(editTargetId, option);
                  } else {
                    subSelectionOperations.decreaseCount(editTargetId, option);
                  }
                }
              }}
            />
          ) : (
            <div className="quantity-control">
              <button
                className="qty-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  subSelectionOperations.decreaseCount(editTargetId, option);
                }}
                disabled={count <= minLimit}
              >
                <Minus size={12} />
              </button>
              <span className="quantity-value font-body">{count}</span>
              <button
                className="qty-btn"
                onClick={(e) => {
                  e.stopPropagation();
                  subSelectionOperations.increaseCount(editTargetId, option);
                }}
                disabled={isSelectDisabled || count >= maxLimit}
              >
                <Plus size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
      {renderOwnedChildren(rowSelectionId)}
      </React.Fragment>
    );
  };

  /** True, sobald irgendwo in diesem Abschnitt oder darunter etwas gewählt ist. */
  const holdsSelection = (section, frameSelection) =>
    section.group.items.some(({ option }) => getSubSelectionCount(frameSelection, option.id) > 0)
    || section.children.some(child => holdsSelection(child, frameSelection));

  const renderSection = (section, frameSelection, framePath) => {
    if (section.standalone) {
      return renderStandaloneRow(section, frameSelection);
    }
    return (
      <OptionGroupComponent
        key={section.group.id || section.group.name}
        group={section.group}
        nestedSections={section.children.map(child => renderSection(child, frameSelection, framePath))}
        // Eine haltende Gruppe klappt auf, wenn eine ihrer Mitgliedsgruppen schon
        // etwas trägt — sonst verschwände eine getroffene Wahl hinter ihrer Kopfzeile.
        hasSelectedDescendant={section.children.some(child => holdsSelection(child, frameSelection))}
        selection={frameSelection}
        selectionPath={framePath}
        capabilities={capabilities}
        system={system}
        roster={roster}
        getSubSelectionCount={getSubSelectionCount}
        subSelectionOperations={subSelectionOperations}
        getOptionDescription={getOptionDescription}
        activeCatalogue={activeCatalogue}
        setActiveInfo={setActiveInfo}
        onHoverEnter={handleMouseEnter}
        onHoverMove={handleMouseMove}
        onHoverLeave={handleMouseLeave}
        onShowRule={onShowRule}
        renderRowChildren={renderOwnedChildren}
      />
    );
  };

  const selectionPath = pathBySelectionId?.get(selection.id);
  const topSections = selectionPath === undefined ? [] : buildSections(selection, selectionPath);

  return (
    <div className="selection-node-body">
      {/* Listenregeln sind Einstellungen, keine Ausrüstung: die Überschrift entfällt. */}
      {!isListRule && <h4>{t('editor.configurator.title')}</h4>}
      <div className="sub-selection-group sub-selection-group--flush">
        {topSections.map(section => renderSection(section, selection, selectionPath))}
      </div>
    </div>
  );
}
