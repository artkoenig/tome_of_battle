/**
 * Issue 0085, increment 1, criterion 6 — `AutoFillSuggestions` reads the RAISE
 * cost of a candidate instead of its own cost, for the same offers the raise
 * dialog reads it for. Test-first: `capability.raiseCosts` does not exist yet.
 *
 * Seam: the synthetic seam of `AutoFillSuggestions.evaluator.test.jsx` — an
 * inline `GAME_SYSTEM_XML`/`CATALOGUE_XML`, driven through the real facade,
 * `lucide-react` NOT stubbed (icon choice is the component's own business).
 * The panel only renders inside its window (`0 < remainingPoints <= 50`,
 * Issue 0151), so the fixture is sized to fit it.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { AutoFillSuggestionsHarness as AutoFillSuggestions } from '../../../../shared/test-utils/harnesses/AutoFillSuggestionsHarness';
import { createSubSelectionOperationsMock } from '../../../../shared/test-utils/subSelectionOperationsMock';
import { prepareDataset, evaluate } from '../../../../domain/evaluator/evaluator.js';
import { toEvaluatorRoster } from '../../../../domain/evaluation/rosterAdapter.js';

const GAME_SYSTEM_ID = 'gs-main';
const FORCE_DEF_ID = 'force-main';
const PTS = 'cost-pts';
const CAT_TROOPS = 'cat-troops';
const FORCE_PATH = '0';

const SWARM_ID = 'entry-swarm';
const SWARM_MODEL_ID = 'entry-swarm-model';
const BANNER_ID = 'entry-banner';

const SWARM_MODEL_MIN = 3;
const SWARM_MODEL_POINTS = 10;
const SWARM_RAISE_POINTS = SWARM_MODEL_MIN * SWARM_MODEL_POINTS; // 30
const BANNER_POINTS = 15;

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
<gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
  <costTypes><costType id="${PTS}" name="Pkt" defaultCostLimit="-1"/></costTypes>
  <categoryEntries><categoryEntry id="${CAT_TROOPS}" name="Truppen"/></categoryEntries>
</gameSystem>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="cat-main" name="Main Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
  <forceEntries>
    <forceEntry id="${FORCE_DEF_ID}" name="Main Force">
      <categoryLinks><categoryLink id="fcl-troops" name="Truppen" targetId="${CAT_TROOPS}" primary="false"/></categoryLinks>
    </forceEntry>
  </forceEntries>
  <selectionEntries>
    <selectionEntry id="${SWARM_ID}" name="Swarm" type="unit">
      <categoryLinks><categoryLink id="cl-swarm" name="Truppen" targetId="${CAT_TROOPS}" primary="true"/></categoryLinks>
      <selectionEntries>
        <selectionEntry id="${SWARM_MODEL_ID}" name="Swarm Model" type="model">
          <constraints>
            <constraint id="limit-swarm-min" type="min" value="${SWARM_MODEL_MIN}" field="selections" scope="parent"/>
          </constraints>
          <costs><cost name="Pkt" typeId="${PTS}" value="${SWARM_MODEL_POINTS}"/></costs>
        </selectionEntry>
      </selectionEntries>
    </selectionEntry>
    <selectionEntry id="${BANNER_ID}" name="Banner" type="unit">
      <categoryLinks><categoryLink id="cl-banner" name="Truppen" targetId="${CAT_TROOPS}" primary="true"/></categoryLinks>
      <costs><cost name="Pkt" typeId="${PTS}" value="${BANNER_POINTS}"/></costs>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

/** App-System-Objekt mit den rohen XMLs (Shape aus `src/data/db/systemImport.js`). */
function appSystem() {
  return {
    id: 'system-uuid',
    name: 'Test System',
    rawXmls: {
      gst: [{ name: 'test.gst', content: GAME_SYSTEM_XML }],
      cat: [{ name: 'main.cat', content: CATALOGUE_XML }],
    },
  };
}

/** App-Roster: ein leeres Kontingent — beide Kandidaten sind reine Angebote. */
function appRoster() {
  return {
    id: 'roster-uuid',
    name: 'Test Roster',
    systemId: 'system-uuid',
    catalogueId: 'cat-main',
    costLimit: 1000,
    costLimitType: PTS,
    forces: [{ id: 'force-uuid-1', forceEntryId: FORCE_DEF_ID, catalogueId: 'cat-main', selections: [] }],
  };
}

/** Auswertung ueber die ECHTE Fassade — die einzige Quelle der Erwartungen. */
let cachedEvaluation = null;
function evaluation() {
  if (cachedEvaluation === null) {
    const prepared = prepareDataset({ gameSystem: GAME_SYSTEM_XML, catalogues: [CATALOGUE_XML] });
    const { evalRoster, pathBySelectionId } = toEvaluatorRoster(appRoster());
    const report = evaluate(prepared, evalRoster);
    cachedEvaluation = { capabilities: report.capabilities, pathBySelectionId };
  }
  return cachedEvaluation;
}

/** Capability eines Slots dieses Kontingents per Definitions-Id. */
function capabilityOf(capabilities, defId) {
  for (const capability of capabilities.values()) {
    if (capability.defId === defId) return capability;
  }
  return undefined;
}

// ── Observablen-Helfer (rebuilt per file, Konvention siehe *.evaluator.test.jsx) ──

/** Das tiefste Element unter `root`, dessen Text `text` enthaelt (oder null). */
function deepestWith(root, text) {
  const matches = [...root.querySelectorAll('*')].filter(el => el.textContent.includes(text));
  return matches.length > 0 ? matches[matches.length - 1] : null;
}

/** False, wenn das Element (oder ein Vorfahr) eingeklappt/ausgeblendet ist. */
function isRevealed(element) {
  for (let node = element; node && node.nodeType === 1; node = node.parentElement) {
    if (node.hasAttribute('hidden')) return false;
    if (node.getAttribute('aria-hidden') === 'true') return false;
    if (node.tagName === 'DETAILS' && !node.open) return false;
    if (node.style && node.style.display === 'none') return false;
  }
  return true;
}

/** True, wenn `name` im Panel sichtbar steht. */
function isShown(container, name) {
  const element = deepestWith(container, name);
  return element !== null && isRevealed(element);
}

function renderPanel(remainingPoints) {
  const { capabilities, pathBySelectionId } = evaluation();
  const addUnit = vi.fn();
  const subSelectionOperations = createSubSelectionOperationsMock();
  const view = render(
    <AutoFillSuggestions
      capabilities={capabilities}
      pathBySelectionId={pathBySelectionId}
      forcePath={FORCE_PATH}
      remainingPoints={remainingPoints}
      costLimitTypeId={PTS}
      costTypeLabel="Pkt"
      system={appSystem()}
      activeCatalogue={{ id: 'cat-main' }}
      addUnit={addUnit}
      subSelectionOperations={subSelectionOperations}
    />
  );
  return { ...view, addUnit, subSelectionOperations };
}

describe('AutoFillSuggestions: die Restpunkt-Vorschlaege lesen den Aushebe-Preis statt des Eigenpreises (Issue 0085)', () => {
  it('kriterium 6: Swarm erscheint mit 30 Punkten, obwohl sein Eigenpreis 0 ist (heute faellt er ueber die cost <= 0-Schranke heraus)', () => {
    const { capabilities } = evaluation();
    // Guard gegen den echten Bericht: Swarm traegt keine eigenen Kosten, sein
    // Aushebe-Preis liegt bei 30.
    expect(capabilityOf(capabilities, SWARM_ID).costs?.[PTS] ?? 0).toBe(0);
    expect(capabilityOf(capabilities, SWARM_ID).raiseCosts?.[PTS]).toBe(SWARM_RAISE_POINTS);

    const { container } = renderPanel(40);

    expect(isShown(container, 'Swarm')).toBe(true);
    expect(container.textContent).toMatch(/30/);
  });

  it('kriterium 6: bei 20 Restpunkten faellt Swarm (Aushebe-Preis 30) aus dem Fenster, waehrend Banner (15) bleibt', () => {
    const { capabilities } = evaluation();
    expect(capabilityOf(capabilities, SWARM_ID).raiseCosts?.[PTS]).toBe(SWARM_RAISE_POINTS);
    expect(capabilityOf(capabilities, BANNER_ID).raiseCosts?.[PTS]).toBe(BANNER_POINTS);

    const { container } = renderPanel(20);

    expect(isShown(container, 'Swarm')).toBe(false);
    expect(isShown(container, 'Banner')).toBe(true);
  });
});
