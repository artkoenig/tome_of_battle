/**
 * Der Auffüll-Vorschlag preist ein **Angebot** mit dem Aushebepreis, nicht mit
 * den bloßen Eigenkosten des Eintrags — dieselbe Rechnung wie der
 * Aushebe-Dialog (Issue 0152).
 *
 * Ein Regiment, dessen Punkte an seinen Pflicht-Modellen hängen, trägt am
 * Angebots-Anker `costs` 0. Das Panel verwarf es deshalb als „kostet nichts"
 * (`cost <= 0`) — obwohl das Anwenden genau diese Modelle mit anlegt und die
 * Restpunkte damit füllte.
 *
 * Ein **belegter** Slot bleibt davon unberührt: dort wächst nur die Anzahl, und
 * der Preis ist der einer weiteren Instanz. Beide Fälle stehen hier
 * nebeneinander.
 *
 * Seam wie in `AutoFillSuggestions.evaluator.test.jsx`: synthetischer Datensatz
 * durch die ECHTE Fassade (`prepareDataset`/`evaluate` über
 * `toEvaluatorRoster`), Vorbedingungen je Fall als Guard gegen den Bericht.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import AutoFillSuggestions from './AutoFillSuggestions';
import { createSubSelectionOperationsMock } from '../../test-utils/subSelectionOperationsMock';
import { processImportedData } from '../../parser/xmlParser.js';
import { prepareDataset, evaluate } from '../../evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../evaluation/rosterAdapter.js';

const GAME_SYSTEM_ID = 'gs-raise';
const FORCE_DEF_ID = 'force-raise';
const CATEGORY_ID = 'cat-troops';
const PTS = 'cost-pts';
const FORCE_PATH = '0';

/** 0 Punkte am Eintrag, 5 Pflicht-Modelle à 8 → Aushebepreis 40. */
const SKELETONS_ID = 'entry-skeletons';
const SKELETON_MODEL_ID = 'entry-skeleton-model';
/** 0 Punkte am Eintrag, 10 Pflicht-Modelle à 8 → 80, zu teuer für die Lücke. */
const HORDE_ID = 'entry-horde';
const HORDE_MODEL_ID = 'entry-horde-model';
/** 45 Punkte am Eintrag, keine Pflicht-Unterauswahl. */
const KNIGHT_ID = 'entry-knight';
/** Belegt, Höchstmaß 3, 20 Punkte je Stück. */
const SPEAR_ID = 'entry-spear';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
<gameSystem id="${GAME_SYSTEM_ID}" name="Raise System">
  <costTypes><costType id="${PTS}" name="Pkt" defaultCostLimit="-1"/></costTypes>
  <categoryEntries><categoryEntry id="${CATEGORY_ID}" name="Truppen"/></categoryEntries>
</gameSystem>`;

/** Ein Regiment: kostenloser Eintrag, kostenpflichtige Pflicht-Modelle. */
const regimentXml = (id, name, modelId, modelCount) => `
      <selectionEntry id="${id}" name="${name}" type="unit">
        <categoryLinks><categoryLink id="cl-${id}" name="Truppen" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
        <selectionEntries>
          <selectionEntry id="${modelId}" name="${name} Modell" type="model">
            <constraints>
              <constraint type="min" value="${modelCount}" field="selections" scope="parent" shared="true" id="limit-${modelId}-min" includeChildSelections="false"/>
            </constraints>
            <costs><cost name="Pkt" typeId="${PTS}" value="8"/></costs>
          </selectionEntry>
        </selectionEntries>
      </selectionEntry>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="cat-raise" name="Raise Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
  <forceEntries>
    <forceEntry id="${FORCE_DEF_ID}" name="Raise Force">
      <categoryLinks><categoryLink id="fcl-troops" name="Truppen" targetId="${CATEGORY_ID}" primary="false"/></categoryLinks>
    </forceEntry>
  </forceEntries>
  <selectionEntries>
    ${regimentXml(SKELETONS_ID, 'Skelette', SKELETON_MODEL_ID, 5)}
    ${regimentXml(HORDE_ID, 'Horde', HORDE_MODEL_ID, 10)}
      <selectionEntry id="${KNIGHT_ID}" name="Ritter" type="unit">
        <categoryLinks><categoryLink id="cl-knight" name="Truppen" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
        <costs><cost name="Pkt" typeId="${PTS}" value="45"/></costs>
      </selectionEntry>
      <selectionEntry id="${SPEAR_ID}" name="Speertraeger" type="unit">
        <constraints>
          <constraint type="max" value="3" field="selections" scope="force" shared="true" id="limit-spear-max" includeChildSelections="false"/>
        </constraints>
        <categoryLinks><categoryLink id="cl-spear" name="Truppen" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
        <costs><cost name="Pkt" typeId="${PTS}" value="20"/></costs>
      </selectionEntry>
  </selectionEntries>
</catalogue>`;

/**
 * Das App-System, wie es die Anwendung führt: die **geparsten** Kataloge (der
 * Preis eines Angebots liest die Definitionen daraus) neben den rohen XMLs.
 */
let parsedSystem = null;
const appSystem = () => {
  if (parsedSystem === null) {
    ({ system: parsedSystem } = processImportedData(
      [{ name: 'raise.gst', content: GAME_SYSTEM_XML }],
      [{ name: 'raise.cat', content: CATALOGUE_XML }],
    ));
    parsedSystem = {
      ...parsedSystem,
      rawXmls: {
        gst: [{ name: 'raise.gst', content: GAME_SYSTEM_XML }],
        cat: [{ name: 'raise.cat', content: CATALOGUE_XML }],
      },
    };
  }
  return parsedSystem;
};

/** App-Roster: ein Speerträger steht schon (Restspielraum 2). */
const appRoster = () => ({
  id: 'roster-uuid',
  name: 'Raise Roster',
  systemId: 'system-uuid',
  catalogueId: 'cat-raise',
  costLimit: 100,
  costLimitType: PTS,
  forces: [{
    id: 'force-uuid-1',
    forceEntryId: FORCE_DEF_ID,
    catalogueId: 'cat-raise',
    selections: [
      { id: 'sel-spear', name: 'Speertraeger', entryLinkId: null, selectionEntryId: SPEAR_ID, number: 1, category: null, selections: [] },
    ],
  }],
});

/** Auswertung über die ECHTE Fassade — die einzige Quelle der Erwartungen. */
function evaluation() {
  const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] });
  const { evalRoster, pathBySelectionId } = toEvaluatorRoster(appRoster());
  const report = evaluate(prepared, evalRoster);
  return { capabilities: report.capabilities, pathBySelectionId };
}

/** Die Capability eines Slots unter dem Kontingent, per Definitions-Id. */
function capabilityOf(capabilities, defId) {
  for (const [path, capability] of capabilities) {
    if (path.startsWith(`${FORCE_PATH}/`) && capability.defId === defId) return capability;
  }
  return undefined;
}

/** Rendert das Panel mit 45 Restpunkten (in der Auffüll-Spanne). */
function renderPanel(remainingPoints = 45) {
  const { capabilities, pathBySelectionId } = evaluation();
  const view = render(
    <AutoFillSuggestions
      capabilities={capabilities}
      forcePath={FORCE_PATH}
      remainingPoints={remainingPoints}
      costLimitTypeId={PTS}
      costTypeLabel="Pkt"
      subSelectionOperations={createSubSelectionOperationsMock()}
      pathBySelectionId={pathBySelectionId}
      addUnit={vi.fn()}
      system={appSystem()}
      activeCatalogue={{ id: 'cat-raise' }}
      roster={appRoster()}
    />
  );
  return { ...view, capabilities };
}

/** Die Zeile eines Vorschlags samt ihrem Preistext. */
function rowTextOf(container, name) {
  const row = [...container.querySelectorAll('.autofill-upgrade-row')]
    .find(node => node.textContent.includes(name));
  return row?.textContent ?? null;
}

describe('AutoFillSuggestions: ein Angebot wird mit seinem Aushebepreis gewogen (Issue 0152)', () => {
  it('schlägt ein Regiment vor, dessen Punkte an seinen Pflicht-Modellen hängen (+40)', () => {
    const { container, capabilities } = renderPanel();
    // Guard: der Eintrag selbst kostet nichts — vorher fiel er als „kostet
    // nichts" aus den Vorschlägen.
    expect(capabilityOf(capabilities, SKELETONS_ID)).toMatchObject({ anchorKind: 'offerAnchor' });
    expect(capabilityOf(capabilities, SKELETONS_ID).costs?.[PTS] ?? 0).toBe(0);

    expect(rowTextOf(container, 'Skelette')).toMatch(/\+40\s?Pkt/);
  });

  it('ein Regiment über der Restsumme bleibt draußen — der Aushebepreis entscheidet', () => {
    const { container, capabilities } = renderPanel();
    expect(capabilityOf(capabilities, HORDE_ID).costs?.[PTS] ?? 0).toBe(0);

    // 10 Modelle à 8 = 80 > 45 Restpunkte.
    expect(rowTextOf(container, 'Horde')).toBeNull();
  });

  it('KONTROLLE: ein Angebot ohne Pflicht-Unterauswahl behält seine Eigenkosten (+45)', () => {
    const { container, capabilities } = renderPanel();
    expect(capabilityOf(capabilities, KNIGHT_ID).costs?.[PTS]).toBe(45);

    expect(rowTextOf(container, 'Ritter')).toMatch(/\+45\s?Pkt/);
  });

  it('KONTROLLE: ein belegter Slot wird mit den Kosten einer weiteren Instanz gewogen (+20)', () => {
    const { container, capabilities } = renderPanel();
    expect(capabilityOf(capabilities, SPEAR_ID)).toMatchObject({ anchorKind: 'occupied', headroom: 2 });

    expect(rowTextOf(container, 'Speertraeger')).toMatch(/\+20\s?Pkt/);
  });

  it('sortiert nach dem Aushebepreis: Ritter 45 vor Skelette 40 vor Speertraeger 20', () => {
    const { container } = renderPanel();
    const names = [...container.querySelectorAll('.autofill-upgrade-row .text-strong')]
      .map(node => node.textContent);
    expect(names).toEqual(['Ritter', 'Skelette', 'Speertraeger']);
  });
});
