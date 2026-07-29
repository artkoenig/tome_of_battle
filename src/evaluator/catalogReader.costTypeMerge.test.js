/**
 * Issue 0102, Punkt 8: `costTypes` wandern in die Zusammenfuehrung, und der
 * Resolver registriert jede DEKLARIERTE Kostenart als Modifier-Ziel.
 *
 * Vertrag (Issue-Plan, 2026-07-29): `mergeCatalogues` fuehrt `costTypes` der
 * Dokumente zusammen. Ein Modifier, dessen `field` die Id einer deklarierten,
 * aber nirgends bepreisten Kostenart ist, erzeugt beim Aufloesen
 * (`resolveCatalogue`, auch auf dem Merge-Ergebnis) kein
 * `DANGLING_MODIFIER_TARGET` mehr — bisher wurden Kostenart-Ziele nur aus
 * `<cost>`-Vorkommen aufgeloest.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { parseCatalogue } from './catalogReader.js';
import { mergeCatalogues } from './catalogSet.js';
import { resolveCatalogue } from './resolver.js';
import { DiagnosticKind, ModifierTargetKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const ENTRY_ID = 'entry-warrior';
// UUID-Form (die reale " Dispel Dice"-Kostenart, bsdata-Doku §5.3): nur ein
// ID-foermiger `field`-Verweis laeuft heute in den DANGLING-Pfad des Resolvers.
const DECLARED_COST_TYPE_ID = '6001-b2bf-4529-c07d';
const DANGLING_ID = 'dead-beef-dead-beef';

describe('mergeCatalogues: costTypes werden dokumentweise zusammengefuehrt', () => {
  it('konkateniert die Deklarationen in der uebergebenen Reihenfolge', () => {
    const merged = mergeCatalogues([
      { costTypes: [{ id: 'gst-cost', name: 'pts' }] },
      { costTypes: [{ id: 'cat-cost', name: 'dice' }] },
    ]);

    expect(merged.costTypes).toEqual([
      { id: 'gst-cost', name: 'pts' },
      { id: 'cat-cost', name: 'dice' },
    ]);
  });

  it('fuellt ein Dokument ohne costTypes mit einer leeren Liste', () => {
    expect(mergeCatalogues([{}]).costTypes).toEqual([]);
  });
});

describe('Resolver: Modifier auf eine deklarierte, aber nirgends bepreiste Kostenart', () => {
  /** Ein Eintrag, dessen einziger Modifikator auf `field` zielt — ohne <cost>-Vorkommen. */
  function entriesXml(field) {
    return `<selectionEntries>
        <selectionEntry id="${ENTRY_ID}" name="Warrior" type="unit">
          <modifiers>
            <modifier type="set" field="${field}" value="1"/>
          </modifiers>
        </selectionEntry>
      </selectionEntries>`;
  }

  it('loest das Ziel im Ein-Dokument-Fall zu COST auf, ohne DANGLING_MODIFIER_TARGET', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-declared" name="Declared Cost Catalogue">
        <costTypes>
          <costType id="${DECLARED_COST_TYPE_ID}" name=" Dispel Dice"/>
        </costTypes>
        ${entriesXml(DECLARED_COST_TYPE_ID)}
      </catalogue>`;
    const resolved = resolveCatalogue(parseCatalogue(xml));

    expect(resolved.diagnostics).not.toContainEqual(
      expect.objectContaining({ kind: DiagnosticKind.DANGLING_MODIFIER_TARGET }),
    );
    expect(resolved.lookup(ENTRY_ID).modifiers[0].target).toEqual({
      kind: ModifierTargetKind.COST,
      id: DECLARED_COST_TYPE_ID,
    });
  });

  it('loest das Ziel auch ueber die Dokumentgrenze auf: Deklaration im Spielsystem, Modifier im Katalog', () => {
    const gameSystem = `<?xml version="1.0" encoding="utf-8"?>
      <gameSystem id="gs-costs" name="Cost Game System">
        <costTypes>
          <costType id="${DECLARED_COST_TYPE_ID}" name=" Dispel Dice"/>
        </costTypes>
      </gameSystem>`;
    const catalogue = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-costs" name="Cost Catalogue" gameSystemId="gs-costs">
        ${entriesXml(DECLARED_COST_TYPE_ID)}
      </catalogue>`;
    const resolved = resolveCatalogue(
      mergeCatalogues([parseCatalogue(gameSystem), parseCatalogue(catalogue)]),
    );

    expect(resolved.diagnostics).not.toContainEqual(
      expect.objectContaining({ kind: DiagnosticKind.DANGLING_MODIFIER_TARGET }),
    );
    expect(resolved.lookup(ENTRY_ID).modifiers[0].target).toEqual({
      kind: ModifierTargetKind.COST,
      id: DECLARED_COST_TYPE_ID,
    });
  });

  it('KONTROLLE: ein wirklich baumelnder ID-Verweis bleibt eine DANGLING-Diagnose', () => {
    const xml = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-dangling" name="Dangling Catalogue">
        <costTypes>
          <costType id="${DECLARED_COST_TYPE_ID}" name=" Dispel Dice"/>
        </costTypes>
        ${entriesXml(DANGLING_ID)}
      </catalogue>`;
    const resolved = resolveCatalogue(parseCatalogue(xml));

    expect(resolved.lookup(ENTRY_ID).modifiers[0].target).toBeNull();
    expect(resolved.diagnostics).toContainEqual(
      expect.objectContaining({ kind: DiagnosticKind.DANGLING_MODIFIER_TARGET, field: DANGLING_ID }),
    );
  });
});
