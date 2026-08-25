import { useCallback, useMemo, useState } from 'react';
import { describeSystem, costLimitLabelOf } from '../../contexts/ruleengine/readmodel/index.js';
import { DEFAULT_ROSTER_COST_LIMIT } from '../../domain/roster/rosterDefaults';

/**
 * ViewModel des Modals „Neue Armeeliste" (ADR-0038).
 *
 * Formularzustand und Angebot (Kataloge, Kontingente, Kostenart-Label) liegen
 * hier; das Modal ist danach nur noch JSX. Katalog-, Kontingent- und
 * Kostenart-Angebot kommen aus der Datensatz-Beschreibung des Evaluators
 * (`describeSystem`, Issue 0121, Task 7).
 */

const COST_LIMIT_PRESETS = [1000, 1500, 2000, 2500];

/**
 * Die spielbaren Kataloge eines Systems aus der Datensatz-Beschreibung:
 * spielbar ist jeder Katalog, der keine reine Bibliothek ist (ADR-0034).
 */
const playableCataloguesOf = (description) =>
  (description?.catalogues ?? []).filter(catalogue => catalogue.isLibrary !== true);

/**
 * Die anlegbaren Kontingente für den gewählten Katalog: die sichtbaren
 * (`isHidden`-gefilterten) Kontingente der Beschreibung, beschränkt auf die des
 * Spielsystems (Quelle ist kein Katalog) und die des gewählten Katalogs —
 * Kontingente fremder Armeebücher gehören nicht in diese Auswahl.
 */
function creatableForcesOf(description, catalogueId) {
  if (!description) return [];
  const catalogueIds = new Set(description.catalogues.map(catalogue => catalogue.id));
  return description.creatableForces.filter(force =>
    force.isHidden !== true
    && (force.sourceId === catalogueId || !catalogueIds.has(force.sourceId)));
}

/**
 * Der Vorschlag für das Zahlenfeld: die deklarierte Vorgabe-Grenze
 * (`defaultCostLimit`) der Limit-Kostenart — der ersten Kostenart des Systems.
 * Ohne deklarierte Grenze (fehlend oder Sentinel −1 → `defaultLimit: null`)
 * bleibt der bisherige Vorgabewert.
 */
const defaultLimitOf = (description) =>
  description?.costTypes?.[0]?.defaultLimit ?? DEFAULT_ROSTER_COST_LIMIT;

const defaultForceEntryIdOf = (description, catalogueId) =>
  creatableForcesOf(description, catalogueId)[0]?.id ?? '';

/**
 * Der Formularstand, den ein System als Vorgabe setzt.
 */
function defaultsOf(system) {
  const description = describeSystem(system);
  const catId = playableCataloguesOf(description)[0]?.id ?? '';
  return {
    systemId: system?.id || '',
    catId,
    forceEntryId: description ? defaultForceEntryIdOf(description, catId) : '',
    limit: defaultLimitOf(description),
  };
}

/**
 * @param {{ isOpen: boolean, systems?: object[], onCreate: (form: object) => void }} args
 */
export function useNewRosterModal({ isOpen, systems = [], onCreate }) {
  const [form, setForm] = useState(() => ({ name: '', ...defaultsOf(systems[0]) }));
  // Beim Öffnen wird das Formular zurückgesetzt. Der Vergleich mit dem zuletzt
  // gesehenen `isOpen` erledigt das im Render, ohne einen Effekt: ein Effekt
  // ließe für einen Frame die Eingaben des vorigen Aufrufs stehen, und mit
  // `systems` in seiner Abhängigkeitsliste würde er die laufende Eingabe des
  // Nutzers verwerfen, sobald die Systemliste eine neue Identität bekommt.
  const [wasOpen, setWasOpen] = useState(isOpen);
  if (isOpen !== wasOpen) {
    setWasOpen(isOpen);
    if (isOpen) setForm({ name: '', ...defaultsOf(systems[0]) });
  }

  const setField = useCallback((field, value) => {
    setForm(previous => ({ ...previous, [field]: value }));
  }, []);

  const offer = useMemo(() => {
    const activeDescription = describeSystem(systems.find(s => s.id === form.systemId));
    return {
      activeDescription,
      selectableCatalogues: playableCataloguesOf(activeDescription),
      availableForceEntries: creatableForcesOf(activeDescription, form.catId),
      // Noch existiert kein Roster; das Limit gilt für die erste Kostenart.
      costLimitLabel: costLimitLabelOf(null, activeDescription?.costTypes),
    };
  }, [systems, form.systemId, form.catId]);

  const selectSystem = useCallback((systemId) => {
    setForm(previous => ({ ...previous, ...defaultsOf(systems.find(s => s.id === systemId)) }));
  }, [systems]);

  const selectCatalogue = useCallback((catId) => {
    setForm(previous => {
      const description = describeSystem(systems.find(s => s.id === previous.systemId));
      return {
        ...previous,
        catId,
        forceEntryId: description ? defaultForceEntryIdOf(description, catId) : '',
      };
    });
  }, [systems]);

  const submit = useCallback((event) => {
    event.preventDefault();
    const { name, systemId, catId, forceEntryId, limit } = form;
    onCreate({ name, systemId, catId, forceEntryId, limit });
  }, [form, onCreate]);

  return {
    ...form,
    ...offer,
    presets: COST_LIMIT_PRESETS,
    hasSystems: systems.length > 0,
    setName: useCallback((name) => setField('name', name), [setField]),
    setForceEntryId: useCallback((id) => setField('forceEntryId', id), [setField]),
    setLimit: useCallback((limit) => setField('limit', limit), [setField]),
    selectSystem,
    selectCatalogue,
    submit,
  };
}
