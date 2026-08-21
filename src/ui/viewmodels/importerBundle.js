import { t as translate } from '../i18n/i18nStore';
import { buildRevisionDisplay } from './importerRevisionDisplay';

/**
 * Die Bündel-Ansicht der Import-Hülle, aus `useImporter.js` herausgeschnitten
 * (Issue 0176): das gewählte System des Katalog-Index gegen die installierten
 * Systeme gehalten. Eine reine Funktion — der Hook hält nur den Zustand.
 */

/**
 * Eine Auswahl-Map, die jeden Katalog eines Systems als gewählt markiert.
 */
export function allSelectedCatalogues(system) {
  const selected = {};
  (system?.catalogues ?? []).forEach(catalogue => { selected[catalogue.id] = true; });
  return selected;
}

const EMPTY_BUNDLE = {
  selectedSystem: null,
  selectedCount: 0,
  allChecked: false,
  revisionDisplay: null,
  catalogues: [],
};

/**
 * @param {{
 *   availableSystems: object[],
 *   selectedBundleSysId: string,
 *   selectedCats: Record<string, boolean>,
 *   systems: object[],
 * }} args
 */
export function buildBundleView({ availableSystems, selectedBundleSysId, selectedCats, systems }, t = translate) {
  const selectedSystem = availableSystems.find(s => s.id === selectedBundleSysId) ?? null;
  if (!selectedSystem) {
    return { ...EMPTY_BUNDLE, hasIndex: availableSystems.length > 0 };
  }

  // Das lokal gespeicherte Gegenstück des gewählten Systems stammt aus
  // derselben Liste wie überall sonst — kein zweiter Datenbankzugriff.
  const storedSystem = systems.find(s => s.id === selectedSystem.id) ?? null;

  return {
    hasIndex: true,
    selectedSystem,
    selectedCount: selectedSystem.catalogues.filter(c => selectedCats[c.id]).length,
    allChecked: selectedSystem.catalogues.every(c => selectedCats[c.id]),
    revisionDisplay: buildRevisionDisplay(selectedSystem.gst.revision, storedSystem, t),
    catalogues: selectedSystem.catalogues.map(catalogue => ({
      ...catalogue,
      isSelected: !!selectedCats[catalogue.id],
      revisionDisplay: buildRevisionDisplay(
        catalogue.revision,
        storedSystem?.catalogues?.find(c => c.id === catalogue.id) ?? null,
        t
      ),
    })),
  };
}
