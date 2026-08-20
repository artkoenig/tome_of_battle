import React from 'react';

import UnitSelectionCard from '../components/editor/UnitSelectionCard';
import SelectionConfigurator from '../components/editor/SelectionConfigurator';
import OptionGroup from '../components/editor/OptionGroup';
import { UnitUpgradesChips, UnitRulesChips } from '../components/editor/UnitChips';
import PlayUnitDetails from '../components/play/PlayUnitDetails';
import { RosterProviders, createEmptyRosterReport, createNoopRosterCommands } from './rosterProviders';

/**
 * Prüfstände für die Blätter des Editors (ADR-0038, Issue 0163).
 *
 * Seit die vier Bausteine ihr ViewModel haben, kommen Bericht, Roster,
 * Datensatz und Kommandos aus den beiden Roster-Kontexten statt aus dem
 * Prop-Satz. Ein Test, der eine dieser Komponenten isoliert rendert, müsste
 * sonst an jeder Rendering-Stelle zwei Provider von Hand aufbauen; die Hüllen
 * hier nehmen weiterhin die **flachen** Angaben entgegen (`capabilities`,
 * `pathBySelectionId`, `system`, `activeCatalogue`, die Kommandos) und
 * verdrahten sie zu dem Kontext, den die ViewModels lesen.
 */

/** Nur die gesetzten Felder — `undefined` würde den Leerbericht überschreiben. */
const definedOnly = (fields) =>
  Object.fromEntries(Object.entries(fields).filter(([, value]) => value !== undefined));

function withProviders({ report, roster, system, activeCatalogue, commands, children }) {
  return (
    <RosterProviders
      report={createEmptyRosterReport(definedOnly(report))}
      roster={roster ?? null}
      system={system ?? null}
      activeCatalogue={activeCatalogue ?? null}
      commands={createNoopRosterCommands(definedOnly(commands))}
    >
      {children}
    </RosterProviders>
  );
}

/** `UnitSelectionCard` mit dem Prop-Satz, den die Karte vor Issue 0163 trug. */
export function UnitSelectionCardHarness({
  roster, system, activeCatalogue,
  violations, capabilities, pathBySelectionId,
  removeUnit, copyUnit, subSelectionOperations,
  ...cardProps
}) {
  return withProviders({
    report: { violations, capabilities, pathBySelectionId },
    roster,
    system,
    activeCatalogue,
    commands: { removeUnit, copyUnit, subSelectionOperations },
    children: <UnitSelectionCard {...cardProps} />,
  });
}

/** `SelectionConfigurator` mit dem Prop-Satz von vor Issue 0163. */
export function SelectionConfiguratorHarness({
  roster, system, activeCatalogue,
  violations, capabilities, pathBySelectionId,
  subSelectionOperations,
  handleMouseEnter, handleMouseMove, handleMouseLeave, setActiveInfo,
  ...configuratorProps
}) {
  return withProviders({
    report: { violations, capabilities, pathBySelectionId },
    roster,
    system,
    activeCatalogue,
    commands: { subSelectionOperations },
    children: (
      <SelectionConfigurator
        {...configuratorProps}
        tooltip={{
          onEnter: handleMouseEnter,
          onMove: handleMouseMove,
          onLeave: handleMouseLeave,
          onOpen: setActiveInfo,
        }}
      />
    ),
  });
}

/** `OptionGroup` mit dem Prop-Satz von vor Issue 0163. */
export function OptionGroupHarness({
  roster, system, activeCatalogue,
  capabilities, pathBySelectionId,
  subSelectionOperations,
  getSubSelectionCount: _getSubSelectionCount,
  getOptionDescription: _getOptionDescription,
  onHoverEnter, onHoverMove, onHoverLeave, setActiveInfo,
  ...groupProps
}) {
  return withProviders({
    report: { capabilities, pathBySelectionId },
    roster,
    system,
    activeCatalogue,
    commands: { subSelectionOperations },
    children: (
      <OptionGroup
        {...groupProps}
        tooltip={{
          onEnter: onHoverEnter,
          onMove: onHoverMove,
          onLeave: onHoverLeave,
          onOpen: setActiveInfo,
        }}
      />
    ),
  });
}

const chipsHarness = (Chips) => function ChipsHarness({
  roster, system, activeCatalogue, activeCatalogueId,
  capability, capabilities, pathBySelectionId,
  ...chipProps
}) {
  // Ein Test, der den Fähigkeitsdatensatz der Einheit früher direkt reichte,
  // bekommt ihn hier als Ein-Eintrag-Bericht unter dem Pfad seiner Auswahl.
  const slots = capability && !capabilities
    ? {
      capabilities: new Map([['0', capability]]),
      pathBySelectionId: pathBySelectionId ?? new Map([[chipProps.selection?.id, '0']]),
    }
    : { capabilities, pathBySelectionId };
  return withProviders({
    report: slots,
    roster,
    system,
    activeCatalogue: activeCatalogue ?? (activeCatalogueId ? { id: activeCatalogueId } : null),
    commands: {},
    children: <Chips {...chipProps} />,
  });
};

/** `UnitUpgradesChips` mit dem Prop-Satz von vor Issue 0163. */
export const UnitUpgradesChipsHarness = chipsHarness(UnitUpgradesChips);

/** `UnitRulesChips` mit dem Prop-Satz von vor Issue 0163. */
export const UnitRulesChipsHarness = chipsHarness(UnitRulesChips);

/**
 * `PlayUnitDetails` behält seinen Prop-Satz; nur die Chip-Reihen darin lesen
 * seit Issue 0163 aus dem Bericht-Kontext, den die Spielansicht selbst aufspannt.
 */
export function PlayUnitDetailsHarness({ capability, capabilities, pathBySelectionId, system, roster, ...detailProps }) {
  const slots = capability && !capabilities
    ? {
      capabilities: new Map([['0', capability]]),
      pathBySelectionId: pathBySelectionId ?? new Map([[detailProps.selection?.id, '0']]),
    }
    : { capabilities, pathBySelectionId };
  return withProviders({
    report: slots,
    roster: roster ?? null,
    system: system ?? null,
    commands: {},
    children: (
      <PlayUnitDetails
        {...detailProps}
        system={system}
        roster={roster}
        capability={capability}
        capabilities={slots.capabilities}
        pathBySelectionId={slots.pathBySelectionId}
      />
    ),
  });
}
