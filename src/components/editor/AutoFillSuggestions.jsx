import React, { useMemo } from 'react';
import { Plus, Wand2 } from 'lucide-react';
import { findEntryInSystem } from '../../roster';
import { useTranslation } from '../../i18n/useTranslation';

/**
 * Vorschläge zum Vervollständigen der Liste (Issue 0121, Task 6; ADR-0035).
 *
 * Die Vorschlagsquelle sind die **Pflicht-Signale** des Evaluator-Berichts
 * (`capabilities`): ein Pflicht-Phantom (`anchorKind: 'mandatoryPhantom'`)
 * benennt eine fehlende Pflichtauswahl, ein belegter Slot mit
 * `isMandatoryUnmet` eine Auswahl unter ihrem Minimum. Bloß Wählbares ohne
 * Pflicht-Signal erzeugt keinen Vorschlag; sind alle Pflichten erfüllt,
 * verschwindet das Panel. Die frühere Solver-Suche (Knapsack über die
 * Restpunkte) ist ersatzlos entfallen.
 *
 * Die **Apply-Mechanik** bleibt die bestehende: eine Unter-Auswahl wächst über
 * `subSelectionOperations.increaseCount`, eine fehlende Einheit wird über
 * `addUnit` ausgehoben. Beides braucht Kontext, den nur der Editor hat
 * (`pathBySelectionId` zur Rahmen-Auflösung, `system`/`activeCatalogue` für
 * den Katalogeintrag, `addUnit`); fehlen diese optionalen Props, rendert der
 * Vorschlag ohne Aktionsknopf.
 */
export default function AutoFillSuggestions({
  capabilities,
  subSelectionOperations,
  costTypeLabel,
  pathBySelectionId = null,
  addUnit = null,
  system = null,
  activeCatalogue = null
}) {
  const { t } = useTranslation();

  // Rahmen-Auflösung: Slot-Pfad → App-Selection-UUID (Umkehrung des Adapters).
  const selectionIdByPath = useMemo(() => {
    const inverse = new Map();
    if (pathBySelectionId) {
      for (const [selectionId, path] of pathBySelectionId) inverse.set(path, selectionId);
    }
    return inverse;
  }, [pathBySelectionId]);

  const suggestions = useMemo(() => {
    const collected = [];
    if (!capabilities) return collected;
    for (const [path, capability] of capabilities) {
      if (capability.isMandatoryUnmet !== true || capability.isHidden) continue;
      // Nur Auswahl-Slots sind Vorschläge: ein Kategorie- oder Gruppen-Anker
      // benennt keinen aushebbaren Eintrag (seine Pflicht erfüllt der Nutzer
      // über die konkreten Auswahlen darunter).
      if (capability.anchorKind !== 'occupied' && capability.anchorKind !== 'mandatoryPhantom') continue;
      const missing = Math.max(1, (capability.effectiveMin ?? 1) - (capability.current ?? 0));
      collected.push({ path, capability, missing });
    }
    return collected;
  }, [capabilities]);

  // Der Katalogeintrag hinter einem Slot — für die bestehende Aushebe-Mechanik.
  const entryFor = (capability) =>
    findEntryInSystem(system, capability.defId, activeCatalogue?.id)
      ?? { id: capability.defId, name: capability.name };

  /**
   * Die Anwenden-Aktion eines Vorschlags über die bestehende Mechanik — oder
   * `null`, wenn der nötige Kontext fehlt: ein Slot in einer Auswahl wächst
   * über `increaseCount` am Rahmen, ein Slot unter einem Kontingent wird über
   * `addUnit` ausgehoben (unter seiner effektiven Primärkategorie).
   */
  const applyActionFor = ({ capability }) => {
    const framePath = capability.frame?.path ?? null;
    if (framePath !== null && selectionIdByPath.has(framePath)) {
      const frameSelectionId = selectionIdByPath.get(framePath);
      return () => subSelectionOperations.increaseCount(frameSelectionId, entryFor(capability));
    }
    if (addUnit && framePath !== null && !selectionIdByPath.has(framePath)) {
      return () => addUnit(entryFor(capability), capability.primaryCategoryId ?? null);
    }
    return null;
  };

  if (suggestions.length === 0) return null;

  return (
    <div className="gothic-panel autofill-panel">
      <div className="autofill-header">
        <Wand2 className="text-gold" size={20} />
        <h3 className="font-serif text-gold no-margin">{t('editor.autofill.title')}</h3>
      </div>

      <div className="autofill-upgrade-list">
        {suggestions.map((suggestion) => {
          const { path, capability, missing } = suggestion;
          const cost = capability.costs
            ? Object.values(capability.costs).find(value => value > 0) ?? 0
            : 0;
          const apply = applyActionFor(suggestion);
          return (
            <div key={path} className="sub-selection-row autofill-upgrade-row">
              <div className="flex-col">
                <span className="text-strong">{capability.name}</span>
                {missing > 1 && (
                  <span className="text-micro text-dim">{`${missing}x`}</span>
                )}
              </div>
              <div className="sub-selection-controls autofill-upgrade-controls">
                {cost > 0 && <span className="text-gold text-label">+{cost} {costTypeLabel}</span>}
                {apply && (
                  <button
                    className="btn-secondary square-btn"
                    onClick={apply}
                    title={t('common.add')}
                  >
                    <Plus size={14} />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
