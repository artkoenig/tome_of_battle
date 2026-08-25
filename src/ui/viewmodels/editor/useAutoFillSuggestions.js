import { useMemo } from 'react';

import { foreignCatalogueIdsOf, resolveCostLimitLabel } from '../../../contexts/armylist/model';
import { capabilityEntryOf } from '../capabilityEntries';
import { EMPTY_SLOT_INDEX } from '../../../contexts/ruleengine/readmodel/index.js';
import { useRosterReport, useRosterCommands } from '../rosterContexts';

/**
 * Die **Auffüll-Vorschläge** eines Kontingents (Issue 0135/0151; ADR-0034/0035),
 * seit Issue 0164 als ViewModel.
 *
 * Beantwortet genau eine Frage: **was passt noch in die Restpunkte?** Das Panel
 * ist damit ein Werkzeug für den Schluss der Listenbauerei — es öffnet erst auf
 * den letzten {@link FILL_UP_WINDOW_POINTS} Punkten: die Liste hat eine
 * Punktgrenze, und es fehlt noch etwas zu ihr, aber höchstens diese Spanne. Bei
 * einer größeren Lücke schweigt es. Innerhalb der Spanne ist es **immer**
 * sichtbar, auch wenn gerade nichts hineinpasst — verschwände es still, wäre
 * „nichts passt mehr" von „alle Punkte verplant" nicht zu unterscheiden.
 *
 * Vorgeschlagen wird allein, was der Bericht als **wählbar** führt: ein
 * Angebots-Anker (`offerAnchor`) oder ein belegter Slot mit verbleibendem
 * Spielraum. Beide Ankerarten tragen ausschließlich `selectionEntry`/`entryLink`
 * — nie eine Kategorie: eine offene Pflicht erzeugt hier keinen Vorschlag, sie
 * steht im Meldungs-Panel. Dazu der **Herkunftsfilter** des Aushebe-Dialogs
 * ({@link foreignCatalogueIdsOf}): eine Einheit aus einem fremden Armeebuch
 * darf in dieser Liste gar nicht aufgestellt werden (ADR-0032). Und der
 * **Kontingentschnitt**: vorgeschlagen wird nur, was im Teilbaum des eigenen
 * Kontingents liegt — ein Slot an einer Auswahl eines anderen Kontingents
 * derselben Liste gehört in dessen Panel (Issue 0172).
 *
 * Ein Vorschlag muss in der Limit-Kostenart etwas kosten und darf die Restsumme
 * nicht überschreiten; Verstecktes (`isHidden`) und Ausgeschöpftes (`isBlocked`)
 * fällt heraus. Der Preis ist der **Aushebe**-Preis (`raiseCosts`), nicht der
 * Eigenpreis (Issue 0085). Sortiert wird nach Kosten absteigend.
 *
 * @param {{ forceId: string|null, forcePath: string|null }} params
 * @returns {{ isOpen: boolean, remainingPoints: number|null, costTypeLabel: string,
 *   suggestions: Array<{ key: string, name: string, cost: number,
 *     unitName: string|null, apply: (() => void)|null }> }}
 */

/**
 * Die letzten Punkte einer Liste: nur bis zu dieser Lücke zum eingestellten
 * Punktwert wird aufgefüllt (Issue 0151).
 */
export const FILL_UP_WINDOW_POINTS = 50;

export function useAutoFillSuggestions({ forceId = null, forcePath = null }) {
  const { report, roster, system, activeCatalogue } = useRosterReport();
  const { addUnit, subSelectionOperations } = useRosterCommands();
  const slots = report?.slots ?? EMPTY_SLOT_INDEX;
  const costTotals = report?.costTotals ?? {};

  const force = useMemo(
    () => roster?.forces?.find(candidate => candidate.id === forceId) ?? null,
    [roster, forceId]
  );

  // Was der Liste zu ihrem eingestellten Punktwert fehlt (Issue 0135). Ohne
  // Limit-Kostenart oder ohne gesetzten Punktwert gibt es keine Differenz zu
  // füllen: `null`, nicht 0. Die Lücke ist roster-weit, wie die Punktgrenze
  // selbst; jedes Kontingent zeigt sie deshalb gleich.
  const costLimitTypeId = roster?.costLimitType ?? null;
  const limitPoints = roster?.costLimit || 0;
  const remainingPoints = costLimitTypeId && limitPoints > 0
    ? limitPoints - (costTotals[costLimitTypeId] || 0)
    : null;

  // Rahmen-Auflösung: Slot-Pfad → App-Selection-UUID (Umkehrung des Adapters).
  const selectionIdByPath = useMemo(() => {
    const inverse = new Map();
    for (const [selectionId, path] of slots.pathBySelectionId) inverse.set(path, selectionId);
    return inverse;
  }, [slots]);

  // Das eigene Armeebuch ist das des Kontingents; ohne eigenes gilt der aktive
  // Katalog der Liste — dieselbe Rückfallregel wie im Aushebe-Dialog.
  const ownCatalogueId = force?.catalogueId || roster?.catalogueId || activeCatalogue?.id || null;
  const foreignCatalogueIds = useMemo(
    () => foreignCatalogueIdsOf(system, ownCatalogueId), [system, ownCatalogueId]);

  const collected = useMemo(() => {
    const found = [];
    if (costLimitTypeId === null || remainingPoints === null) return found;
    if (remainingPoints <= 0 || remainingPoints > FILL_UP_WINDOW_POINTS) return found;

    for (const [path, capability] of slots.capabilities) {
      if (!isSelectableSlot(capability)) continue;
      if (capability.isHidden || capability.isBlocked) continue;
      // Ein Panel füllt allein sein eigenes Kontingent auf: nur Slots aus dessen
      // Teilbaum kommen in Frage (Issue 0172). Ein Slot an einer Auswahl in
      // einem anderen Kontingent derselben Liste gehört in dessen Panel.
      if (!isInForceSubtree(path, forcePath)) continue;
      // Nur zwei Standorte sind gemeint: unmittelbar unter dem Kontingent (eine
      // Einheit) oder unter einer bestehenden Auswahl (eine Option an ihr).
      const framePath = capability.frame?.path ?? null;
      if (framePath === null) continue;
      if (framePath !== forcePath && !selectionIdByPath.has(framePath)) continue;
      if (foreignCatalogueIds.has(capability.sourceId)) continue;
      const cost = capability.raiseCosts?.[costLimitTypeId] ?? 0;
      if (cost <= 0 || cost > remainingPoints) continue;
      found.push({ path, capability, cost });
    }
    found.sort((a, b) => b.cost - a.cost);
    return found;
  }, [slots, costLimitTypeId, remainingPoints, forcePath, selectionIdByPath, foreignCatalogueIds]);

  const suggestions = useMemo(() => {
    // Der Katalogeintrag hinter einem Slot — für die bestehende Aushebe-Mechanik.
    const entryFor = (capability) => capabilityEntryOf(system, capability, activeCatalogue?.id);

    /**
     * Die Anwenden-Aktion eines Vorschlags über die bestehende Mechanik — oder
     * `null`, wenn der nötige Kontext fehlt: ein Slot in einer Auswahl wächst
     * über `increaseCount` am Rahmen, ein Slot unter einem Kontingent wird über
     * `addUnit` ausgehoben (unter seiner effektiven Primärkategorie).
     */
    const applyActionFor = (capability) => {
      const framePath = capability.frame?.path ?? null;
      if (framePath !== null && selectionIdByPath.has(framePath)) {
        const frameSelectionId = selectionIdByPath.get(framePath);
        if (!subSelectionOperations) return null;
        return () => subSelectionOperations.increaseCount(frameSelectionId, entryFor(capability));
      }
      if (addUnit && framePath !== null) {
        return () => addUnit(entryFor(capability), capability.primaryCategoryId ?? null, forceId);
      }
      return null;
    };

    /** Der Name der Einheit, an der eine Option hängt — `null` unter dem Kontingent. */
    const unitNameFor = (capability) => {
      const framePath = capability.frame?.path ?? null;
      if (framePath === null || framePath === forcePath) return null;
      return slots.slotAt(framePath)?.name ?? null;
    };

    return collected.map(({ path, capability, cost }) => ({
      key: path,
      name: capability.name,
      cost,
      unitName: unitNameFor(capability),
      apply: applyActionFor(capability),
    }));
  }, [collected, system, activeCatalogue, selectionIdByPath, subSelectionOperations, addUnit, forcePath, slots, forceId]);

  // Sichtbar an der Lücke: steht die Liste auf ihren letzten Punkten, steht das
  // Panel da — auch wenn gerade nichts hineinpasst. Ohne `forcePath` führt der
  // Bericht für dieses Kontingent überhaupt keine Slots; dann schweigt es.
  const isOpen = forcePath !== null
    && forcePath !== undefined
    && costLimitTypeId !== null
    && remainingPoints !== null
    && remainingPoints > 0
    && remainingPoints <= FILL_UP_WINDOW_POINTS;

  return {
    isOpen,
    remainingPoints,
    costTypeLabel: resolveCostLimitLabel(roster, system),
    suggestions,
  };
}

/**
 * True, wenn der Slot-Pfad im Teilbaum des Kontingents liegt: das Kontingent
 * selbst oder alles unter ihm. Ohne `forcePath` gibt es keinen Teilbaum.
 */
function isInForceSubtree(path, forcePath) {
  if (forcePath === null || forcePath === undefined) return false;
  return path === forcePath || path.startsWith(`${forcePath}/`);
}

/**
 * True für einen Slot, an dem noch etwas gewählt werden kann: ein
 * Angebots-Anker (im Rahmen wählbar, noch nicht vorhanden) oder eine belegte
 * Auswahl mit verbleibendem Spielraum (`headroom === null` heißt: kein
 * Höchstmaß). Jede andere Ankerart — Pflicht-Phantom, Gruppen- und
 * Kategorie-Anker — benennt keinen Eintrag, den dieses Panel aushebt.
 */
function isSelectableSlot(capability) {
  if (capability.anchorKind === 'offerAnchor') return true;
  return capability.anchorKind === 'occupied'
    && (capability.headroom === null || capability.headroom > 0);
}
