/**
 * Tests der globalen `id → TargetDescriptor`-Symboltabelle des Resolvers
 * (Slice 01, `design.md` Kontrakt `TargetDescriptor`, Clean-Room-Abgleich Q1).
 *
 * Der Resolver loest den rohen `field` jedes Modifikators **genau einmal** in sein
 * Ziel auf: Schluesselwort (`category`/`hidden`) vor Symboltabelle (Kostenart→COST,
 * Constraint→LIMIT), ein baumelnder ID-Verweis wird zur Diagnose, sonstiger Text
 * zum Hinweis-Ziel (NOTE). Ein Disjunktheits-Guard macht kollidierende ID-Raeume
 * sichtbar.
 */

import { JSDOM } from 'jsdom';
import { describe, it, expect } from 'vitest';
import { parseCatalogue } from '../../../../contexts/ruleengine/engine/catalogReader.js';
import { resolveCatalogue } from '../../../../contexts/ruleengine/engine/resolver.js';
import { ModifierTargetKind, MessageSeverity, DiagnosticKind } from '../../../../contexts/ruleengine/engine/model.js';

const dom = new JSDOM();
globalThis.DOMParser = dom.window.DOMParser;

const ENTRY_ID = 'entry-warrior';
const COST_TYPE_ID = 'cost-points';
const CONSTRAINT_ID = 'max-warriors';
const DANGLING_ID = 'dead-beef-dead-beef'; // UUID-Form, aber nirgends definiert.

/** Baut einen Katalog mit einem Eintrag, dessen einziger Modifikator `field` traegt. */
function catalogueWithModifierField(field) {
  return `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-resolve" name="Resolve Catalogue">
      <selectionEntries>
        <selectionEntry id="${ENTRY_ID}" name="Warrior" type="unit">
          <costs>
            <cost name="Points" typeId="${COST_TYPE_ID}" value="10"/>
          </costs>
          <constraints>
            <constraint id="${CONSTRAINT_ID}" type="max" value="2" field="selections" scope="roster"/>
          </constraints>
          <modifiers>
            <modifier type="set" field="${field}" value="1"/>
          </modifiers>
        </selectionEntry>
      </selectionEntries>
    </catalogue>`;
}

/** Loest den Katalog auf und liefert das Ziel des einzigen Modifikators und die Diagnosen. */
function resolveSingleModifierTarget(field) {
  const resolved = resolveCatalogue(parseCatalogue(catalogueWithModifierField(field)));
  const target = resolved.lookup(ENTRY_ID).modifiers[0].target;
  return { target, diagnostics: resolved.diagnostics };
}

describe('Resolver: field→TargetDescriptor ueber die Symboltabelle', () => {
  it('loest eine Kostenart-ID zu COST auf', () => {
    const { target } = resolveSingleModifierTarget(COST_TYPE_ID);
    expect(target).toEqual({ kind: ModifierTargetKind.COST, id: COST_TYPE_ID });
  });

  it('loest eine Constraint-ID zu LIMIT auf', () => {
    const { target } = resolveSingleModifierTarget(CONSTRAINT_ID);
    expect(target).toEqual({ kind: ModifierTargetKind.LIMIT, id: CONSTRAINT_ID });
  });

  it('loest das Schluesselwort "category" zu CATEGORY (ID im value) auf', () => {
    const { target } = resolveSingleModifierTarget('category');
    expect(target).toEqual({ kind: ModifierTargetKind.CATEGORY, id: null });
  });

  it('loest das Schluesselwort "hidden" zu HIDDEN auf', () => {
    const { target } = resolveSingleModifierTarget('hidden');
    expect(target).toEqual({ kind: ModifierTargetKind.HIDDEN, id: null });
  });

  it('loest das Schluesselwort "name" zu NAME auf', () => {
    const { target } = resolveSingleModifierTarget('name');
    expect(target).toEqual({ kind: ModifierTargetKind.NAME, id: null });
  });

  it('loest "error"/"warning"/"info" zu MESSAGE mit ihrem Schweregrad auf', () => {
    for (const severity of Object.values(MessageSeverity)) {
      const { target } = resolveSingleModifierTarget(severity);
      expect(target).toEqual({ kind: ModifierTargetKind.MESSAGE, id: severity });
    }
  });

  it('meldet sonstigen Nicht-ID-Text als nicht deutbares Ziel und traegt kein Ziel', () => {
    const { target, diagnostics } = resolveSingleModifierTarget('notes');

    expect(target).toBeNull();
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ kind: DiagnosticKind.UNSUPPORTED_MODIFIER_TARGET, field: 'notes' }),
    );
  });

  it('meldet einen baumelnden ID-Verweis als Diagnose und traegt kein Ziel', () => {
    const { target, diagnostics } = resolveSingleModifierTarget(DANGLING_ID);
    expect(target).toBeNull();
    expect(diagnostics).toContainEqual(
      expect.objectContaining({ kind: DiagnosticKind.DANGLING_MODIFIER_TARGET, field: DANGLING_ID })
    );
  });
});

describe('Resolver: Disjunktheits-Guard der Symboltabelle', () => {
  it('meldet eine Kollision, wenn dieselbe ID Kostenart und Constraint benennt', () => {
    const SHARED_ID = 'ambiguous-id';
    const catalogue = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-collide" name="Collision Catalogue">
        <selectionEntries>
          <selectionEntry id="${ENTRY_ID}" name="Warrior" type="unit">
            <costs>
              <cost name="Points" typeId="${SHARED_ID}" value="10"/>
            </costs>
            <constraints>
              <constraint id="${SHARED_ID}" type="max" value="2" field="selections" scope="roster"/>
            </constraints>
          </selectionEntry>
        </selectionEntries>
      </catalogue>`;
    const resolved = resolveCatalogue(parseCatalogue(catalogue));

    expect(resolved.diagnostics).toContainEqual(
      expect.objectContaining({ kind: DiagnosticKind.MODIFIER_TARGET_COLLISION, targetId: SHARED_ID })
    );
  });
});

describe('Resolver: Disjunktheits-Guard bei kollidierender Definitions-ID', () => {
  // ADR-0032-Sicherheitsnetz: global-by-ID setzt kataloguebergreifend disjunkte
  // GUIDs voraus. Traegt nach dem Zusammenfuehren doch eine ID zwei Definitionen,
  // wird die Kollision als Diagnose sichtbar statt eine Definition still zu
  // verschlucken. Ein Ein-Katalog mit doppelter ID reizt denselben Guard isoliert.
  it('meldet DUPLICATE_DEFINITION, wenn zwei Definitionen dieselbe ID tragen', () => {
    const DUPLICATE_ID = 'kollidierende-definitions-id';
    const catalogue = `<?xml version="1.0" encoding="utf-8"?>
      <catalogue id="cat-duplicate" name="Duplicate Catalogue">
        <selectionEntries>
          <selectionEntry id="${DUPLICATE_ID}" name="Warrior" type="unit"/>
          <selectionEntry id="${DUPLICATE_ID}" name="Warlord" type="unit"/>
        </selectionEntries>
      </catalogue>`;
    const resolved = resolveCatalogue(parseCatalogue(catalogue));

    expect(resolved.diagnostics).toContainEqual(
      expect.objectContaining({ kind: DiagnosticKind.DUPLICATE_DEFINITION, definitionId: DUPLICATE_ID })
    );
  });
});

describe('Kandidatenmenge des Angebots auf Armee-Ebene', () => {
  const ROOT_ENTRY_ID = 'entry-root';
  const ROOT_LINK_ID = 'link-root';
  const ROOT_GROUP_ID = 'group-root';
  const SHARED_ENTRY_ID = 'shared-entry';
  const NESTED_ENTRY_ID = 'entry-nested';
  const CATEGORY_ID = 'cat-core';

  const CATALOGUE_XML = `<?xml version="1.0" encoding="utf-8"?>
    <catalogue id="cat-candidates" name="Candidates Catalogue">
      <categoryEntries>
        <categoryEntry id="${CATEGORY_ID}" name="Core"/>
      </categoryEntries>
      <sharedSelectionEntries>
        <selectionEntry id="${SHARED_ENTRY_ID}" name="Shared" type="unit"/>
      </sharedSelectionEntries>
      <selectionEntries>
        <selectionEntry id="${ROOT_ENTRY_ID}" name="Root Entry" type="unit">
          <selectionEntries>
            <selectionEntry id="${NESTED_ENTRY_ID}" name="Nested" type="upgrade"/>
          </selectionEntries>
        </selectionEntry>
      </selectionEntries>
      <selectionEntryGroups>
        <selectionEntryGroup id="${ROOT_GROUP_ID}" name="Root Group"/>
      </selectionEntryGroups>
      <entryLinks>
        <entryLink id="${ROOT_LINK_ID}" name="Root Link" targetId="${SHARED_ENTRY_ID}" type="selectionEntry"/>
      </entryLinks>
      <categoryLinks>
        <categoryLink id="link-root-category" name="Core" targetId="${CATEGORY_ID}"/>
      </categoryLinks>
    </catalogue>`;

  /** Die Definitions-IDs der Kandidatenmenge, in Dokumentreihenfolge. */
  function candidateIds() {
    return resolveCatalogue(parseCatalogue(CATALOGUE_XML)).armyLevelCandidates.map(definition => definition.id);
  }

  it('fuehrt die Auswahl-Definitionen unmittelbar unter der Katalogwurzel — Eintrag wie Verweis', () => {
    expect(candidateIds()).toEqual([ROOT_ENTRY_ID, ROOT_LINK_ID]);
  });

  it('fuehrt weder Wurzel-Gruppen noch Wurzel-Kategorieverweise: beide sind kein Auswahlpunkt', () => {
    expect(candidateIds()).not.toContain(ROOT_GROUP_ID);
    expect(candidateIds()).not.toContain(CATEGORY_ID);
  });

  it('fuehrt eine geteilte Definition nicht: sie erscheint allein an der Stelle ihres Verweises', () => {
    expect(candidateIds()).not.toContain(SHARED_ENTRY_ID);
  });

  it('fuehrt keine geschachtelte Option: sie gehoert ihrer Auswahl, nicht der Armee-Ebene', () => {
    expect(candidateIds()).not.toContain(NESTED_ENTRY_ID);
  });
});
