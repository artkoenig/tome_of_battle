import { useMemo } from 'react';
import {
  resolveEntry,
  getUnitOptions,
  resolveCostLimitTypeId, resolveCostLimitLabel, resolveCostTypeLabel,
  countSelections, classifyStandaloneOption,
  UPGRADE_DETAILS_KEYWORDS,
} from '../../roster';
import { childSlotsOf } from '../../evaluation/slotLookups';
import { useRosterCommands, useRosterReport } from '../rosterContexts';

/**
 * Die kostenbezogenen **Höchst**grenzen eines Slots, die als Budget angezeigt
 * werden. Ein Mindestmaß ist keine Budgetanzeige, und die eingestellte
 * Roster-Kostengrenze steht in der Kopfzeile der Armee, nicht an einer Option.
 * Die Werte des Berichts (`kind`/`measure`) sind engine-eigene
 * Zeichenketten-Werte der Aufzählungen `ConstraintKind`/`LimitMeasure` — wie im
 * übrigen App-Rand (`src/i18n/violationMessages.js`) als Literale gelesen.
 */
const costBudgetsOf = (capability) => (capability?.costLimits ?? [])
  .filter(limit => limit.kind === 'max' && limit.measure === 'costSum');

/**
 * Die **Kosten-Budgets eines Slots** als Anzeigetexte — „12 / 50 pts" je
 * kostenbezogener Höchstgrenze, die der Bericht am Slot führt (`costLimits`).
 *
 * Ein reiner Lookup auf den Bericht (ADR-0034, Leitprinzip 3): gemessen und
 * gedeckelt hat die Engine, hier wird nur noch abgelesen und benannt. Der
 * Konfigurator summierte die verplanten Punkte einer Gruppe vormals selbst über
 * ihre Zeilen — das sah zwar meist gleich aus, kannte aber weder den
 * Bezugsrahmen der Grenze noch verschachtelte Auswahlen.
 *
 * @param {Object|null|undefined} capability
 * @param {Object|null|undefined} system  das aufgelöste Spielsystem (benennt die Kostenart).
 * @returns {string[]} je Grenze ein Text; leer, wenn der Slot keine trägt.
 */
export function costBudgetTextsOf(capability, system) {
  return costBudgetsOf(capability).map(limit => {
    const label = resolveCostTypeLabel(system, limit.costTypeId);
    return `${limit.current} / ${limit.bound}${label ? ` ${label}` : ''}`;
  });
}

/**
 * Ob eines der Kosten-Budgets eines Slots **gerissen** ist. Die Engine sagt es
 * je Grenze (`satisfied`); die Oberfläche vergleicht dafür nichts selbst nach.
 *
 * Das ist nicht dasselbe wie `isBlocked` („kein Spielraum mehr"): ein Budget
 * genau am Anschlag sperrt weitere Auswahlen, ist aber kein Fehler.
 *
 * @param {Object|null|undefined} capability
 * @returns {boolean}
 */
export function hasExceededCostBudget(capability) {
  return costBudgetsOf(capability).some(limit => !limit.satisfied);
}

/**
 * ViewModel des Auswahl-Konfigurators (ADR-0038; ADR-0035/0036).
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
 * (Options-Sammler des Schreibmodells `src/roster/`); sie ordnet die Slots den
 * Gruppen zu, liefert aber weder Kandidaten noch Zustände. Der Sammler wird
 * deshalb in seiner **ungefilterten** Form befragt (ohne Sichtbarkeits-Kontext):
 * welche *Option* sichtbar ist, sagt allein der Bericht (`isHidden`,
 * ADR-0035). Eine belegte Unter-Auswahl ist selbst ein Rahmen: ihre Kind-Slots
 * rendern eingerückt unter ihrer Zeile.
 *
 * In dieses ViewModel ist `editor/optionNesting.js` aufgegangen — die Zuordnung
 * Zeile → Roster-Selektion ist eine Ableitung des Konfigurators.
 */

/** Die Ankerarten, deren Slots als Options-Zeilen erscheinen. */
const OPTION_ANCHOR_KINDS = new Set(['occupied', 'offerAnchor', 'mandatoryPhantom']);

/** Gruppennamen, deren Mitglieder als eigenständige Zeilen erscheinen (Alt-Verhalten). */
const ROLE_GROUP_NAMES = new Set(['rolle', 'rollen', 'role', 'roles']);

/**
 * Tiefensuche nach einer Roster-Selektion innerhalb eines Teilbaums.
 * @param {Object|null} rootSelection Teilbaum, in dem gesucht wird
 * @param {string|null} targetId gesuchte Selektions-Id
 * @returns {Object|null}
 */
const findSelectionById = (rootSelection, targetId) => {
  if (!rootSelection || !targetId) return null;
  if (rootSelection.id === targetId) return rootSelection;
  for (const child of rootSelection.selections || []) {
    const found = findSelectionById(child, targetId);
    if (found) return found;
  }
  return null;
};

/**
 * Die Roster-Selektion, für die eine Options-Zeile gerade steht — `null`,
 * solange die Option nicht gewählt ist. Nachgereichte Unteroptionen tragen genau
 * diese Id als `ownerSelectionId`; daraus entsteht die Einrückung.
 *
 * Rein darstellend: sie ändert nie, was gewählt, gezählt, bepreist oder
 * geschrieben wird.
 * @param {Object} rootSelection die Selektion, die der Konfigurator bearbeitet
 * @param {string|null} ownerSelectionId Träger der Gruppe der Zeile (`null` = die Einheit selbst)
 * @param {Object} option die gesammelte Options-Definition der Zeile
 * @param {Object|null} resolvedOption `{ id, targetId }` des Slots der Zeile
 * @returns {string|null}
 */
export const resolveRowSelectionId = (rootSelection, ownerSelectionId, option, resolvedOption) => {
  const owner = ownerSelectionId ? findSelectionById(rootSelection, ownerSelectionId) : rootSelection;
  if (!owner) return null;
  const optionKey = option?.id;
  const targetKey = resolvedOption?.targetId || resolvedOption?.id;
  const match = (owner.selections || []).find(sel => {
    const key = sel.entryLinkId || sel.selectionEntryId;
    return key === optionKey || key === targetKey || key === resolvedOption?.id;
  });
  return match?.id ?? null;
};

/**
 * Wie oft eine Options-Definition im Teilbaum einer Selektion gewählt ist.
 * @param {Object} unitSelection
 * @param {string} optionEntryId
 * @returns {number}
 */
export const subSelectionCountOf = (unitSelection, optionEntryId) => {
  const matchesOption = (sel) => (sel.entryLinkId || sel.selectionEntryId) === optionEntryId;
  return countSelections(unitSelection.selections, {
    includeChildSelections: true,
    predicate: matchesOption,
  });
};

/** Die Buchquelle eines Info-Eintrags als Anhang eines Beschreibungstextes. */
const sourceSuffixOf = (source) => {
  if (!source) return '';
  const parts = [source.publicationName, source.page != null ? `${source.page}` : null].filter(Boolean);
  return parts.length > 0 ? ` ${parts.join(' ')}` : '';
};

/**
 * Der Beschreibungstext einer Options-Zeile — **allein aus der Info-Projektion
 * ihres Slots** (`capability.infoElements`, ADR-0034).
 *
 * Der frühere namensbasierte Regel-Lookup (der Name der Option gegen die
 * `sharedRules` des Systems und aller Kataloge) ist ersatzlos entfallen: er
 * verwechselte zwei gleichnamige Regeln aus verschiedenen Katalogen, weil er den
 * ersten Treffer nahm. Der Bericht verankert die Regel dagegen am Slot und weiß
 * damit, welche gemeint ist.
 * @param {Object|null|undefined} capability
 * @returns {string}
 */
export const optionDescriptionOf = (capability) => {
  const descriptions = [];
  for (const element of capability?.infoElements ?? []) {
    if (element.kind === 'rule') {
      if (element.text) descriptions.push(`${element.text}${sourceSuffixOf(element.source)}`);
      continue;
    }
    if (element.kind !== 'profile') continue;
    const typeLower = element.profileTypeName?.toLowerCase() || '';
    if (!UPGRADE_DETAILS_KEYWORDS.some(k => typeLower.includes(k))) continue;
    const stats = (element.characteristics ?? [])
      .filter(c => c.value)
      .map(c => `${c.name}: ${c.value}`)
      .join(', ');
    descriptions.push(`${element.name} (${stats})${sourceSuffixOf(element.source)}`);
  }
  return descriptions.join(' | ');
};

/**
 * @param {{ selection: import('../../types.js').Selection }} args
 * @returns {{ sections: object[], sectionsForRow: (rowSelectionId: string|null) => object[],
 *   system: Object|null, costTypeLabel: string }}
 */
export function useSelectionConfigurator({ selection }) {
  const { report, roster, system, activeCatalogue } = useRosterReport();
  const { subSelectionOperations } = useRosterCommands();
  const { capabilities, pathBySelectionId } = report;
  const activeCatalogueId = activeCatalogue?.id ?? null;

  return useMemo(() => {
    const costTypeId = resolveCostLimitTypeId(roster, system);
    const costTypeLabel = resolveCostLimitLabel(roster, system);

    /**
     * Baut die Abschnitte eines Rahmens (Selection + ihr Slot-Pfad): Gruppen in
     * Slot-Reihenfolge, dazwischen die eigenständigen Options-Zeilen.
     *
     * Die Anker des Berichts liegen **flach** unter dem Rahmen (ADR-0036: ein
     * Angebots-Anker ist immer ein Blatt). Die Verschachtelung der Gruppen
     * ineinander ist — wie die Mitgliedschaft Option→Gruppe — Struktur des
     * geparsten Systems und kommt aus der Ahnenkette des Options-Sammlers
     * (`groupAncestors`).
     */
    const buildSections = (frameSelection, framePath) => {
      const structureItems = getUnitOptions(system, activeCatalogueId, frameSelection);

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
      // Ahnenkette eines Nachfahren erreicht (Issue 0143, Defekt A).
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
          orderedSections.push(buildStandaloneSection({
            frameSelection, path, capability, option: item.option,
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
      for (const { path, capability } of childSlotsOf(capabilities, framePath)) {
        if (capability.isHidden) continue;
        if (!OPTION_ANCHOR_KINDS.has(capability.anchorKind)) continue;
        if (seenDefIds.has(capability.defId)) continue;
        seenDefIds.add(capability.defId);
        orderedSections.push(buildStandaloneSection({
          frameSelection, path, capability,
          option: { id: capability.defId, name: capability.name },
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

      // Primaer aufsteigend nach sortIndex (Issue 0133), je Ebene des
      // Abschnittsbaums fuer sich; ein stabiler Sortierlauf erhaelt die
      // Bericht-/Katalogreihenfolge fuer den ungetaggten Rest.
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

      const kept = sortSectionsRecursively(rootSections.filter(keepSection));
      const markHolds = (section) => {
        if (section.kind === 'standalone') return;
        section.children.forEach(markHolds);
        section.hasSelectedDescendant = section.children.some(holdsSelection);
      };
      kept.forEach(markHolds);
      return kept;
    };

    /** True, sobald irgendwo in diesem Abschnitt oder darunter etwas gewählt ist. */
    const holdsSelection = (section) => {
      if (section.kind === 'standalone') return section.count > 0;
      return section.group.items.some(({ option }) => subSelectionCountOf(section.frameSelection, option.id) > 0)
        || section.children.some(holdsSelection);
    };

    /** Das Zeilenmodell einer gruppenlosen Options-Zeile. */
    function buildStandaloneSection({ frameSelection, path, capability, option }) {
      const count = (() => {
        const byOptionId = subSelectionCountOf(frameSelection, option.id);
        if (byOptionId > 0) return byOptionId;
        return capability.targetDefId ? subSelectionCountOf(frameSelection, capability.targetDefId) : byOptionId;
      })();

      const minLimit = capability.effectiveMin ?? 0;
      const maxLimit = capability.effectiveMax ?? Infinity;
      const { isMandatory, isMandatoryMet, isBinary } = classifyStandaloneOption({
        minLimit, maxLimit, isMandatoryUnmet: capability.isMandatoryUnmet === true,
      });

      // Auflösung nur noch als Beiwerk (Detail-/Regeltexte) — Zustand, Grenzen,
      // Namen und Beschreibung kommen aus dem Bericht.
      const resolved = resolveEntry(system, option, activeCatalogueId);
      // Ob die Zeile eine eigenständige Untereinheit trägt, sagt der Bericht.
      const isSubUnitWithOwnOptions = capability.isIndependentSubUnit === true;
      const isSelectDisabled = capability.isBlocked === true;
      const editTargetId = frameSelection.id;
      const rowSelectionId = isSubUnitWithOwnOptions ? null : resolveRowSelectionId(
        frameSelection, null, option, { id: capability.defId, targetId: capability.targetDefId }
      );

      const isUnavailable = count === 0 && isSelectDisabled;
      // Nur eine EINGELÖSTE Pflicht ist genommen und gesperrt (Issue 0145).
      const isObligationHeld = isMandatory && isMandatoryMet;
      const isClickable = !isObligationHeld && !isUnavailable;
      // Was das effektive Minimum verlangt, kann nicht zurückgegeben werden.
      const canRemove = count > minLimit && !isObligationHeld;

      const increase = () => subSelectionOperations.increaseCount(editTargetId, option);
      const decrease = () => subSelectionOperations.decreaseCount(editTargetId, option);
      const add = () => subSelectionOperations.addInstance(editTargetId, option);

      return {
        kind: 'standalone',
        key: path,
        frameSelection,
        framePath: path,
        option,
        capability,
        sortIndex: capability.sortIndex,
        name: capability.name,
        count,
        points: capability.costs?.[costTypeId] ?? 0,
        costTypeLabel,
        costBudgets: costBudgetTextsOf(capability, system),
        descText: optionDescriptionOf(capability),
        resolved,
        isSubUnitWithOwnOptions,
        isBinary,
        isObligationHeld,
        isClickable,
        isUnavailable,
        isSelectDisabled,
        canRemove,
        isAddDisabled: isSelectDisabled || count >= maxLimit,
        rowSelectionId,
        onRowClick: () => {
          if (!isClickable) return;
          if (isSubUnitWithOwnOptions) {
            if (count < maxLimit && !isSelectDisabled) add();
          } else if (isBinary) {
            if (count > 0) {
              if (canRemove) decrease();
            } else if (!isSelectDisabled) increase();
          } else if (count < maxLimit && !isSelectDisabled) {
            increase();
          }
        },
        onToggle: (checked) => {
          if (checked) {
            if (!isSelectDisabled) increase();
          } else if (canRemove) {
            decrease();
          }
        },
        onIncrease: increase,
        onDecrease: decrease,
        onAdd: add,
      };
    }

    const selectionPath = pathBySelectionId?.get(selection.id);
    const sections = selectionPath === undefined ? [] : buildSections(selection, selectionPath);

    /**
     * Die Abschnitte einer belegten Zeilen-Auswahl (die Auswahl ist selbst ein
     * Rahmen). Leer, solange die Zeile nicht gewählt ist oder ihr Rahmen keine
     * Abschnitte hat.
     */
    const sectionsForRow = (rowSelectionId) => {
      if (!rowSelectionId) return [];
      const childPath = pathBySelectionId?.get(rowSelectionId);
      if (childPath === undefined) return [];
      const childSelection = findSelectionById(selection, rowSelectionId);
      if (!childSelection) return [];
      return buildSections(childSelection, childPath);
    };

    return { sections, sectionsForRow, system, costTypeLabel };
  }, [
    selection, roster, system, activeCatalogueId,
    capabilities, pathBySelectionId, subSelectionOperations,
  ]);
}
