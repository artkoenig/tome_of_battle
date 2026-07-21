import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

import {
  collectPrimaryCategoryEntries, getOptionDisplayCost, createSelectionFromDef, resolveEntry
} from './validator.js';
import CategoryUnitAdder from '../components/editor/CategoryUnitAdder.jsx';
import PlayUnitDetails from '../components/play/PlayUnitDetails.jsx';
import { SettingsProvider } from '../contexts/SettingsContext.jsx';

/**
 * Nach ADR 0018 sind mehrere Kataloge desselben Spielsystems gleichzeitig geladen, und
 * BattleScribe-IDs sind nur innerhalb eines Katalogs eindeutig. Der Resolver selbst ist
 * dagegen bereits abgesichert (catalogResolver.catalogueCollisions.test.js); hier geht es
 * um seine **Aufrufstellen**: geben sie den Katalog nicht mit, sucht der Resolver über alle
 * Katalog-Indizes und liefert den ersten Treffer — bei kollidierenden IDs also den Eintrag
 * des falschen Katalogs.
 *
 * Die Vorrichtung ist so gebaut, dass dieser Erst-Treffer immer der Ork-Eintrag ist,
 * während jede Prüfung den Chaoszwergen-Eintrag erwartet. Eine Aufrufstelle ohne
 * Katalog-Kontext fällt damit sichtbar durch.
 */

const COLLIDING_ENTRY_ID = 'shared-hero';
const ORCS_CATALOGUE_ID = 'cat-orcs';
const CHAOS_DWARFS_CATALOGUE_ID = 'cat-chaos-dwarfs';
const HERO_CATEGORY_ID = 'cat-heroes';
const POINTS_TYPE_ID = 'pts';
const POINTS_LABEL = 'Punkte';

const ORC_HERO = Object.freeze({
  linkId: 'link-orcs',
  name: 'Schwarzork-Kriegsboss',
  cost: 100,
  hidden: true,
  childId: 'orc-child',
  childName: 'Ork-Schild',
  childCost: 20,
  wounds: 5
});

const CHAOS_DWARF_HERO = Object.freeze({
  linkId: 'link-chaos-dwarfs',
  name: 'Chaoszwergen-Held',
  cost: 55,
  hidden: false,
  childId: 'chaos-dwarf-child',
  childName: 'Chaoszwergen-Ruestung',
  childCost: 5,
  wounds: 3
});

const CHAOS_DWARF_TOTAL_COST = CHAOS_DWARF_HERO.cost + CHAOS_DWARF_HERO.childCost;

/**
 * Ein Katalog, der den kollidierenden Helden ausschliesslich über einen entryLink
 * anbietet: die Definition selbst liegt in einer geteilten Gruppe, die die
 * Kategorie-Aufzaehlung nicht direkt liest. So haengt jedes Ergebnis daran, gegen
 * welchen Katalog der Link aufgeloest wird.
 */
function createCatalogue(catalogueId, hero) {
  return {
    id: catalogueId,
    name: catalogueId,
    entryLinks: [{ id: hero.linkId, targetId: COLLIDING_ENTRY_ID, type: 'selectionEntry' }],
    sharedSelectionEntryGroups: [{
      id: `${catalogueId}-shared-group`,
      selectionEntries: [{
        id: COLLIDING_ENTRY_ID,
        name: hero.name,
        type: 'model',
        hidden: hero.hidden,
        categoryLinks: [{ id: `${catalogueId}-category-link`, targetId: HERO_CATEGORY_ID, primary: true }],
        costs: [{ typeId: POINTS_TYPE_ID, value: hero.cost }],
        profiles: [{
          id: `${catalogueId}-profile`,
          name: hero.name,
          typeName: 'Model',
          profileTypeName: 'Model',
          characteristics: [{ name: 'W', value: String(hero.wounds) }]
        }],
        selectionEntries: [{
          id: hero.childId,
          name: hero.childName,
          type: 'upgrade',
          constraints: [{ id: `${hero.childId}-min`, type: 'min', value: 1, scope: 'parent' }],
          costs: [{ typeId: POINTS_TYPE_ID, value: hero.childCost }]
        }]
      }]
    }]
  };
}

function createSystem() {
  return {
    id: 'sys-collision',
    name: 'Warhammer Fantasy Battle',
    costTypes: [{ id: POINTS_TYPE_ID, name: POINTS_LABEL }],
    categoryEntries: [{ id: HERO_CATEGORY_ID, name: 'Helden' }],
    forceEntries: [{ id: 'force-army', name: 'Armee', categoryLinks: [{ id: 'fcl', targetId: HERO_CATEGORY_ID }] }],
    // Die Reihenfolge ist Teil der Vorrichtung. Der Index des Spielsystems wird ueber das
    // gesamte System aufgebaut, also auch ueber alle Kataloge, wobei der zuletzt indizierte
    // Eintrag gewinnt; er wird ausserdem als erster durchsucht. Eine kontextlose Suche
    // liefert damit den Eintrag des *letzten* Katalogs — hier den Ork-Helden.
    catalogues: [
      createCatalogue(CHAOS_DWARFS_CATALOGUE_ID, CHAOS_DWARF_HERO),
      createCatalogue(ORCS_CATALOGUE_ID, ORC_HERO)
    ]
  };
}

/** Eine Chaoszwergen-Liste — der Orks-Katalog ist daneben mitgeladen (ADR 0018). */
function createChaosDwarfRoster(selections = []) {
  return {
    id: 'roster-1',
    name: 'Chaoszwergen-Liste',
    systemId: 'sys-collision',
    catalogueId: CHAOS_DWARFS_CATALOGUE_ID,
    costLimit: 1000,
    costLimitType: POINTS_TYPE_ID,
    forces: [{ id: 'force-1', forceEntryId: 'force-army', catalogueId: CHAOS_DWARFS_CATALOGUE_ID, selections }]
  };
}

function catalogueOf(system, catalogueId) {
  return system.catalogues.find(catalogue => catalogue.id === catalogueId);
}

describe('Aufrufstellen des Resolvers — kollidierende IDs über Katalogsgrenzen', () => {
  // Deckt zwei Auswertungen in einem ab: den aufgeloesten Namen und den hidden-Zustand.
  // Ohne Katalog-Kontext traegt der Ork-Held (hidden) die Antwort und die Liste bleibt leer.
  test('die Kategorie-Aufzaehlung listet den Helden des aufgezaehlten Katalogs', () => {
    const system = createSystem();
    const roster = createChaosDwarfRoster();

    const found = collectPrimaryCategoryEntries(
      system, catalogueOf(system, CHAOS_DWARFS_CATALOGUE_ID), HERO_CATEGORY_ID, { roster }
    );

    expect(found.map(({ resolved }) => resolved.name)).toEqual([CHAOS_DWARF_HERO.name]);
  });

  test('der Anzeigepreis stammt aus dem Katalog des Kontexts', () => {
    const system = createSystem();
    const roster = createChaosDwarfRoster();
    const chaosDwarfLink = catalogueOf(system, CHAOS_DWARFS_CATALOGUE_ID).entryLinks[0];

    const cost = getOptionDisplayCost(system, chaosDwarfLink, POINTS_TYPE_ID, {
      system, roster, parentCatalogueId: CHAOS_DWARFS_CATALOGUE_ID
    });

    expect(cost).toBe(CHAOS_DWARF_TOTAL_COST);
  });

  test('die Selektions-Fabrik baut Einheit und Pflicht-Kind aus dem angegebenen Katalog', () => {
    const system = createSystem();
    const chaosDwarfLink = catalogueOf(system, CHAOS_DWARFS_CATALOGUE_ID).entryLinks[0];

    const selection = createSelectionFromDef({
      system,
      resolveEntry,
      catalogueId: CHAOS_DWARFS_CATALOGUE_ID,
      entry: chaosDwarfLink,
      categoryId: HERO_CATEGORY_ID
    });

    expect(selection.name).toBe(CHAOS_DWARF_HERO.name);
    expect(selection.selections.map(child => child.name)).toEqual([CHAOS_DWARF_HERO.childName]);
  });

  test('der Aushebe-Dialog zeigt Namen und Preis des aktiven Katalogs', () => {
    const system = createSystem();
    const roster = createChaosDwarfRoster();

    render(
      <CategoryUnitAdder
        categoryId={HERO_CATEGORY_ID}
        categoryName="Helden"
        system={system}
        activeCatalogue={catalogueOf(system, CHAOS_DWARFS_CATALOGUE_ID)}
        costTypeLabel={POINTS_LABEL}
        costLimitType={POINTS_TYPE_ID}
        addUnit={vi.fn()}
        roster={roster}
        selectionCounts={{}}
        force={roster.forces[0]}
      />
    );

    fireEvent.click(screen.getByTitle('Helden ausheben'));

    expect(screen.getByText(CHAOS_DWARF_HERO.name)).toBeTruthy();
    expect(screen.getByText(`+${CHAOS_DWARF_TOTAL_COST} ${POINTS_LABEL}`)).toBeTruthy();
  });

  test('die Spielansicht zeigt die Lebenspunkte des Katalogs der Liste', () => {
    const system = createSystem();
    const selection = {
      id: 'sel-1',
      entryLinkId: CHAOS_DWARF_HERO.linkId,
      name: CHAOS_DWARF_HERO.name,
      number: 1,
      selections: []
    };
    const roster = createChaosDwarfRoster([selection]);

    render(
      <SettingsProvider>
        <PlayUnitDetails
          selection={selection}
          system={system}
          roster={roster}
          getUnitCurrentWounds={(_id, totalMaxWounds) => totalMaxWounds}
          handleAdjustWound={vi.fn()}
          handleMouseEnter={vi.fn()}
          handleMouseLeave={vi.fn()}
          setSaveSummaryData={vi.fn()}
          setSaveSummaryOpen={vi.fn()}
          onShowRule={vi.fn()}
        />
      </SettingsProvider>
    );

    const woundCounter = `${CHAOS_DWARF_HERO.wounds} / ${CHAOS_DWARF_HERO.wounds}`;
    expect(screen.getByText(woundCounter)).toBeTruthy();
  });
});
