import { describe, it, expect } from 'vitest';

import {
  extractCells,
  coveredKeysFromManifests,
  diffCells,
  keysFromCoveredRecord,
  exitCodeFor,
} from './evaluator-coverage-cells.js';

// jsdom (`environment: 'jsdom'` in vitest.config.js) provides `DOMParser` as a
// global, the same primitive the engine's own XML reader uses — no setup of
// our own is needed (see scripts/lib/evaluator-measurement.test.js for the
// non-jsdom-global variant this repo also carries).
function parseCatalogue(xml) {
  return new DOMParser().parseFromString(xml, 'application/xml');
}

function source(xml, file) {
  return { doc: parseCatalogue(xml), file };
}

// ── Case 1 ──────────────────────────────────────────────────────────────────
describe('extractCells — constraint field-class x scope x flags', () => {
  it('records a single occurring constraint cell with its key, occurrence count and file', () => {
    const xml = `<?xml version="1.0"?>
<catalogue id="cat-1" name="Case 1">
  <selectionEntries>
    <selectionEntry id="se-1" name="Unit">
      <constraints>
        <constraint id="c-1" type="max" value="3" field="selections" scope="parent"
          shared="true" includeChildSelections="false" includeChildForces="false" percentValue="false"/>
      </constraints>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;
    const file = 'fixtures/case-1.cat';

    const { cells } = extractCells([source(xml, file)]);

    expect(cells).toHaveLength(1);
    expect(cells[0].key).toBe('constraint|max|selectionCount|parent|s=true|ics=false|icf=false|pct=false');
    expect(cells[0].occurrences).toBe(1);
    expect(cells[0].files).toEqual({ [file]: 1 });
  });

  // ── Case 2 ──────────────────────────────────────────────────────────────
  it('normalizes omitted flags to their false default, merging with the explicit-false occurrence', () => {
    const explicit = `<?xml version="1.0"?>
<catalogue id="cat-2a" name="Case 2a">
  <selectionEntries>
    <selectionEntry id="se-1" name="Unit">
      <constraints>
        <constraint id="c-1" type="max" value="3" field="selections" scope="parent"
          shared="true" includeChildSelections="false" includeChildForces="false" percentValue="false"/>
      </constraints>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;
    // Same constraint, but includeChildForces and percentValue are omitted
    // entirely instead of spelled out as "false".
    const omitted = `<?xml version="1.0"?>
<catalogue id="cat-2b" name="Case 2b">
  <selectionEntries>
    <selectionEntry id="se-2" name="Unit">
      <constraints>
        <constraint id="c-2" type="max" value="3" field="selections" scope="parent"
          shared="true" includeChildSelections="false"/>
      </constraints>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;
    const fileA = 'fixtures/case-2a.cat';
    const fileB = 'fixtures/case-2b.cat';

    const { cells } = extractCells([source(explicit, fileA), source(omitted, fileB)]);

    expect(cells).toHaveLength(1);
    expect(cells[0].key).toBe('constraint|max|selectionCount|parent|s=true|ics=false|icf=false|pct=false');
    expect(cells[0].occurrences).toBe(2);
    expect(cells[0].files).toEqual({ [fileA]: 1, [fileB]: 1 });
  });

  // ── Case 3 ──────────────────────────────────────────────────────────────
  it('does not collapse an explicit shared="false" into shared="true"', () => {
    const xml = `<?xml version="1.0"?>
<catalogue id="cat-3" name="Case 3">
  <selectionEntries>
    <selectionEntry id="se-1" name="Unit">
      <constraints>
        <constraint id="c-true" type="max" value="1" field="selections" scope="parent" shared="true"/>
        <constraint id="c-false" type="max" value="1" field="selections" scope="parent" shared="false"/>
      </constraints>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

    const { cells } = extractCells([source(xml, 'fixtures/case-3.cat')]);
    const constraintCells = cells.filter(c => c.key.startsWith('constraint|'));

    expect(constraintCells).toHaveLength(2);
    expect(constraintCells.map(c => c.key)).toEqual(
      expect.arrayContaining([
        'constraint|max|selectionCount|parent|s=true|ics=false|icf=false|pct=false',
        'constraint|max|selectionCount|parent|s=false|ics=false|icf=false|pct=false',
      ]),
    );
  });

  // ── Case 4 ──────────────────────────────────────────────────────────────
  it('keeps min and max as distinct cells for otherwise identical constraints', () => {
    const xml = `<?xml version="1.0"?>
<catalogue id="cat-4" name="Case 4">
  <selectionEntries>
    <selectionEntry id="se-1" name="Unit">
      <constraints>
        <constraint id="c-min" type="min" value="1" field="selections" scope="parent"/>
        <constraint id="c-max" type="max" value="1" field="selections" scope="parent"/>
      </constraints>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

    const { cells } = extractCells([source(xml, 'fixtures/case-4.cat')]);
    const constraintCells = cells.filter(c => c.key.startsWith('constraint|'));

    expect(constraintCells).toHaveLength(2);
    expect(constraintCells.map(c => c.key)).toEqual(
      expect.arrayContaining([
        'constraint|min|selectionCount|parent|s=false|ics=false|icf=false|pct=false',
        'constraint|max|selectionCount|parent|s=false|ics=false|icf=false|pct=false',
      ]),
    );
  });

  // ── Case 5 ──────────────────────────────────────────────────────────────
  it('classifies the constraint field attribute into its field-class', () => {
    const costTypeId = 'ct1a-2b3c-4d5e-6f70';
    const undeclaredId = '9999-0000-1111-2222';
    const xml = `<?xml version="1.0"?>
<catalogue id="cat-5" name="Case 5">
  <costTypes>
    <costType id="${costTypeId}" name="pts"/>
  </costTypes>
  <selectionEntries>
    <selectionEntry id="se-1" name="Unit">
      <constraints>
        <constraint id="c-sel" type="max" value="1" field="selections" scope="roster"/>
        <constraint id="c-force" type="max" value="1" field="forces" scope="roster"/>
        <constraint id="c-cost" type="max" value="1" field="${costTypeId}" scope="roster"/>
        <constraint id="c-limit" type="max" value="1" field="limit::${costTypeId}" scope="roster"/>
        <constraint id="c-unresolved" type="max" value="1" field="${undeclaredId}" scope="roster"/>
        <constraint id="c-absent" type="max" value="1" scope="roster"/>
      </constraints>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

    const { cells } = extractCells([source(xml, 'fixtures/case-5.cat')]);
    const constraintCells = cells.filter(c => c.key.startsWith('constraint|'));
    const fieldClasses = constraintCells.map(c => c.key.split('|')[2]);

    expect(new Set(fieldClasses)).toEqual(
      new Set(['selectionCount', 'forceCount', 'costSum', 'limitValue', 'unresolvedField', 'absent']),
    );
  });

  // ── Case 6 ──────────────────────────────────────────────────────────────
  it('classifies the constraint scope attribute into its scope-class', () => {
    const literalScopes = ['roster', 'force', 'parent', 'self', 'unit', 'ancestor', 'primary-catalogue', 'category'];
    const guidScope = 'a1b2-c3d4-e5f6-0718';
    const constraints = literalScopes
      .map((scope, i) => `<constraint id="c-${i}" type="max" value="1" field="selections" scope="${scope}"/>`)
      .concat([
        `<constraint id="c-guid" type="max" value="1" field="selections" scope="${guidScope}"/>`,
        `<constraint id="c-missing" type="max" value="1" field="selections"/>`,
      ])
      .join('\n');
    const xml = `<?xml version="1.0"?>
<catalogue id="cat-6" name="Case 6">
  <selectionEntries>
    <selectionEntry id="se-1" name="Unit">
      <constraints>
        ${constraints}
      </constraints>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

    const { cells } = extractCells([source(xml, 'fixtures/case-6.cat')]);
    const constraintCells = cells.filter(c => c.key.startsWith('constraint|'));
    const scopeClasses = constraintCells.map(c => c.key.split('|')[3]);

    expect(new Set(scopeClasses)).toEqual(new Set([...literalScopes, 'id', 'absent']));
  });
});

// ── Case 7 ────────────────────────────────────────────────────────────────
describe('extractCells — condition type x scope x field-class', () => {
  const guid = 'b2c3-d4e5-f607-1829';

  function conditionsXml(conditions) {
    return `<?xml version="1.0"?>
<catalogue id="cat-7" name="Case 7">
  <selectionEntries>
    <selectionEntry id="se-1" name="Unit">
      <modifiers>
        <modifier type="set" value="true" field="hidden">
          <conditions>
            ${conditions}
          </conditions>
        </modifier>
      </modifiers>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;
  }

  it('records instanceOf and atLeast condition cells with their scope/field classes', () => {
    const xml = conditionsXml(
      '<condition type="instanceOf" value="1" field="selections" scope="parent" childId="model"/>' +
        '<condition type="atLeast" value="2" field="selections" scope="force" childId="any"/>',
    );

    const { cells } = extractCells([source(xml, 'fixtures/case-7.cat')]);
    const conditionCells = cells.filter(c => c.key.startsWith('condition|'));

    expect(conditionCells.map(c => c.key)).toEqual(
      expect.arrayContaining([
        'condition|instanceOf|parent|selectionCount|child=model',
        'condition|atLeast|force|selectionCount|child=any',
      ]),
    );
  });

  it('classifies childId model/any as literal, a GUID as id, and a missing attribute as absent', () => {
    const xml = conditionsXml(
      '<condition type="instanceOf" value="1" field="selections" scope="parent" childId="model"/>' +
        '<condition type="instanceOf" value="1" field="selections" scope="parent" childId="any"/>' +
        `<condition type="instanceOf" value="1" field="selections" scope="parent" childId="${guid}"/>` +
        '<condition type="instanceOf" value="1" field="selections" scope="parent"/>',
    );

    const { cells } = extractCells([source(xml, 'fixtures/case-7b.cat')]);
    const childClasses = cells.filter(c => c.key.startsWith('condition|')).map(c => c.key.split('child=')[1]);

    expect(new Set(childClasses)).toEqual(new Set(['model', 'any', 'id', 'absent']));
  });
});

// ── Case 8 ────────────────────────────────────────────────────────────────
describe('extractCells — repeat attributes', () => {
  function repeatXml(repeat) {
    return `<?xml version="1.0"?>
<catalogue id="cat-8" name="Case 8">
  <selectionEntries>
    <selectionEntry id="se-1" name="Unit">
      <modifiers>
        <modifier type="increment" value="1" field="selections">
          <repeats>
            ${repeat}
          </repeats>
        </modifier>
      </modifiers>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;
  }

  it('classifies repeats="1" as repeats=1 and a higher value as repeats=gt1', () => {
    const xml = repeatXml(
      '<repeat field="selections" scope="parent" childId="model" repeats="1"/>' +
        '<repeat field="selections" scope="parent" childId="model" repeats="3"/>',
    );

    const { cells } = extractCells([source(xml, 'fixtures/case-8.cat')]);
    const repeatCells = cells.filter(c => c.key.startsWith('repeat|'));

    expect(repeatCells.map(c => c.key)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('repeats=1'),
        expect.stringContaining('repeats=gt1'),
      ]),
    );
  });

  it('defaults an omitted roundUp to false and carries percentValue through', () => {
    const xml = repeatXml(
      '<repeat field="selections" scope="parent" childId="model" repeats="1"/>' +
        '<repeat field="selections" scope="parent" childId="model" repeats="1" roundUp="true" percentValue="true"/>',
    );

    const { cells } = extractCells([source(xml, 'fixtures/case-8b.cat')]);
    const repeatCells = cells.filter(c => c.key.startsWith('repeat|'));

    expect(repeatCells).toHaveLength(2);
    expect(repeatCells.map(c => c.key)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('roundUp=false'),
        expect.stringContaining('roundUp=true'),
      ]),
    );
    const withPercent = repeatCells.find(c => c.key.includes('roundUp=true'));
    expect(withPercent.key).toContain('pct=true');
  });

  // ── Case 8c (round 2 correction, Finding 1 — repeat flags) ────────────────
  it('separates cells by includeChildSelections=true vs. false (R1)', () => {
    const xml = repeatXml(
      '<repeat field="selections" scope="parent" childId="model" repeats="1" includeChildSelections="true"/>' +
        '<repeat field="selections" scope="parent" childId="model" repeats="1" includeChildSelections="false"/>',
    );

    const { cells } = extractCells([source(xml, 'fixtures/case-8c.cat')]);
    const repeatCells = cells.filter(c => c.key.startsWith('repeat|'));

    expect(repeatCells).toHaveLength(2);
    const trueCell = repeatCells.find(c => c.key.includes('ics=true'));
    const falseCell = repeatCells.find(c => c.key.includes('ics=false'));
    expect(trueCell).toBeDefined();
    expect(falseCell).toBeDefined();
    expect(trueCell.occurrences).toBe(1);
    expect(falseCell.occurrences).toBe(1);
  });

  // ── Case 8d (round 2 correction, Finding 1) ────────────────────────────────
  it('separates cells by includeChildForces=true vs. false (R2)', () => {
    const xml = repeatXml(
      '<repeat field="selections" scope="parent" childId="model" repeats="1" includeChildForces="true"/>' +
        '<repeat field="selections" scope="parent" childId="model" repeats="1" includeChildForces="false"/>',
    );

    const { cells } = extractCells([source(xml, 'fixtures/case-8d.cat')]);
    const repeatCells = cells.filter(c => c.key.startsWith('repeat|'));

    expect(repeatCells).toHaveLength(2);
    const trueCell = repeatCells.find(c => c.key.includes('icf=true'));
    const falseCell = repeatCells.find(c => c.key.includes('icf=false'));
    expect(trueCell).toBeDefined();
    expect(falseCell).toBeDefined();
    expect(trueCell.occurrences).toBe(1);
    expect(falseCell.occurrences).toBe(1);
  });

  // ── Case 8e (round 2 correction, Finding 1) ────────────────────────────────
  it('separates cells by shared=true vs. false (R3)', () => {
    const xml = repeatXml(
      '<repeat field="selections" scope="parent" childId="model" repeats="1" shared="true"/>' +
        '<repeat field="selections" scope="parent" childId="model" repeats="1" shared="false"/>',
    );

    const { cells } = extractCells([source(xml, 'fixtures/case-8e.cat')]);
    const repeatCells = cells.filter(c => c.key.startsWith('repeat|'));

    expect(repeatCells).toHaveLength(2);
    const trueCell = repeatCells.find(c => c.key.includes('s=true'));
    const falseCell = repeatCells.find(c => c.key.includes('s=false'));
    expect(trueCell).toBeDefined();
    expect(falseCell).toBeDefined();
    expect(trueCell.occurrences).toBe(1);
    expect(falseCell.occurrences).toBe(1);
  });

  // ── Case 8f (round 2 correction, Finding 1) ────────────────────────────────
  it('folds an omitted includeChildSelections attribute into the same cell as an explicit "false", merging the occurrence count (R4)', () => {
    const xml = repeatXml(
      '<repeat field="selections" scope="parent" childId="model" repeats="1"/>' +
        '<repeat field="selections" scope="parent" childId="model" repeats="1" includeChildSelections="false"/>',
    );

    const { cells } = extractCells([source(xml, 'fixtures/case-8f.cat')]);
    const repeatCells = cells.filter(c => c.key.startsWith('repeat|'));

    expect(repeatCells).toHaveLength(1);
    expect(repeatCells[0].key).toContain('ics=false');
    expect(repeatCells[0].occurrences).toBe(2);
  });

  // ── Case 8g (round 2 correction, Finding 1) ────────────────────────────────
  it('orders all three flags together as s=|ics=|icf=, right after repeats= and before roundUp=, and pins the full key (R5)', () => {
    const xml = repeatXml(
      '<repeat field="selections" scope="parent" childId="model" repeats="1" shared="true" includeChildSelections="true" includeChildForces="true"/>',
    );

    const { cells } = extractCells([source(xml, 'fixtures/case-8g.cat')]);
    const repeatCells = cells.filter(c => c.key.startsWith('repeat|'));

    expect(repeatCells).toHaveLength(1);
    expect(repeatCells[0].key).toBe(
      'repeat|selectionCount|parent|child=model|repeats=1|s=true|ics=true|icf=true|roundUp=false|pct=false',
    );
  });
});

// ── Case 9 ────────────────────────────────────────────────────────────────
describe('extractCells — modifier type x target-field-class', () => {
  it('keeps hidden/name/category/error literal and classifies id targets', () => {
    const costTypeId = 'c1a2-b3c4-d5e6-f708';
    const characteristicId = 'ch1a-2b3c-4d5e-6f70';
    const constraintId = 'cn1a-2b3c-4d5e-6f70';
    const unresolvedId = '0000-1111-2222-3333';
    const xml = `<?xml version="1.0"?>
<catalogue id="cat-9" name="Case 9">
  <costTypes>
    <costType id="${costTypeId}" name="pts"/>
  </costTypes>
  <profileTypes>
    <profileType id="pt-1" name="Warrior Profile">
      <characteristicTypes>
        <characteristicType id="${characteristicId}" name="Ws"/>
      </characteristicTypes>
    </profileType>
  </profileTypes>
  <selectionEntries>
    <selectionEntry id="se-1" name="Unit">
      <constraints>
        <constraint id="${constraintId}" type="max" value="1" field="selections" scope="parent"/>
      </constraints>
      <modifiers>
        <modifier type="set" value="true" field="hidden"/>
        <modifier type="set" value="Renamed" field="name"/>
        <modifier type="append" value="cat-1" field="category"/>
        <modifier type="add" value="err" field="error"/>
        <modifier type="set" value="10" field="${costTypeId}"/>
        <modifier type="set" value="5" field="${characteristicId}"/>
        <modifier type="set" value="2" field="${constraintId}"/>
        <modifier type="set" value="1" field="${unresolvedId}"/>
      </modifiers>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

    const { cells } = extractCells([source(xml, 'fixtures/case-9.cat')]);
    const modifierCells = cells.filter(c => c.key.startsWith('modifier|'));
    const targetClasses = modifierCells.map(c => c.key.split('|')[2]);

    expect(new Set(targetClasses)).toEqual(
      new Set(['hidden', 'name', 'category', 'error', 'costValue', 'characteristic', 'constraintValue', 'unresolvedTarget']),
    );

    const unresolvedCell = modifierCells.find(c => c.key.endsWith('|unresolvedTarget'));
    expect(unresolvedCell.examples.some(example => example.id === null || example.id !== undefined)).toBe(true);
    // The raw unresolved id must survive somewhere in the cell's examples,
    // since the id itself (not just its class) is what makes the gap actionable.
    expect(JSON.stringify(unresolvedCell.examples)).toContain(unresolvedId);
  });
});

// ── Case 10 ───────────────────────────────────────────────────────────────
describe('extractCells — conditionGroup nesting (and/or/not, top/nested)', () => {
  it('records and/or/not as distinct cells and distinguishes a top group from one nested inside another', () => {
    const xml = `<?xml version="1.0"?>
<catalogue id="cat-10" name="Case 10">
  <selectionEntries>
    <selectionEntry id="se-1" name="Unit">
      <modifiers>
        <modifier type="set" value="true" field="hidden">
          <conditionGroups>
            <conditionGroup type="and">
              <conditions>
                <condition type="instanceOf" value="1" field="selections" scope="parent" childId="model"/>
              </conditions>
              <conditionGroups>
                <conditionGroup type="not">
                  <conditions>
                    <condition type="instanceOf" value="1" field="selections" scope="parent" childId="model"/>
                  </conditions>
                </conditionGroup>
              </conditionGroups>
            </conditionGroup>
            <conditionGroup type="or">
              <conditions>
                <condition type="instanceOf" value="1" field="selections" scope="parent" childId="model"/>
              </conditions>
            </conditionGroup>
          </conditionGroups>
        </modifier>
      </modifiers>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

    const { cells } = extractCells([source(xml, 'fixtures/case-10.cat')]);
    const groupCells = cells.filter(c => c.key.startsWith('conditionGroup|'));

    expect(groupCells.map(c => c.key)).toEqual(
      expect.arrayContaining(['conditionGroup|and|top', 'conditionGroup|or|top', 'conditionGroup|not|nested']),
    );
  });
});

// ── Case 11 ───────────────────────────────────────────────────────────────
describe('extractCells — modifierGroup cells', () => {
  it('classifies cond by whether conditions or conditionGroups is present, repeats, and nesting', () => {
    const xml = `<?xml version="1.0"?>
<catalogue id="cat-11" name="Case 11">
  <selectionEntries>
    <selectionEntry id="se-1" name="Unit">
      <modifierGroups>
        <modifierGroup>
          <conditions>
            <condition type="instanceOf" value="1" field="selections" scope="parent" childId="model"/>
          </conditions>
          <modifiers>
            <modifier type="set" value="true" field="hidden"/>
          </modifiers>
        </modifierGroup>
        <modifierGroup>
          <conditionGroups>
            <conditionGroup type="and">
              <conditions>
                <condition type="instanceOf" value="1" field="selections" scope="parent" childId="model"/>
              </conditions>
            </conditionGroup>
          </conditionGroups>
          <modifiers>
            <modifier type="set" value="true" field="hidden"/>
          </modifiers>
        </modifierGroup>
        <modifierGroup>
          <modifiers>
            <modifier type="set" value="true" field="hidden"/>
          </modifiers>
        </modifierGroup>
        <modifierGroup>
          <repeats>
            <repeat field="selections" scope="parent" childId="model" repeats="1"/>
          </repeats>
          <modifiers>
            <modifier type="set" value="true" field="hidden"/>
          </modifiers>
          <modifierGroups>
            <modifierGroup>
              <modifiers>
                <modifier type="set" value="true" field="hidden"/>
              </modifiers>
            </modifierGroup>
          </modifierGroups>
        </modifierGroup>
      </modifierGroups>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

    const { cells } = extractCells([source(xml, 'fixtures/case-11.cat')]);
    const groupCells = cells.filter(c => c.key.startsWith('modifierGroup|'));
    const keys = groupCells.map(c => c.key);

    expect(keys).toEqual(
      expect.arrayContaining([
        expect.stringContaining('cond=true'),
        expect.stringContaining('cond=false'),
        expect.stringContaining('repeats=true'),
        expect.stringContaining('nested=true'),
      ]),
    );
    // The plain modifierGroup (neither conditions nor conditionGroups, no
    // repeats, not nested) is present as its own cell.
    expect(keys).toEqual(
      expect.arrayContaining(['modifierGroup|cond=false|repeats=false|nested=false']),
    );
  });
});

// ── Case 12 ───────────────────────────────────────────────────────────────
describe('extractCells — repeatList cells', () => {
  it('classifies a single <repeat> as n=1 and several as n=gt1, distinguishing modifier from modifierGroup', () => {
    const xml = `<?xml version="1.0"?>
<catalogue id="cat-12" name="Case 12">
  <selectionEntries>
    <selectionEntry id="se-1" name="Unit">
      <modifiers>
        <modifier type="increment" value="1" field="selections">
          <repeats>
            <repeat field="selections" scope="parent" childId="model" repeats="1"/>
          </repeats>
        </modifier>
      </modifiers>
      <modifierGroups>
        <modifierGroup>
          <repeats>
            <repeat field="selections" scope="parent" childId="model" repeats="1"/>
            <repeat field="selections" scope="force" childId="model" repeats="2"/>
          </repeats>
          <modifiers>
            <modifier type="set" value="true" field="hidden"/>
          </modifiers>
        </modifierGroup>
      </modifierGroups>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

    const { cells } = extractCells([source(xml, 'fixtures/case-12.cat')]);
    const listCells = cells.filter(c => c.key.startsWith('repeatList|'));

    expect(listCells.map(c => c.key)).toEqual(
      expect.arrayContaining(['repeatList|n=1|on=modifier', 'repeatList|n=gt1|on=modifierGroup']),
    );
  });
});

// ── Case 13 ───────────────────────────────────────────────────────────────
describe('extractCells — occurrence counting and locations', () => {
  it('reports total and per-file occurrence counts, with examples capped at 3 and carrying location', () => {
    function fileWith(count, fileName) {
      const constraints = Array.from(
        { length: count },
        (_, i) => `<constraint id="c-${fileName}-${i}" type="max" value="1" field="selections" scope="parent"/>`,
      ).join('\n');
      return `<?xml version="1.0"?>
<catalogue id="cat-${fileName}" name="Case 13">
  <selectionEntries>
    <selectionEntry id="se-1" name="Unit">
      <constraints>
        ${constraints}
      </constraints>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;
    }

    const fileA = 'fixtures/case-13a.cat';
    const fileB = 'fixtures/case-13b.cat';

    const { cells } = extractCells([source(fileWith(2, 'a'), fileA), source(fileWith(1, 'b'), fileB)]);
    const cell = cells.find(c => c.key === 'constraint|max|selectionCount|parent|s=false|ics=false|icf=false|pct=false');

    expect(cell.occurrences).toBe(3);
    expect(cell.files).toEqual({ [fileA]: 2, [fileB]: 1 });
    expect(cell.examples.length).toBeLessThanOrEqual(3);
    expect(cell.examples.length).toBe(3);
    for (const example of cell.examples) {
      expect(example).toHaveProperty('id');
      expect(example).toHaveProperty('ancestor');
      expect(example.ancestor).toMatchObject({ tag: 'selectionEntry', id: 'se-1', name: 'Unit' });
      expect(example.path).toEqual(['catalogue', 'selectionEntries', 'selectionEntry', 'constraints', 'constraint']);
    }
  });
});

// ── Case 14 ───────────────────────────────────────────────────────────────
describe('extractCells — edges', () => {
  it('returns an empty inventory for a document with no rule constructs, instead of throwing', () => {
    const xml = '<?xml version="1.0"?><catalogue id="cat-14" name="Empty"><selectionEntries/></catalogue>';

    const { cells, failures } = extractCells([source(xml, 'fixtures/case-14.cat')]);

    expect(cells).toEqual([]);
    expect(failures).toEqual([]);
  });

  // ── Case 15 ─────────────────────────────────────────────────────────────
  it('still yields a fully defaulted key when every optional constraint attribute is omitted', () => {
    const xml = `<?xml version="1.0"?>
<catalogue id="cat-15" name="Case 15">
  <selectionEntries>
    <selectionEntry id="se-1" name="Unit">
      <constraints>
        <constraint id="c-1" type="max" value="1"/>
      </constraints>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

    const { cells } = extractCells([source(xml, 'fixtures/case-15.cat')]);

    expect(cells).toHaveLength(1);
    expect(cells[0].key).toBe('constraint|max|absent|absent|s=false|ics=false|icf=false|pct=false');
  });

  // ── Case 16 ─────────────────────────────────────────────────────────────
  it('reports a parsererror document as an operational failure instead of counting it', () => {
    const malformed = '<catalogue id="cat-16"><selectionEntries><selectionEntry></catalogue>';
    const file = 'fixtures/case-16.cat';

    const { cells, failures } = extractCells([source(malformed, file)]);

    expect(cells).toEqual([]);
    expect(failures).toEqual([{ file, message: expect.any(String) }]);
  });
});

// ── Case 17 ───────────────────────────────────────────────────────────────
describe('coveredKeysFromManifests', () => {
  const constraintId = 'lim1-2345-6789-abcd';
  const xml = `<?xml version="1.0"?>
<catalogue id="cat-17" name="Case 17">
  <selectionEntries>
    <selectionEntry id="se-1" name="Unit">
      <constraints>
        <constraint id="${constraintId}" type="max" value="1" field="selections" scope="parent"/>
      </constraints>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

  it('matches an id from expect.firing[].limitId to its cell key, with the scenario directory as evidence', () => {
    const { index } = extractCells([source(xml, 'fixtures/case-17.cat')]);
    const manifests = [
      {
        dir: 'docs/testing/some-scenario',
        rosters: [{ expect: { firing: [{ limitId: constraintId }], absent: [] } }],
      },
    ];

    const { matched } = coveredKeysFromManifests(manifests, index);

    expect(matched).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'constraint|max|selectionCount|parent|s=false|ics=false|icf=false|pct=false',
          evidence: 'docs/testing/some-scenario',
        }),
      ]),
    );
  });

  it('matches an id from expect.absent[] the same way', () => {
    const { index } = extractCells([source(xml, 'fixtures/case-17.cat')]);
    const manifests = [
      {
        dir: 'docs/testing/other-scenario',
        rosters: [{ expect: { firing: [], absent: [constraintId] } }],
      },
    ];

    const { matched } = coveredKeysFromManifests(manifests, index);

    expect(matched).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          key: 'constraint|max|selectionCount|parent|s=false|ics=false|icf=false|pct=false',
          evidence: 'docs/testing/other-scenario',
        }),
      ]),
    );
  });

  it('reports an id naming no constraint as unmatched, without throwing', () => {
    const { index } = extractCells([source(xml, 'fixtures/case-17.cat')]);
    const manifests = [
      {
        dir: 'docs/testing/dangling-scenario',
        rosters: [{ expect: { firing: [{ limitId: 'no-such-id' }], absent: [] } }],
      },
    ];

    const { matched, unmatched } = coveredKeysFromManifests(manifests, index);

    expect(matched).toEqual([]);
    expect(unmatched).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'no-such-id', evidence: 'docs/testing/dangling-scenario' })]),
    );
  });
});

// ── Case 18 ───────────────────────────────────────────────────────────────
describe('diffCells', () => {
  const xml = `<?xml version="1.0"?>
<catalogue id="cat-18" name="Case 18">
  <selectionEntries>
    <selectionEntry id="se-1" name="Unit">
      <constraints>
        <constraint id="c-1" type="max" value="1" field="selections" scope="parent"/>
        <constraint id="c-2" type="min" value="1" field="selections" scope="parent"/>
      </constraints>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;

  it('removes a covered key from the uncovered list', () => {
    const { cells } = extractCells([source(xml, 'fixtures/case-18.cat')]);
    const coveredKey = 'constraint|max|selectionCount|parent|s=false|ics=false|icf=false|pct=false';

    const { uncovered } = diffCells(cells, [coveredKey]);

    expect(uncovered.map(c => c.key)).not.toContain(coveredKey);
    expect(uncovered.map(c => c.key)).toContain('constraint|min|selectionCount|parent|s=false|ics=false|icf=false|pct=false');
  });

  it('reports a covered key that occurs nowhere in the inventory as stale, without failing', () => {
    const { cells } = extractCells([source(xml, 'fixtures/case-18.cat')]);

    const { stale } = diffCells(cells, ['constraint|max|nonsense-cell-that-does-not-exist']);

    expect(stale).toEqual(['constraint|max|nonsense-cell-that-does-not-exist']);
  });

  it('leaves every cell uncovered for an empty covered record', () => {
    const { cells } = extractCells([source(xml, 'fixtures/case-18.cat')]);

    const { uncovered } = diffCells(cells, []);

    expect(uncovered).toHaveLength(cells.length);
  });
});

// ── Case 19 ───────────────────────────────────────────────────────────────
describe('keysFromCoveredRecord', () => {
  it('parses the documented shape and its keys join the derived, manifest-matched ones', () => {
    const record = {
      schemaVersion: 1,
      cells: [
        { key: 'constraint|max|selectionCount|parent|s=false|ics=false|icf=false|pct=false', evidence: 'query.matrix', rationale: 'synthetic module test' },
      ],
    };

    const keys = keysFromCoveredRecord(record);

    expect(keys).toEqual(['constraint|max|selectionCount|parent|s=false|ics=false|icf=false|pct=false']);

    const xml = `<?xml version="1.0"?>
<catalogue id="cat-19" name="Case 19">
  <selectionEntries>
    <selectionEntry id="se-1" name="Unit">
      <constraints>
        <constraint id="c-1" type="max" value="1" field="selections" scope="parent"/>
        <constraint id="c-2" type="min" value="1" field="selections" scope="parent"/>
      </constraints>
    </selectionEntry>
  </selectionEntries>
</catalogue>`;
    const { cells } = extractCells([source(xml, 'fixtures/case-19.cat')]);
    const { uncovered } = diffCells(cells, keys);

    expect(uncovered.map(c => c.key)).toEqual(['constraint|min|selectionCount|parent|s=false|ics=false|icf=false|pct=false']);
  });
});

// ── Case 20 ───────────────────────────────────────────────────────────────
describe('exitCodeFor', () => {
  it('returns 1 for a non-empty worklist and 0 for an empty one, as a pure function', () => {
    expect(exitCodeFor([{ key: 'constraint|max|selectionCount|parent|s=false|ics=false|icf=false|pct=false' }])).toBe(1);
    expect(exitCodeFor([])).toBe(0);
  });
});
