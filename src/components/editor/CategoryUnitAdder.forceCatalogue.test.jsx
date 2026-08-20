/**
 * Issue 0121, Task 19 (Kriterium 5) — der Herkunftsfilter des Aushebe-Dialogs
 * fragt nach dem Armeebuch **des Kontingents**, nicht dem der ganzen Liste.
 *
 * Befund F3 der Pruefrunde 3: Der in Runde 2 eingebaute Filter vergleicht die
 * Herkunft eines Slots (`capability.sourceId`) gegen `activeCatalogue` — und das
 * ist roster-weit (`RosterEditor` leitet es einmal aus `roster.catalogueId` ab
 * und gibt dasselbe Objekt an jedes Kontingent). Das App-Modell fuehrt den
 * Katalog aber **je Kontingent** (`force.catalogueId`, gesetzt beim
 * `.ros`-Import; `useRoster.catalogueIdOfForce` liest ihn). Eine Liste mit
 * verbuendetem Kontingent bekommt dort deshalb die Einheiten des **falschen**
 * Armeebuchs angeboten und die eigenen weggefiltert.
 *
 * **Vertrag (im Auftrag festgelegt, nicht hier erfunden):** der Dialog bekommt
 * die Katalog-Id seines Kontingents als Prop `forceCatalogueId`; fehlt sie oder
 * ist sie `null`, gilt `activeCatalogue.id` (Altverhalten).
 *
 * Sollverhalten am gerenderten Dialog:
 * 1. Im Kontingent eines verbuendeten Armeebuchs erscheinen dessen **eigene**
 *    Einheiten.
 * 2. Dort erscheinen die Einheiten des Primaer-Armeebuchs **nicht**.
 * 3. Im Primaer-Kontingent bleibt alles wie bisher.
 * 4. Ohne eigenen Katalog des Kontingents gilt der des Rosters — Altverhalten.
 * 5. Spielsystem- und Bibliothekseintraege erscheinen weiterhin ueberall.
 *
 * Datensatz: `.gst` + drei `.cat` (Primaer, Verbuendeter, Bibliothek), durch die
 * **echte** Fassade ausgewertet. Das Roster hat zwei Kontingente derselben
 * Kontingent-Definition: `"0"` das Primaer-Kontingent, `"1"` das verbuendete.
 *
 * Stil und Fixture-Muster: `CategoryUnitAdder.activeCatalogue.test.jsx` (die
 * Datei bleibt unangetastet; hier stehen nur die Faelle je Kontingent).
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

vi.mock('./BottomSheet', () => ({
  default: ({ isOpen, children }) => (isOpen ? <div data-testid="sheet">{children}</div> : null),
}));

// ── Synthetischer Datensatz ─────────────────────────────────────────────────

const GAME_SYSTEM_ID = 'gs-main';
const COST_TYPE_ID = 'cost-pts';
const CATEGORY_ID = 'cat-special';
const FORCE_DEF_ID = 'force-main';

/** Slot-Pfade der beiden Kontingente im Bericht. */
const PRIMARY_FORCE_PATH = '0';
const ALLIED_FORCE_PATH = '1';

const PRIMARY_CATALOGUE_ID = 'cat-own';
const ALLIED_CATALOGUE_ID = 'cat-ally';
const LIBRARY_CATALOGUE_ID = 'cat-lib';

const GST_SHARED_ENTRY_ID = 'shared-gst-banner';
const PRIMARY_ENTRY_ID = 'entry-own';
const ALLIED_ENTRY_ID = 'entry-ally';
const LIBRARY_ENTRY_ID = 'entry-lib';
const ALLIED_SHARED_ENTRY_ID = 'shared-ally-ogre';
const PRIMARY_LINK_ID = 'link-own-to-ally';

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

const PRIMARY_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${PRIMARY_CATALOGUE_ID}" name="Vampire Counts" gameSystemId="${GAME_SYSTEM_ID}">
    <catalogueLinks>
      <catalogueLink id="cl-own-to-lib" name="Mercenaries" type="catalogue" targetId="${LIBRARY_CATALOGUE_ID}" importRootEntries="true"/>
    </catalogueLinks>
    <selectionEntries>
      <selectionEntry id="${PRIMARY_ENTRY_ID}" name="Vampire" type="unit">
        <categoryLinks><categoryLink id="ol-1" name="Special" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="30"/></costs>
      </selectionEntry>
    </selectionEntries>
    <entryLinks>
      <entryLink id="${PRIMARY_LINK_ID}" name="Hired Ogre" targetId="${ALLIED_SHARED_ENTRY_ID}" type="selectionEntry">
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="55"/></costs>
      </entryLink>
    </entryLinks>
  </catalogue>`;

const ALLIED_CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
  <catalogue id="${ALLIED_CATALOGUE_ID}" name="Ogre Kingdoms" gameSystemId="${GAME_SYSTEM_ID}">
    <catalogueLinks>
      <catalogueLink id="cl-ally-to-lib" name="Mercenaries" type="catalogue" targetId="${LIBRARY_CATALOGUE_ID}" importRootEntries="true"/>
    </catalogueLinks>
    <sharedSelectionEntries>
      <selectionEntry id="${ALLIED_SHARED_ENTRY_ID}" name="Ogre Bull" type="unit">
        <categoryLinks><categoryLink id="fs-1" name="Special" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
        <costs><cost name="pts" typeId="${COST_TYPE_ID}" value="45"/></costs>
      </selectionEntry>
    </sharedSelectionEntries>
    <selectionEntries>
      <selectionEntry id="${ALLIED_ENTRY_ID}" name="Gorger" type="unit">
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

/** Das App-System-Objekt: Katalog-Metadaten (Bibliothek ja/nein) plus rohe XMLs. */
function appSystem() {
  return {
    id: GAME_SYSTEM_ID,
    name: 'Test System',
    catalogues: [
      { id: PRIMARY_CATALOGUE_ID, name: 'Vampire Counts', isLibrary: false },
      { id: ALLIED_CATALOGUE_ID, name: 'Ogre Kingdoms', isLibrary: false },
      { id: LIBRARY_CATALOGUE_ID, name: 'Mercenaries', isLibrary: true },
    ],
    rawXmls: {
      gst: [{ name: 'test.gst', content: GAME_SYSTEM_XML }],
      cat: [
        { name: 'own.cat', content: PRIMARY_CATALOGUE_XML },
        { name: 'ally.cat', content: ALLIED_CATALOGUE_XML },
        { name: 'library.cat', content: LIBRARY_CATALOGUE_XML },
      ],
    },
  };
}

/** App-Roster: Primaer-Kontingent (mit dem `.gst`-Eintrag) plus verbuendetes. */
function appRoster() {
  return {
    id: 'roster-uuid',
    name: 'Test Roster',
    systemId: GAME_SYSTEM_ID,
    catalogueId: PRIMARY_CATALOGUE_ID,
    costLimit: 2000,
    costLimitType: COST_TYPE_ID,
    forces: [
      {
        id: 'force-uuid-primary',
        forceEntryId: FORCE_DEF_ID,
        catalogueId: PRIMARY_CATALOGUE_ID,
        selections: [{
          id: 'sel-banner',
          name: 'Grand Banner',
          entryLinkId: null,
          selectionEntryId: GST_SHARED_ENTRY_ID,
          number: 1,
          category: null,
          selections: [],
        }],
      },
      {
        id: 'force-uuid-allied',
        forceEntryId: FORCE_DEF_ID,
        catalogueId: ALLIED_CATALOGUE_ID,
        // Derselbe `.gst`-Eintrag auch hier: ein geteilter Spielsystem-Eintrag
        // haengt nur dort als Slot, wo er gewaehlt ist — ohne ihn haette dieses
        // Kontingent gar keinen Spielsystem-Kandidaten, und Kriterium 5 ("das
        // Spielsystem erscheint ueberall") haette keinen Gegenstand.
        selections: [{
          id: 'sel-banner-allied',
          name: 'Grand Banner',
          entryLinkId: null,
          selectionEntryId: GST_SHARED_ENTRY_ID,
          number: 1,
          category: null,
          selections: [],
        }],
      },
    ],
  };
}

/** Auswertung ueber die ECHTE Fassade — die einzige Quelle der Slot-Map. */
function capabilitiesOfDataset() {
  const prepared = prepareDataset({
    gameSystem: GAME_SYSTEM_XML,
    catalogues: [PRIMARY_CATALOGUE_XML, ALLIED_CATALOGUE_XML, LIBRARY_CATALOGUE_XML],
  });
  const { evalRoster } = toEvaluatorRoster(appRoster());
  return evaluate(prepared, evalRoster).capabilities;
}

/** Der Slot-Datensatz einer Definition unter einem Kontingent. */
function capabilityOf(capabilities, forcePath, defId) {
  for (const [path, capability] of capabilities) {
    if (path.startsWith(`${forcePath}/`) && capability.defId === defId) return capability;
  }
  return undefined;
}

/**
 * Rendert den Dialog eines Kontingents. `activeCatalogue` ist roster-weit (so
 * wie `RosterEditor` es fuehrt) und bleibt in jedem Fall der Primaer-Katalog;
 * `forceCatalogueId` ist das Armeebuch **dieses** Kontingents.
 */
function renderAdder({ capabilities, forcePath, forceCatalogueId, entries = null, addUnit = vi.fn() }) {
  const props = {
    categoryId: CATEGORY_ID,
    categoryName: 'Special',
    capabilities,
    forcePath,
    system: appSystem(),
    activeCatalogue: { id: PRIMARY_CATALOGUE_ID },
    costTypeLabel: 'Pkt',
    costLimitType: COST_TYPE_ID,
    addUnit,
    entries,
  };
  if (forceCatalogueId !== undefined) props.forceCatalogueId = forceCatalogueId;
  render(<CategoryUnitAdder {...props} />);
}

function openDialog() {
  fireEvent.click(screen.getByTitle('Special ausheben'));
}

/** Die Namen, die der offene Dialog anbietet. */
function offeredNames() {
  return [...document.querySelectorAll('.popover-item-name')]
    .map((row) => row.querySelector('span').textContent)
    .sort();
}

describe('CategoryUnitAdder: Herkunftsfilter je Kontingent (Issue 0121, Task 19, Kriterium 5)', () => {
  it('im verbuendeten Kontingent erscheint dessen EIGENE Einheit', () => {
    const capabilities = capabilitiesOfDataset();
    // Vorbedingung gegen den echten Bericht: der Eintrag des Verbuendeten haengt
    // als waehlbarer Angebots-Anker unter dem verbuendeten Kontingent.
    expect(capabilityOf(capabilities, ALLIED_FORCE_PATH, ALLIED_ENTRY_ID)).toMatchObject({
      anchorKind: 'offerAnchor',
      isHidden: false,
      sourceId: ALLIED_CATALOGUE_ID,
    });

    renderAdder({
      capabilities,
      forcePath: ALLIED_FORCE_PATH,
      forceCatalogueId: ALLIED_CATALOGUE_ID,
    });
    openDialog();

    expect(screen.getByText('Gorger')).toBeTruthy();
  });

  it('im verbuendeten Kontingent erscheint die Einheit des PRIMAER-Armeebuchs nicht', () => {
    renderAdder({
      capabilities: capabilitiesOfDataset(),
      forcePath: ALLIED_FORCE_PATH,
      forceCatalogueId: ALLIED_CATALOGUE_ID,
    });
    openDialog();

    expect(screen.queryByText('Vampire')).toBeNull();
    // Auch der Verweis des Primaer-Armeebuchs auf ein fremdes Ziel gehoert dem
    // Primaer-Buch (Link-Id-Regel auf die Herkunft angewandt).
    expect(screen.queryByText('Hired Ogre')).toBeNull();
  });

  it('im verbuendeten Kontingent erscheinen Spielsystem- und Bibliothekseintrag weiterhin', () => {
    renderAdder({
      capabilities: capabilitiesOfDataset(),
      forcePath: ALLIED_FORCE_PATH,
      forceCatalogueId: ALLIED_CATALOGUE_ID,
    });
    openDialog();

    expect(screen.getByText('Grand Banner')).toBeTruthy();
    expect(screen.getByText('Mercenary Captain')).toBeTruthy();
  });

  it('die Kandidatenliste des verbuendeten Kontingents enthaelt genau dessen erlaubte Einheiten', () => {
    renderAdder({
      capabilities: capabilitiesOfDataset(),
      forcePath: ALLIED_FORCE_PATH,
      forceCatalogueId: ALLIED_CATALOGUE_ID,
    });
    openDialog();

    expect(offeredNames()).toEqual(['Gorger', 'Grand Banner', 'Mercenary Captain'].sort());
  });

  it('im Primaer-Kontingent bleibt alles wie bisher', () => {
    renderAdder({
      capabilities: capabilitiesOfDataset(),
      forcePath: PRIMARY_FORCE_PATH,
      forceCatalogueId: PRIMARY_CATALOGUE_ID,
    });
    openDialog();

    expect(offeredNames()).toEqual(
      ['Grand Banner', 'Hired Ogre', 'Mercenary Captain', 'Vampire'].sort(),
    );
  });
});

describe('CategoryUnitAdder: ohne eigenen Katalog gilt der der Liste (Issue 0121, Task 19)', () => {
  // Beide Faelle pinnen dieselbe Regel wie zuvor — nur an der Beobachtung, die
  // seit Issue 0140 noch zur Verfuegung steht.
  //
  // **Was sich umgekehrt hat:** Frueher belegte diese Zusage, dass der Dialog im
  // verbuendeten Kontingent die Einheit des PRIMAER-Armeebuchs („Vampire")
  // *zeigt*, sobald der Rueckfall greift. Diese Voraussetzung ist entfallen:
  // Issue 0140 hat den Herkunftsfilter je Kontingent in die **Engine** verlegt —
  // die App reicht ihr das Armeebuch des Kontingents durch
  // (`force.catalogueId`), und ein Kontingent, das dem verbuendeten Buch
  // gehoert, bekommt die Einheiten des Primaer-Buchs gar nicht mehr als
  // Angebots-Anker. „Vampire" steht dem Dialog hier also nicht mehr zur
  // Auswahl, unabhaengig von jeder Prop.
  //
  // **Was Issue 0156 zusaetzlich genommen hat:** „Hired Ogre" — der
  // Wurzel-`entryLink` des PRIMAER-Buchs auf den geteilten Eintrag des
  // verbuendeten — stand hier frueher ebenfalls im Angebot, weil ein
  // Wurzel-`entryLink` von der Herkunftspruefung ausgenommen war. Diese Ausnahme
  // ist ersatzlos entfallen: unter dem verbuendeten Kontingent verankert ein
  // fremdes Armeebuch kein Angebot mehr. Uebrig bleiben der Spielsystem-Eintrag
  // und der Bibliothekseintrag (die Bibliothek liegt per `catalogueLink` in der
  // Huelle beider Buecher).
  //
  // **Was unveraendert gilt:** die Regel selbst — fehlt `forceCatalogueId` oder
  // ist sie `null`, filtert `activeCatalogue.id`. Gepinnt wird sie jetzt
  // negativ: unter dem verbuendeten Kontingent zeigt der Dialog dessen eigene
  // Einheit „Gorger" **nur**, wenn `forceCatalogueId` das verbuendete Buch nennt
  // (der Test „im verbuendeten Kontingent erscheint dessen EIGENE Einheit"
  // oben). Greift der Rueckfall, gilt der Primaer-Katalog der Liste — und
  // „Gorger" verschwindet. Dieselbe Unterscheidung, andere Richtung.
  it('forceCatalogueId null → der aktive Katalog der Liste filtert (Altverhalten)', () => {
    renderAdder({
      capabilities: capabilitiesOfDataset(),
      forcePath: ALLIED_FORCE_PATH,
      forceCatalogueId: null,
    });
    openDialog();

    // Der Rueckfall greift: gefiltert wird nach dem Primaer-Katalog, also faellt
    // die Einheit des verbuendeten Buchs heraus.
    expect(screen.queryByText('Gorger')).toBeNull();
    expect(offeredNames()).toEqual(
      ['Grand Banner', 'Mercenary Captain'].sort(),
    );
  });

  it('fehlende forceCatalogueId-Stuetze → der aktive Katalog der Liste filtert (Altverhalten)', () => {
    renderAdder({
      capabilities: capabilitiesOfDataset(),
      forcePath: ALLIED_FORCE_PATH,
    });
    openDialog();

    expect(screen.queryByText('Gorger')).toBeNull();
    expect(offeredNames()).toEqual(
      ['Grand Banner', 'Mercenary Captain'].sort(),
    );
  });
});
