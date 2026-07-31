/**
 * Issue 0121, Task 13b (Kriterium 5) — der Aushebe-Dialog bietet nur Einheiten
 * des **aktiven Katalogs** an.
 *
 * Befund B1 der Pruefrunde 2: Der Evaluator loest alle mitgegebenen Quellen
 * global-by-Id auf (ADR-0032) und verankert jede im Kontingent waehlbare
 * Definition als Angebots-Anker — auch die Wurzel-Eintraege **fremder**
 * Armeebuecher. Der Dialog las die Anker ungefiltert und bot damit Einheiten an,
 * die in dieser Liste nicht aufgestellt werden duerfen.
 *
 * Sollregel (dieselbe wie `creatableForcesOf` in `NewRosterModal.jsx`), gelesen
 * an `capability.sourceId` (Task 13a) und `system.catalogues`:
 *
 * - `sourceId === activeCatalogue.id` → wird angeboten;
 * - `sourceId` ist die Id **keines** nicht-Bibliotheks-Katalogs des Systems
 *   (also Spielsystem oder Bibliothekskatalog) → wird angeboten;
 * - `sourceId` ist die Id eines **anderen** nicht-Bibliotheks-Katalogs →
 *   erscheint **gar nicht** (auch nicht gesperrt);
 * - `sourceId === null`/fehlend → wird angeboten (kein stilles Verschwinden bei
 *   unbekannter Herkunft).
 *
 * Beobachtet wird am gerenderten Dialog. Der Datensatz ist `.gst` + drei `.cat`
 * (eigener, fremder, Bibliothek) und laeuft durch die **echte** Fassade; nur die
 * beiden Faelle „Herkunft unbekannt" bauen ihre Slot-Map von Hand, aus einem
 * echten Faehigkeitsdatensatz abgeleitet (ein Katalog ohne Wurzel-Id ist ein
 * Datenfehler, kein Fixture-tauglicher Zustand des App-Modells).
 *
 * Fixture- und Harness-Muster: `CategoryUnitAdder.evaluator.test.jsx`.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CategoryUnitAdder from './CategoryUnitAdder';
import { prepareDataset, evaluate } from '../../evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../evaluation/rosterAdapter.js';

vi.mock('lucide-react', () => ({
  Plus: () => <span data-testid="icon-plus" />,
  X: () => <span data-testid="icon-x" />,
}));

// Die Kinder der BottomSheet inline rendern, sobald sie offen ist (kein Portal).
vi.mock('./BottomSheet', () => ({
  default: ({ isOpen, children }) => (isOpen ? <div data-testid="sheet">{children}</div> : null),
}));

// ── Synthetischer Datensatz: Spielsystem + eigener, fremder, Bibliotheks-Katalog ──

const GAME_SYSTEM_ID = 'gs-main';
const COST_TYPE_ID = 'cost-pts';
const CATEGORY_ID = 'cat-special';
const FORCE_DEF_ID = 'force-main';
const FORCE_PATH = '0';

const OWN_CATALOGUE_ID = 'cat-own';
const FOREIGN_CATALOGUE_ID = 'cat-foreign';
const LIBRARY_CATALOGUE_ID = 'cat-lib';

const GST_SHARED_ENTRY_ID = 'shared-gst-banner';
const OWN_ENTRY_ID = 'entry-own';
const FOREIGN_ENTRY_ID = 'entry-foreign';
const LIBRARY_ENTRY_ID = 'entry-lib';
const FOREIGN_SHARED_ENTRY_ID = 'shared-foreign-ogre';
const OWN_LINK_ID = 'link-own-to-foreign';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
  <gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
    <costTypes><costType id="${COST_TYPE_ID}" name="pts" defaultCostLimit="-1"/></costTypes>
    <categoryEntries><categoryEntry id="${CATEGORY_ID}" name="Special"/></categoryEntries>
    <sharedSelectionEntries>
      <selectionEntry id="${GST_SHARED_ENTRY_ID}" name="Grand Banner" type="upgrade">
        <categoryLinks><categoryLink id="gl-b" name="Special" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="7"/></costs>
      </selectionEntry>
    </sharedSelectionEntries>
    <forceEntries>
      <forceEntry id="${FORCE_DEF_ID}" name="Main Force">
        <categoryLinks><categoryLink id="cl-special" name="Special" targetId="${CATEGORY_ID}" primary="false"/></categoryLinks>
      </forceEntry>
    </forceEntries>
  </gameSystem>`;

const OWN_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${OWN_CATALOGUE_ID}" name="Vampire Counts" gameSystemId="${GAME_SYSTEM_ID}">
    <selectionEntries>
      <selectionEntry id="${OWN_ENTRY_ID}" name="Vampire" type="unit">
        <categoryLinks><categoryLink id="ol-1" name="Special" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="30"/></costs>
      </selectionEntry>
    </selectionEntries>
    <entryLinks>
      <entryLink id="${OWN_LINK_ID}" name="Hired Ogre" targetId="${FOREIGN_SHARED_ENTRY_ID}" type="selectionEntry">
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="55"/></costs>
      </entryLink>
    </entryLinks>
  </catalogue>`;

const FOREIGN_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${FOREIGN_CATALOGUE_ID}" name="Ogre Kingdoms" gameSystemId="${GAME_SYSTEM_ID}">
    <sharedSelectionEntries>
      <selectionEntry id="${FOREIGN_SHARED_ENTRY_ID}" name="Ogre Bull" type="unit">
        <categoryLinks><categoryLink id="fs-1" name="Special" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="45"/></costs>
      </selectionEntry>
    </sharedSelectionEntries>
    <selectionEntries>
      <selectionEntry id="${FOREIGN_ENTRY_ID}" name="Gorger" type="unit">
        <categoryLinks><categoryLink id="fl-1" name="Special" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="40"/></costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

const LIBRARY_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${LIBRARY_CATALOGUE_ID}" name="Mercenaries" gameSystemId="${GAME_SYSTEM_ID}" library="true">
    <selectionEntries>
      <selectionEntry id="${LIBRARY_ENTRY_ID}" name="Mercenary Captain" type="unit">
        <categoryLinks><categoryLink id="ll-1" name="Special" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="20"/></costs>
      </selectionEntry>
    </selectionEntries>
  </catalogue>`;

/**
 * Das App-System-Objekt: rohe XMLs plus die Katalog-Metadaten, an denen die
 * Oberflaeche Bibliothek von Armeebuch unterscheidet (Shape aus
 * `src/parser/xmlParser.js` / `src/db/systemImport.js`).
 */
function appSystem() {
  return {
    id: GAME_SYSTEM_ID,
    name: 'Test System',
    catalogues: [
      { id: OWN_CATALOGUE_ID, name: 'Vampire Counts', isLibrary: false },
      { id: FOREIGN_CATALOGUE_ID, name: 'Ogre Kingdoms', isLibrary: false },
      { id: LIBRARY_CATALOGUE_ID, name: 'Mercenaries', isLibrary: true },
    ],
    rawXmls: {
      gst: [{ name: 'test.gst', content: GAME_SYSTEM_XML }],
      cat: [
        { name: 'own.cat', content: OWN_CATALOGUE_XML },
        { name: 'foreign.cat', content: FOREIGN_CATALOGUE_XML },
        { name: 'library.cat', content: LIBRARY_CATALOGUE_XML },
      ],
    },
  };
}

/** App-Roster: das Kontingent mit dem geteilten Eintrag der `.gst`. */
function appRoster() {
  return {
    id: 'roster-uuid',
    name: 'Test Roster',
    systemId: GAME_SYSTEM_ID,
    catalogueId: OWN_CATALOGUE_ID,
    costLimit: 2000,
    costLimitType: COST_TYPE_ID,
    forces: [{
      id: 'force-uuid-1',
      forceEntryId: FORCE_DEF_ID,
      catalogueId: OWN_CATALOGUE_ID,
      selections: [{
        id: 'sel-banner',
        name: 'Grand Banner',
        entryLinkId: null,
        selectionEntryId: GST_SHARED_ENTRY_ID,
        number: 1,
        category: null,
        selections: [],
      }],
    }],
  };
}

/** Auswertung über die ECHTE Fassade — die einzige Quelle der Slot-Map. */
function capabilitiesOfDataset() {
  const prepared = prepareDataset({
    gameSystem: GAME_SYSTEM_XML,
    catalogues: [OWN_CATALOGUE_XML, FOREIGN_CATALOGUE_XML, LIBRARY_CATALOGUE_XML],
  });
  const { evalRoster } = toEvaluatorRoster(appRoster());
  return evaluate(prepared, evalRoster).capabilities;
}

/** Der Slot-Datensatz einer Definition unter dem Kontingent. */
function capabilityOf(capabilities, defId) {
  for (const [path, capability] of capabilities) {
    if (path.startsWith(`${FORCE_PATH}/`) && capability.defId === defId) return capability;
  }
  return undefined;
}

function renderAdder({ capabilities, entries = null, addUnit = vi.fn() }) {
  render(
    <CategoryUnitAdder
      categoryId={CATEGORY_ID}
      categoryName="Special"
      capabilities={capabilities}
      forcePath={FORCE_PATH}
      system={appSystem()}
      activeCatalogue={{ id: OWN_CATALOGUE_ID }}
      costTypeLabel="Pkt"
      costLimitType={COST_TYPE_ID}
      addUnit={addUnit}
      entries={entries}
    />
  );
}

function openDialog() {
  fireEvent.click(screen.getByTitle('Special ausheben'));
}

describe('CategoryUnitAdder: nur Einheiten des aktiven Katalogs (Issue 0121, Task 13, Kriterium 5)', () => {
  it('eine Einheit eines FREMDEN Armeebuchs erscheint gar nicht — auch nicht gesperrt', () => {
    const capabilities = capabilitiesOfDataset();
    // Vorbedingung, seit Issue 0140 umgekehrt: der fremde Eintrag haengt gar
    // nicht mehr als Angebots-Anker unter dem Kontingent. Bis dahin lieferte
    // die Engine ihn (Wurzel-Eintraege aller Kataloge wurden katalogfremd
    // gepoolt), und diese Datei bewies, dass die **Oberflaeche** ihn ausblendet;
    // seit Issue 0140 nennt das Roster der Engine das Armeebuch je Kontingent
    // (`force.catalogueId`), und schon die Engine haelt ihn zurueck. Die
    // nutzersichtbare Zusage bleibt woertlich dieselbe und wird unveraendert
    // geprueft — der Dialog zeigt „Gorger" nicht; nur ihre Vorbedingung ist
    // eine andere. Der UI-Filter selbst bleibt noetig: er deckt Faelle ab, die
    // die Engine bewusst durchlaesst (etwa unbekannte Herkunft, siehe unten).
    expect(capabilityOf(capabilities, FOREIGN_ENTRY_ID)).toBeUndefined();

    renderAdder({ capabilities });
    openDialog();

    expect(screen.queryByText('Gorger')).toBeNull();
  });

  it('die Einheit des AKTIVEN Katalogs erscheint', () => {
    const capabilities = capabilitiesOfDataset();

    renderAdder({ capabilities });
    openDialog();

    expect(screen.getByText('Vampire')).toBeTruthy();
  });

  it('ein Verweis des aktiven Katalogs auf ein fremdes Ziel erscheint (Link-Id-Regel)', () => {
    const capabilities = capabilitiesOfDataset();
    expect(capabilityOf(capabilities, OWN_LINK_ID)).toMatchObject({
      targetDefId: FOREIGN_SHARED_ENTRY_ID,
    });

    renderAdder({ capabilities });
    openDialog();

    expect(screen.getByText('Hired Ogre')).toBeTruthy();
  });

  it('eine Einheit des Spielsystems und eine aus einem Bibliothekskatalog erscheinen', () => {
    const capabilities = capabilitiesOfDataset();

    renderAdder({ capabilities });
    openDialog();

    expect(screen.getByText('Grand Banner')).toBeTruthy();
    expect(screen.getByText('Mercenary Captain')).toBeTruthy();
  });

  it('die Kandidatenliste enthaelt genau die erlaubten Einheiten', () => {
    const capabilities = capabilitiesOfDataset();

    renderAdder({ capabilities });
    openDialog();

    const offeredNames = [...document.querySelectorAll('.popover-item-name')]
      .map((row) => row.querySelector('span').textContent);
    expect(offeredNames.sort()).toEqual(
      ['Grand Banner', 'Hired Ogre', 'Mercenary Captain', 'Vampire'].sort(),
    );
  });

  it('die explizite entries-Liste (armeeweite Selektoren) funktioniert weiter', () => {
    const capabilities = capabilitiesOfDataset();

    renderAdder({ capabilities, entries: [{ id: OWN_ENTRY_ID, name: 'Vampire' }] });
    openDialog();

    expect(screen.getByText('Vampire')).toBeTruthy();
  });
});

describe('CategoryUnitAdder: unbekannte Herkunft verschwindet nicht still', () => {
  /**
   * Eine Slot-Map mit genau einem Kandidaten, dessen Herkunft unbekannt ist —
   * abgeleitet aus einem echten Faehigkeitsdatensatz, damit die Form stimmt.
   */
  function capabilitiesWithUnknownSource(sourceOverride) {
    const real = capabilityOf(capabilitiesOfDataset(), OWN_ENTRY_ID);
    const mystery = { ...real, defId: 'entry-mystery', name: 'Mystery Unit', ...sourceOverride };
    if (!('sourceId' in sourceOverride)) delete mystery.sourceId;
    return new Map([[`${FORCE_PATH}/0`, mystery]]);
  }

  it('sourceId null → der Kandidat wird angeboten', () => {
    renderAdder({ capabilities: capabilitiesWithUnknownSource({ sourceId: null }) });
    openDialog();

    expect(screen.getByText('Mystery Unit')).toBeTruthy();
  });

  it('fehlendes sourceId → der Kandidat wird angeboten', () => {
    renderAdder({ capabilities: capabilitiesWithUnknownSource({}) });
    openDialog();

    expect(screen.getByText('Mystery Unit')).toBeTruthy();
  });
});
