/**
 * Issue 0102, Punkt 9: ein gesetztes `scope`-Attribut an einem `<modifier>`
 * wird diagnostiziert, nicht gedeutet (Decisions: „Punkt 9 = Diagnose, keine
 * Semantik" — die vendored XSD kennt an `Modifier` gar kein `scope`).
 *
 * Vertrag (Issue-Plan, 2026-07-29): ein `<modifier>` mit gesetztem
 * `scope`-Attribut erzeugt die Diagnose
 * `DiagnosticKind.UNSUPPORTED_MODIFIER_SCOPE` (String-Wert
 * `'unsupportedModifierScope'`); der Modifikator selbst wird weiterhin gelesen
 * (wirkt auf den Traeger). Ohne `scope`-Attribut keine Diagnose.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { parseCatalogue } from './catalogReader.js';
import { evaluate as evaluateDataset, prepareDataset } from './evaluator.js';
import { AnchorKind, DiagnosticKind, ModifierKind } from './model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const ENTRY_ID = 'entry-warrior';
const UNSUPPORTED_MODIFIER_SCOPE_KIND = 'unsupportedModifierScope';

/** Ein Katalog mit einem Eintrag, dessen einziger Modifikator die gegebenen Attribute traegt. */
function catalogueWithModifier(modifierAttrs) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-scope" name="Modifier Scope Catalogue">
      <selectionEntries>
        <selectionEntry id="${ENTRY_ID}" name="Warrior" type="unit">
          <modifiers>
            <modifier ${modifierAttrs}/>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

describe('DiagnosticKind.UNSUPPORTED_MODIFIER_SCOPE', () => {
  it('existiert mit dem vereinbarten String-Wert', () => {
    expect(DiagnosticKind.UNSUPPORTED_MODIFIER_SCOPE).toBe(UNSUPPORTED_MODIFIER_SCOPE_KIND);
  });
});

describe('parseCatalogue: Modifier mit scope-Attribut', () => {
  it('meldet ein gesetztes scope-Attribut als Diagnose', () => {
    const catalogue = parseCatalogue(
      catalogueWithModifier('type="set" field="hidden" value="true" scope="unit"'),
    );

    expect(catalogue.diagnostics).toContainEqual(
      expect.objectContaining({ kind: UNSUPPORTED_MODIFIER_SCOPE_KIND }),
    );
  });

  it('liest den Modifikator trotz scope-Attribut weiter (er entfaellt nicht)', () => {
    const catalogue = parseCatalogue(
      catalogueWithModifier('type="set" field="hidden" value="true" scope="unit"'),
    );
    const entry = catalogue.entries.find(def => def.id === ENTRY_ID);

    expect(entry.modifiers).toHaveLength(1);
    expect(entry.modifiers[0]).toMatchObject({
      kind: ModifierKind.SET,
      field: 'hidden',
      value: 'true',
    });
  });

  it('KONTROLLE: ein Modifikator ohne scope-Attribut erzeugt keine solche Diagnose', () => {
    const catalogue = parseCatalogue(
      catalogueWithModifier('type="set" field="hidden" value="true"'),
    );

    expect(
      catalogue.diagnostics.filter(d => d.kind === UNSUPPORTED_MODIFIER_SCOPE_KIND),
    ).toEqual([]);
  });

  it('KONTROLLE: der Modifikator wirkt weiterhin auf den Traeger (Fassade: Eintrag wird versteckt)', () => {
    const report = evaluateDataset(
      prepareDataset({
        catalogues: [catalogueWithModifier('type="set" field="hidden" value="true" scope="unit"')],
      }),
      { forces: [{ defId: ENTRY_ID, count: 1, children: [] }] },
    );
    let capability = null;
    for (const candidate of report.capabilities.values()) {
      if (candidate.defId === ENTRY_ID && candidate.anchorKind === AnchorKind.OCCUPIED) {
        capability = candidate;
      }
    }

    expect(capability).not.toBeNull();
    expect(capability.isHidden).toBe(true);
  });
});
