import { useMemo } from 'react';

import { resolveCostLimitTypeId, resolveCostLimitLabel } from '../../roster';
import { capabilityEntryOf } from '../capabilityEntries';
import { EMPTY_SLOT_INDEX } from '../../evaluation/slotIndex';
import { useRosterReport, useRosterCommands } from '../rosterContexts';

/**
 * Das **Aushebe-Angebot** einer Kategorie (Issue 0164): die fertige
 * Kandidatenliste, die `CategoryUnitAdder` nur noch auf Markup abbildet.
 *
 * Bis hierher baute die Komponente sie in einer Map-Schleife im Render auf —
 * filtern, entdoppeln, sortieren und den Katalog-Eintrag auflösen, alles
 * zwischen zwei JSX-Knoten und damit nur über das DOM prüfbar. Die Lesart ist
 * unverändert (ADR-0035/0036, Issue 0121 Task 6): Kandidat ist ein Slot direkt
 * unter dem Ziel-Kontingent (`forcePath`) mit einer der drei Ankerarten,
 * `isHidden` fällt heraus, je Definition bleibt genau einer stehen, und die
 * Kategorie-Zuordnung liest die **effektive** Primärkategorie des Berichts.
 * Gesperrt (`isBlocked`) bleibt sichtbar, aber unklickbar.
 *
 * Die **Herkunfts-Entscheidung** trifft ebenfalls der Bericht
 * (`capability.isForeignCatalogue`, Issue 0156): eine Einheit aus einem fremden
 * Armeebuch erscheint gar nicht. Ist eine explizite `entries`-Liste vorgegeben,
 * gilt die Herkunft nicht — eine solche Liste ist bereits kuratiert.
 *
 * Der Preis ist der **Aushebe**-Preis (`raiseCosts`), nicht der Eigenpreis: ein
 * Ausheben erzeugt die Pflicht-Kinder mit (Issue 0085). Sortiert wird absteigend.
 *
 * @param {{ forceId: string|null, forcePath: string|null, categoryId: string|null,
 *   entries?: Array<Object>|null }} params
 * @returns {{ candidates: Array<{ key: string, name: string, points: number,
 *   isBlocked: boolean, recruit: () => void }>, costTypeLabel: string }}
 */

/** Die Ankerarten, deren Slots im Dialog als Kandidaten erscheinen. */
const CANDIDATE_ANCHOR_KINDS = new Set(['occupied', 'offerAnchor', 'mandatoryPhantom']);

export function useRecruitOffer({ forceId = null, forcePath = null, categoryId = null, entries = null }) {
  const { report, roster, system, activeCatalogue } = useRosterReport();
  const { addUnit } = useRosterCommands();
  const slots = report?.slots ?? EMPTY_SLOT_INDEX;
  const costLimitType = resolveCostLimitTypeId(roster, system);
  const costTypeLabel = resolveCostLimitLabel(roster, system);

  const offers = useMemo(() => {
    if (!activeCatalogue) return [];

    // Erlaubte Definitions-Ids, wenn eine explizite Eintragsliste vorgegeben ist
    // (z. B. armeeweite Selektoren ohne eigene Kategorie-Sektion).
    const allowedIds = entries === null || entries === undefined
      ? null
      : new Set(entries.flatMap(entry => [entry?.id, entry?.targetId].filter(Boolean)));

    const seenDefIds = new Set();
    const candidates = [];
    for (const { path, capability } of slots.childSlotsOf(forcePath)) {
      if (!CANDIDATE_ANCHOR_KINDS.has(capability.anchorKind)) continue;
      if (capability.isHidden) continue;
      if (seenDefIds.has(capability.defId)) continue;
      if (allowedIds !== null) {
        if (!allowedIds.has(capability.defId)
          && !(capability.targetDefId && allowedIds.has(capability.targetDefId))) continue;
      } else {
        if (capability.primaryCategoryId !== categoryId) continue;
        if (capability.isForeignCatalogue) continue;
      }
      seenDefIds.add(capability.defId);
      candidates.push({ path, capability });
    }

    const costOf = capability => capability.raiseCosts?.[costLimitType] ?? 0;
    candidates.sort((a, b) => costOf(b.capability) - costOf(a.capability));

    // Der Aushebe-Callback erwartet den Katalogeintrag der Definition (die
    // Selektions-Fabrik liest ihn); bei einer expliziten Eintragsliste ist er
    // schon da, sonst löst ihn das Schreibmodell aus dem System auf.
    const entryFor = (capability) => {
      const fromEntries = entries?.find(entry =>
        entry.id === capability.defId || entry.id === capability.targetDefId
        || (entry.targetId && entry.targetId === capability.targetDefId));
      if (fromEntries) return fromEntries;
      return capabilityEntryOf(system, capability, activeCatalogue.id);
    };

    return candidates.map(({ path, capability }) => ({
      key: path,
      name: capability.name,
      points: costOf(capability),
      isBlocked: capability.isBlocked === true,
      entry: entryFor(capability),
    }));
  }, [activeCatalogue, slots, forcePath, categoryId, entries, costLimitType, system]);

  const candidates = useMemo(() => offers.map(offer => ({
    key: offer.key,
    name: offer.name,
    points: offer.points,
    isBlocked: offer.isBlocked,
    recruit: () => addUnit(offer.entry, categoryId, forceId),
  })), [offers, addUnit, categoryId, forceId]);

  return { candidates, costTypeLabel };
}
