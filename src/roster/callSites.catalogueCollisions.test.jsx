import { describe, test, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

import { createSelectionFromDef } from './selectionFactory.js';
import { resolveEntry } from './catalogResolver.js';
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
 *
 * Zwei der vier frueheren Aufrufstellen — die Kategorie-Aufzaehlung des Adders und
 * der Anzeigepreis vor dem Ausheben — sind mit der zweiten Katalog-Auswertung
 * entfallen (Issue 0157): beide Antworten kommen heute aus dem Bericht, der die
 * Herkunft je Slot selbst kennt (`sourceId`/`isForeignCatalogue`).
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
  test('die Selektions-Fabrik baut Einheit und Pflicht-Kind aus dem angegebenen Katalog', () => {
    const system = createSystem();
    const chaosDwarfLink = catalogueOf(system, CHAOS_DWARFS_CATALOGUE_ID).entryLinks[0];

    const selection = createSelectionFromDef({
      system,
      resolveEntry,
      catalogueId: CHAOS_DWARFS_CATALOGUE_ID,
      entry: chaosDwarfLink,
      categoryId: HERO_CATEGORY_ID,
      // Die Pflicht-Mitgliedschaft sagt der Bericht (Issue 0157); die Fabrik loest
      // die genannte Id auf — und zwar im mitgegebenen Katalog. Beide Kataloge
      // fuehren ein Pflicht-Kind gleichen Namens unter *verschiedenen* Ids, also
      // faellt eine kontextlose Aufloesung hier sichtbar durch.
      mandatoryMembers: [{ defId: CHAOS_DWARF_HERO.childId, count: 1 }]
    });

    expect(selection.name).toBe(CHAOS_DWARF_HERO.name);
    expect(selection.selections.map(child => child.name)).toEqual([CHAOS_DWARF_HERO.childName]);
  });

  // Der frühere Aushebe-Dialog-Fall entfällt (Issue 0121, Task 6): der Dialog
  // liest seine Kandidaten nicht mehr über den Solver-Resolver, sondern aus den
  // Fähigkeitsdatensätzen des Evaluator-Berichts (ADR-0035). Der Evaluator löst
  // global-by-ID auf und sichert kollidierende IDs über die
  // `DUPLICATE_DEFINITION`-Diagnose statt über Katalog-Kontexte (ADR-0032).

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
