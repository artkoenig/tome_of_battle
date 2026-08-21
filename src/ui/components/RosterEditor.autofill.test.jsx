/**
 * Issue 0135, Befund 1 — die Kriterien 1, 2 und 3 auf **App-Ebene**: nicht nur
 * „was macht das Panel mit einer hereingereichten Zahl", sondern „entsteht die
 * Lücke aus der echten Rechnung und kommt sie am Panel an".
 *
 * Issue 0151 hat die Spanne umgedreht: das Panel gehört an den Schluss der
 * Listenbauerei und erscheint deshalb nur auf den **letzten 50 Punkten**
 * (Lücke 1…50). Die Fälle unten sind dieselben drei Kriterien an den neuen
 * Kanten.
 *
 * Die Lücke ist `roster.costLimit` minus der Summe der Limit-Kostenart aus dem
 * **Bericht** (`costTotals[roster.costLimitType]`), und sie ist `null`, wenn
 * keine Limit-Kostenart gesetzt ist oder der Punktwert 0 ist. Gerechnet wird
 * das in `RosterEditor`, durchgereicht über `ForceEditorSection` an
 * `AutoFillSuggestions` — drei Stellen, die einzeln geprüft alle grün bleiben
 * können, während die Kette gerissen ist.
 *
 * ── Falsifizierbarkeits-Entscheidung (markiert) ─────────────────────────────
 * **Nichts auf dem Pfad ist gemockt**: `ForceEditorSection` und
 * `AutoFillSuggestions` sind die echten Komponenten, die Auswertung läuft über
 * `system.rawXmls` durch die echte Fassade, und die Kostensumme kommt aus dem
 * Bericht. Gemockt sind nur Nachbarn ohne Anteil an dieser Frage: die
 * IndexedDB-Anbindung, der Einstellungs-Context, die Regel-Index-Dialoge und
 * die Sidebar. Reißt man die Durchreichung heraus (Prop `remainingPoints` in
 * `ForceEditorSection`), müssen die Fälle „Panel steht da" fehlschlagen.
 *
 * Die Namen „Ritter" und „Spaeher" erscheinen im gerenderten Editor **nur** im
 * Auffüll-Panel (der Aushebe-Dialog rendert seine Kandidaten erst im geöffneten
 * Zustand); „Auffüllen" ist der Titel des Panels. Beides per Wegwerf-Sonde am
 * echten Editor-Rendering geprüft. Auf „Pflichtwache" wird bewusst NICHT
 * geprüft: die offene Pflicht steht — richtigerweise — als Meldung im
 * Lagerbericht, ihr Name ist also kein Marker für das Panel. Der Eintrag bleibt
 * trotzdem im Datensatz: ohne ihn zeigte die Vorgängerfassung des Panels
 * (Vorschläge aus Pflicht-Signalen) gar nichts, und die „kein Panel"-Fälle
 * gingen ins Leere.
 */

import React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import RosterEditor from './RosterEditor';

// Nachbarn ohne Anteil an der Frage — der Pfad Roster → Bericht → Lücke →
// Panel bleibt vollständig echt.
vi.mock('../../data/db/database', () => ({ saveRoster: vi.fn() }));
vi.mock('../viewmodels/SettingsContext', () => ({
  useSettings: () => ({ whfb6LinkingEnabled: false }),
}));
vi.mock('./RulesIndexDialog', () => ({ default: () => null }));
vi.mock('./editor/RosterSidebar', () => ({ default: () => null }));

// ── Synthetischer Datensatz (rawXmls-Muster wie RosterEditor.evaluator.test) ──

const GAME_SYSTEM_ID = 'gs-app';
const PTS = 'cost-pts';
const CATEGORY_ID = 'cat-troops';
const FORCE_DEF_ID = 'force-main';

const GAME_SYSTEM_XML = `<?xml version="1.0" encoding="utf-8"?>
<gameSystem id="${GAME_SYSTEM_ID}" name="Test System">
  <costTypes><costType id="${PTS}" name="Pkt" defaultCostLimit="-1"/></costTypes>
  <categoryEntries><categoryEntry id="${CATEGORY_ID}" name="Truppen"/></categoryEntries>
</gameSystem>`;

const unitXml = (id, name, points, constraints = '') => `
      <selectionEntry id="${id}" name="${name}" type="unit">
        ${constraints}
        <categoryLinks><categoryLink id="cl-${id}" name="Truppen" targetId="${CATEGORY_ID}" primary="true"/></categoryLinks>
        <costs><cost name="Pkt" typeId="${PTS}" value="${points}"/></costs>
      </selectionEntry>`;

const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
<catalogue id="cat-main" name="Main Catalogue" gameSystemId="${GAME_SYSTEM_ID}">
  <forceEntries>
    <forceEntry id="${FORCE_DEF_ID}" name="Main Force">
      <categoryLinks><categoryLink id="fcl-troops" name="Truppen" targetId="${CATEGORY_ID}" primary="false"/></categoryLinks>
    </forceEntry>
  </forceEntries>
  <selectionEntries>
    ${unitXml('entry-guard', 'Wache', 240)}
    ${unitXml('entry-knight', 'Ritter', 100)}
    ${unitXml('entry-scout', 'Spaeher', 45)}
    ${unitXml('entry-duty', 'Pflichtwache', 0,
    '<constraints><constraint type="min" value="1" field="selections" scope="force" shared="true" id="limit-duty-min" includeChildSelections="false"/></constraints>')}
  </selectionEntries>
</catalogue>`;

function appSystem() {
  return {
    id: 'system-uuid',
    name: 'Test System',
    catalogues: [{ id: 'cat-main', name: 'Main Catalogue', isLibrary: false }],
    rawXmls: {
      gst: [{ name: 'test.gst', content: GAME_SYSTEM_XML }],
      cat: [{ name: 'main.cat', content: CATALOGUE_XML }],
    },
  };
}

/**
 * App-Roster mit „Wache" ×1 → der Bericht summiert 240 Pkt. Der eingestellte
 * Punktwert ist der einzige Unterschied zwischen den Fällen; die Lücke rechnet
 * der Editor selbst aus.
 */
function appRoster(costLimit, costLimitType = PTS) {
  return {
    id: 'roster-uuid',
    name: 'Test Roster',
    systemId: 'system-uuid',
    catalogueId: 'cat-main',
    costLimit,
    costLimitType,
    forces: [
      {
        id: 'force-uuid-1',
        forceEntryId: FORCE_DEF_ID,
        catalogueId: 'cat-main',
        selections: [{
          id: 'sel-guard',
          name: 'Wache',
          entryLinkId: null,
          selectionEntryId: 'entry-guard',
          number: 1,
          category: CATEGORY_ID,
          selections: [],
        }],
      },
    ],
  };
}

const renderEditor = (roster) => render(
  <RosterEditor
    system={appSystem()}
    roster={roster}
    onBack={vi.fn()}
    onPlay={vi.fn()}
    onExportRoster={vi.fn()}
    onReportError={vi.fn()}
  />
);

/** Der Titel des Auffüll-Panels — im Editor sonst nirgends. */
const PANEL_TITLE = 'Auffüllen';

describe('Editor: die Auffüll-Lücke entsteht aus der echten Rechnung und kommt am Panel an (Issue 0135, Spanne aus Issue 0151)', () => {
  it('Kriterium 3 an der oberen Kante: Punktwert 290 bei 240 verplanten Punkten → Lücke genau 50 → Panel mit dem Kandidaten, der hineinpasst', () => {
    const { container } = renderEditor(appRoster(290));

    expect(container.textContent).toContain(PANEL_TITLE);
    // Die Lücke ist gerechnet, nicht hereingereicht: 290 − 240 (Bericht).
    expect(container.textContent).toContain('50');
    expect(container.textContent).toContain('Spaeher');
    // 100 Pkt passen nicht mehr in 50 Restpunkte.
    expect(container.textContent).not.toContain('Ritter');
  });

  it('Kriterium 3 an der unteren Kante: Punktwert 285 → Lücke 45 → Panel mit dem Kandidaten, der genau hineinpasst', () => {
    const { container } = renderEditor(appRoster(285));

    expect(container.textContent).toContain(PANEL_TITLE);
    expect(container.textContent).toContain('Spaeher');
    expect(container.textContent).not.toContain('Ritter');
  });

  it('Kriterium 2 an der Schwelle: Punktwert 291 → Lücke 51 → kein Panel im Editor', () => {
    const { container } = renderEditor(appRoster(291));

    expect(container.textContent).not.toContain(PANEL_TITLE);
    expect(container.textContent).not.toContain('Spaeher');
  });

  it('Kriterium 2: Punktwert 540 → Lücke 300 → die Liste ist weit vom Ziel, kein Panel im Editor', () => {
    const { container } = renderEditor(appRoster(540));

    expect(container.textContent).not.toContain(PANEL_TITLE);
    expect(container.textContent).not.toContain('Spaeher');
  });

  it('Kriterium 2: Punktwert 240 → Lücke 0 → kein Panel im Editor', () => {
    const { container } = renderEditor(appRoster(240));

    expect(container.textContent).not.toContain(PANEL_TITLE);
    expect(container.textContent).not.toContain('Spaeher');
  });

  it('Kriterium 1: Punktwert 0 → keine Punktgrenze → kein Panel im Editor', () => {
    const { container } = renderEditor(appRoster(0));

    expect(container.textContent).not.toContain(PANEL_TITLE);
    expect(container.textContent).not.toContain('Spaeher');
  });

  it('Kriterium 1: keine Limit-Kostenart → kein Panel im Editor', () => {
    const { container } = renderEditor(appRoster(540, null));

    expect(container.textContent).not.toContain(PANEL_TITLE);
    expect(container.textContent).not.toContain('Spaeher');
  });
});
