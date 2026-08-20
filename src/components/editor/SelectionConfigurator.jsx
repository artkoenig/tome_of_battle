import React from 'react';
import { Plus, Minus } from 'lucide-react';
import {
  resolveEntry,
  getUnitOptions,
  resolveCostLimitTypeId, resolveCostLimitLabel,
  countSelections, classifyStandaloneOption,
  UPGRADE_DETAILS_KEYWORDS
} from '../../roster';
import { childSlotsOf } from '../../evaluation/slotLookups';
import { costBudgetTextsOf } from './costBudgets';
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
 * liefert aber weder Kandidaten noch Zustände. Der Sammler wird deshalb in seiner
 * **ungefilterten** Form befragt (ohne Sichtbarkeits-Kontext): welche *Option*
 * sichtbar ist, sagt allein der Bericht (`isHidden`, ADR-0035). Für eine
 * *Gruppe* gilt das noch nicht — das `isHidden` eines Gruppen-Ankers liest hier
 * niemand, ein Abschnitt entfällt allein, wenn er leer bleibt (Issue 0144).
 * Wertete der Sammler die
 * Sichtbarkeit hier ein zweites Mal aus, verlöre eine Option, über die die beiden
 * Quellen uneins sind, ihre Gruppenzugehörigkeit und fiele als heimatlose Zeile
 * aus der Katalogstruktur (Issue 0143). Eine belegte Unter-Auswahl ist
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
  const costTypeId = resolveCostLimitTypeId(roster, system);
  const costTypeLabel = resolveCostLimitLabel(roster, system);

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

  /**
   * Baut die Abschnitte eines Rahmens (Selection + ihr Slot-Pfad): Gruppen in
   * Slot-Reihenfolge, dazwischen die eigenständigen Options-Zeilen.
   *
   * Die Anker des Berichts liegen **flach** unter dem Rahmen (ADR-0036: ein
   * Angebots-Anker ist immer ein Blatt). Die Verschachtelung der Gruppen
   * ineinander ist — wie die Mitgliedschaft Option→Gruppe — Struktur des
   * geparsten Systems und kommt aus der Ahnenkette des Options-Sammlers
   * (`groupAncestors`). Eine Gruppe, deren Kinder ausschließlich Links auf
   * andere Gruppen sind („Container-Gruppe"), hält ihre Mitglieder damit im
   * eigenen Abschnitt, statt sie als Geschwister neben sich zu stellen
   * (Issue 0131) — und trägt dabei den Namen, den die Ahnenkette ihr gibt
   * (Issue 0143).
   */
  const buildSections = (frameSelection, framePath) => {
    // Ohne Sichtbarkeits-Kontext: der Sammler liefert hier allein die
    // Katalogstruktur, das Verstecken liest der Konfigurator am Bericht ab
    // (siehe Kopfkommentar, ADR-0035).
    const structureItems = getUnitOptions(system, activeCatalogue?.id, frameSelection);

    // Kapazitaeten je Definitions-Id nachschlagbar — die Katalogstruktur
    // (`structureItems`, oben) legt Mitgliedschaft UND Reihenfolge fest, der
    // Bericht liefert nur noch je Slot seine Daten (Pfad, Zustand, sortIndex).
    //
    // Vormals lief die Einordnung ueber `childSlotsOf` (Baumreihenfolge des
    // Berichts): die haengt aber bereits ausgewaehlte Instanzen (Baumphase 1,
    // Roster-Einfuegereihenfolge) VOR alle Gruppen-Anker und Angebots-Anker
    // (Baumphase 2, Katalogreihenfolge) — zwei verschiedene Ordnungsraeume
    // hintereinander. Eine noch leere Gruppe stand deshalb an ihrer
    // Katalogposition; sobald man eine Option darin waehlte, sprang die ganze
    // Gruppe an die Position der gerade ausgewaehlten Instanz. `structureItems`
    // kommt dagegen rein aus der Katalogstruktur (`getUnitOptions`) und aendert
    // sich nie mit der aktuellen Auswahl.
    const optionCapabilityByDefId = new Map();
    const groupAnchorByGroupKey = new Map();
    for (const { path, capability } of childSlotsOf(capabilities, framePath)) {
      if (capability.anchorKind === 'groupAnchor') {
        const anchorInfo = { sortIndex: capability.sortIndex, name: capability.name };
        // Der Anker eines verlinkten Ziels traegt zwei Ids (Link und aufgeloestes
        // Ziel) — die Struktur-Gruppe kann unter beiden angesprochen werden.
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

    // Der Name, den der Katalog jeder in dieser Struktur vorkommenden Gruppe gibt —
    // vorab gesammelt, weil ein reiner Container seinen Namen NUR ueber die
    // Ahnenkette eines Nachfahren erreicht: er haelt keine Option (also kein
    // `groupInfoById`) und traegt keine eigene Grenze (also keinen Anker im
    // Bericht). Ohne diesen Vorlauf entstuende sein Abschnitt titellos
    // (Issue 0143, Defekt A).
    const catalogueGroupNameById = new Map();
    const rememberGroupName = (groupId, groupName) => {
      if (groupId == null || !groupName || catalogueGroupNameById.has(groupId)) return;
      catalogueGroupNameById.set(groupId, groupName);
    };
    for (const item of structureItems) {
      if (item.ownerSelectionId) continue;
      (item.groupAncestors || []).forEach(({ id, name }) => rememberGroupName(id, name));
      rememberGroupName(item.groupId, item.groupName);
    }

    const ensureGroupSection = (groupKey, fallbackName) => {
      let section = groupSectionByKey.get(groupKey);
      if (section) return section;
      const info = groupInfoById.get(groupKey);
      const anchor = groupAnchorByGroupKey.get(groupKey);
      section = {
        key: groupKey,
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
      // Die Ahnenkette nennt jede umschließende Gruppe — auch die, die selbst
      // keine Option beisteuert (der Container-Fall). Ihr Abschnitt entsteht
      // hier, beim ersten Nachfahren in Katalogreihenfolge — sonst kaeme ein
      // reiner Container (Issue 0131) nie an die Reihe, weil kein Item ihn je
      // als eigene (direkte) Gruppe traegt.
      const ancestorKeys = (item.groupAncestors || []).map(ancestor => ancestor.id);
      ancestorKeys.forEach((key, index) => rememberParentKey(key, index === 0 ? null : ancestorKeys[index - 1]));
      ancestorKeys.forEach(key => ensureGroupSection(key, null));
      const enclosingKey = ancestorKeys.length > 0 ? ancestorKeys[ancestorKeys.length - 1] : null;

      const isRoleGroup = ROLE_GROUP_NAMES.has((item.groupName || '').toLowerCase());
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
        orderedSections.push({
          standalone: true,
          path,
          capability,
          sortIndex: capability.sortIndex,
          option: item.option,
        });
      }
    }

    // Kennt der Sammler die Struktur dieses Rahmens gar nicht (siehe
    // `knowsFrameStructure` unten — etwa weil die Definition im geparsten
    // System nicht aufloest), bleibt ein Gruppen-Anker aus der obigen Schleife
    // aussen vor: er haengt an keinem Item. Er behaelt seinen Abschnitt trotzdem,
    // allein aus dem Bericht — in dessen Ankerreihenfolge, da hier keine
    // Katalogstruktur zur Einordnung zur Verfuegung steht.
    for (const groupKey of groupAnchorByGroupKey.keys()) {
      if (!groupSectionByKey.has(groupKey)) ensureGroupSection(groupKey, null);
    }

    // Sicherheitsnetz: eine Kapazitaet des Berichts ohne Gegenstueck in der
    // Katalogstruktur (praktisch nicht erwartet, s. o. — `getUnitOptions` deckt
    // dieselbe Struktur unbedingt ab) erscheint wenigstens, hinter allen
    // strukturell einsortierten Abschnitten, in Berichtsreihenfolge.
    for (const { path, capability } of childSlotsOf(capabilities, framePath)) {
      if (capability.isHidden) continue;
      if (!OPTION_ANCHOR_KINDS.has(capability.anchorKind)) continue;
      if (seenDefIds.has(capability.defId)) continue;
      seenDefIds.add(capability.defId);
      orderedSections.push({
        standalone: true,
        path,
        capability,
        sortIndex: capability.sortIndex,
        option: { id: capability.defId, name: capability.name },
      });
    }

    /**
     * Der Abschnitt, in dem `section` hängt: die nächste umschließende Gruppe,
     * die selbst einen Abschnitt hat. Jede Gruppe der Ahnenkette bekommt einen
     * Abschnitt — auch eine ohne eigene Grenze, die im Bericht keinen Anker hat
     * (sie trägt dann ihren Katalognamen, Issue 0143). Die Schleife überspringt
     * gleichwohl jeden Schlüssel ohne Abschnitt, damit ein Kind einer weggefallenen
     * Ebene eine Ebene aufrückt, statt heimatlos zu werden.
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
    const costBudgets = costBudgetTextsOf(capability, system);
    const { isMandatory, isMandatoryMet, isBinary } = classifyStandaloneOption({
      minLimit, maxLimit, isMandatoryUnmet: capability.isMandatoryUnmet === true
    });

    // Auflösung nur noch als Beiwerk (Detail-/Regeltexte, Untereinheiten-Form) —
    // Zustand, Grenzen und Namen kommen aus dem Bericht.
    const res = resolveEntry(system, option, activeCatalogue?.id);
    // Ob die Zeile eine eigenständige Untereinheit trägt, sagt der Bericht
    // (`capability.isIndependentSubUnit`, Issue 0156) — dieselbe Antwort, die
    // Karte, Chips und Spielansicht lesen, statt einer zweiten Katalog-Auswertung.
    const isSubUnitWithOwnOptions = capability.isIndependentSubUnit === true;
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
    // Nur eine EINGELÖSTE Pflicht ist genommen und gesperrt; eine offene Pflicht
    // (`isMandatoryUnmet`) ist ein gewöhnliches Angebot (Issue 0145).
    const isObligationHeld = isMandatory && isMandatoryMet;
    const isClickable = !isObligationHeld && !isUnavailable;
    // Eine Regel auf allen drei Render-Pfaden: Was das effektive Minimum verlangt,
    // kann nicht zurückgegeben werden — und eine bereits eingelöste Pflicht ist
    // genau dieser Fall (Issue 0145).
    const canRemove = count > minLimit && !isObligationHeld;
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
            if (canRemove) {
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
          {/* Das Kosten-Budget der Zeile: eine Option, die selbst ein Punktekontingent
              deckelt (der Magiegegenstands-Block), fuehrt es neben ihrem Schalter —
              ihre Unter-Auswahlen rendern eingerueckt darunter und zahlen darauf ein. */}
          {costBudgets.map(budget => (
            <span key={budget} className="text-micro sub-selection-cost-budget">({budget})</span>
          ))}
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
              checked={count > 0 || isObligationHeld}
              disabled={isObligationHeld || (count > 0 ? !canRemove : isSelectDisabled)}
              onClick={(e) => e.stopPropagation()}
              onChange={(e) => {
                if (e.target.checked) {
                  if (!isSelectDisabled) {
                    subSelectionOperations.increaseCount(editTargetId, option);
                  }
                } else if (canRemove) {
                  subSelectionOperations.decreaseCount(editTargetId, option);
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
                disabled={!canRemove}
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
