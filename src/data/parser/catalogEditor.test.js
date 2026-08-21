import { describe, it, expect } from 'vitest';
import {
  REMOVE_ATTRIBUTE,
  findExactEntryById,
  searchEditableEntries,
  updateRawXml,
  walkCatalogueTree,
} from './catalogEditor';

const systemWithRawXml = (content, kind = 'cat') => ({
  rawXmls: { [kind]: [{ name: `test.${kind}`, content }] },
});

const thrallXml = `
<selectionEntry id="unit-thrall" name="Vampire Thrall" publicationId="pub-1" page="42">
  <costs>
    <cost typeId="pts" value="80" />
  </costs>
  <constraints>
    <constraint id="max-thralls" type="max" value="3" />
  </constraints>
</selectionEntry>
`;

const contentOf = (system) => system.rawXmls.cat[0].content;

describe('updateRawXml', () => {
  it('applies a named edit object without any positional placeholders', () => {
    const system = systemWithRawXml(thrallXml);

    const wasApplied = updateRawXml(system, {
      entryId: 'unit-thrall',
      type: 'entry',
      patch: {
        name: 'Vampire Thrall Elite',
        costs: { pts: 95 },
        constraints: { 'max-thralls': 4 },
      },
    });

    expect(wasApplied).toBe(true);
    expect(contentOf(system)).toContain('name="Vampire Thrall Elite"');
    expect(contentOf(system)).toContain('value="95"');
    expect(contentOf(system)).toContain('value="4"');
  });

  it('leaves an attribute untouched when its patch key is absent', () => {
    const system = systemWithRawXml(thrallXml);

    updateRawXml(system, { entryId: 'unit-thrall', type: 'entry', patch: { name: 'Renamed' } });

    expect(contentOf(system)).toContain('publicationId="pub-1"');
    expect(contentOf(system)).toContain('page="42"');
  });

  it('removes an attribute only when the explicit REMOVE_ATTRIBUTE sentinel is given', () => {
    const system = systemWithRawXml(thrallXml);

    updateRawXml(system, {
      entryId: 'unit-thrall',
      type: 'entry',
      patch: { publicationId: REMOVE_ATTRIBUTE, page: REMOVE_ATTRIBUTE },
    });

    expect(contentOf(system)).not.toContain('publicationId=');
    expect(contentOf(system)).not.toContain('page=');
  });

  it('distinguishes clearing a value from removing the attribute', () => {
    const system = systemWithRawXml(thrallXml);

    updateRawXml(system, { entryId: 'unit-thrall', type: 'entry', patch: { page: '' } });

    expect(contentOf(system)).toContain('page=""');
  });

  it('applies characteristics for a profile and leaves cost handling out of it', () => {
    const system = systemWithRawXml(`
      <profile id="prof-1" name="Thrall">
        <characteristics>
          <characteristic name="M">4</characteristic>
          <characteristic name="WS">3</characteristic>
        </characteristics>
      </profile>
    `);

    updateRawXml(system, {
      entryId: 'prof-1',
      type: 'profile',
      patch: { characteristics: { WS: '5' } },
    });

    expect(contentOf(system)).toContain('<characteristic name="WS">5</characteristic>');
    expect(contentOf(system)).toContain('<characteristic name="M">4</characteristic>');
  });

  it('creates a missing description element when patching a rule', () => {
    const system = systemWithRawXml('<rule id="rule-1" name="Fear"></rule>');

    updateRawXml(system, {
      entryId: 'rule-1',
      type: 'rule',
      patch: { description: 'Causes fear.' },
    });

    expect(contentOf(system)).toContain('<description>Causes fear.</description>');
  });

  it('applies constraints for every constraint-bearing entry type', () => {
    const constrainedXml = (id) =>
      `<node id="${id}"><constraints><constraint id="lim" type="max" value="1"/></constraints></node>`;

    ['group', 'categoryLink', 'forceEntry'].forEach((type) => {
      const system = systemWithRawXml(constrainedXml('node-1'));

      updateRawXml(system, { entryId: 'node-1', type, patch: { constraints: { lim: 7 } } });

      expect(contentOf(system)).toContain('value="7"');
    });
  });

  it('falls back to the gst files when no cat file carries the id', () => {
    const system = systemWithRawXml('<rule id="rule-gst" name="Old"/>', 'gst');

    const wasApplied = updateRawXml(system, {
      entryId: 'rule-gst',
      type: 'rule',
      patch: { name: 'New' },
    });

    expect(wasApplied).toBe(true);
    expect(system.rawXmls.gst[0].content).toContain('name="New"');
  });

  it('reports that nothing was applied when the id is absent from the raw XML', () => {
    const system = systemWithRawXml(thrallXml);

    expect(updateRawXml(system, { entryId: 'missing', type: 'entry', patch: { name: 'X' } }))
      .toBe(false);
    expect(contentOf(system)).toBe(thrallXml);
  });

  it('rejects an edit without an entryId instead of silently doing nothing', () => {
    expect(() => updateRawXml(systemWithRawXml(thrallXml), { type: 'entry' })).toThrow(TypeError);
  });

  it('supports a new entry type purely through its patch appliers', () => {
    const system = systemWithRawXml('<somethingNew id="new-1" name="Old"/>');

    const wasApplied = updateRawXml(system, {
      entryId: 'new-1',
      type: 'aTypeNobodyRegistered',
      patch: { name: 'Renamed' },
    });

    expect(wasApplied).toBe(true);
    expect(contentOf(system)).toContain('name="Renamed"');
  });
});

/**
 * One game system exercising every node collection the traversal knows about, so a search
 * over it must surface all of them.
 */
const systemWithEveryNodeType = () => ({
  name: 'Test System',
  categoryEntries: [{ id: 'cat-hero', name: 'Testable Hero Category' }],
  forceEntries: [
    {
      id: 'force-main',
      name: 'Testable Main Force',
      categoryLinks: [{ id: 'catlink-1', name: 'Testable Category Link' }],
    },
  ],
  sharedRules: [{ id: 'shared-rule', name: 'Testable Shared Rule' }],
  sharedProfiles: [{ id: 'shared-profile', name: 'Testable Shared Profile' }],
  catalogues: [
    {
      id: 'cat-1',
      name: 'Testable Catalogue',
      selectionEntries: [
        {
          id: 'entry-1',
          name: 'Testable Entry',
          entryLinks: [{ id: 'link-1', name: 'Testable Entry Link' }],
          selectionEntryGroups: [{ id: 'group-1', name: 'Testable Group' }],
          profiles: [{ id: 'profile-1', name: 'Testable Profile' }],
          rules: [{ id: 'rule-1', name: 'Testable Rule' }],
          infoLinks: [{ id: 'infolink-1', name: 'Testable Info Link' }],
        },
      ],
      sharedSelectionEntries: [{ id: 'shared-entry', name: 'Testable Shared Entry' }],
      sharedSelectionEntryGroups: [{ id: 'shared-group', name: 'Testable Shared Group' }],
    },
  ],
});

const ALL_NODE_IDS = [
  'cat-hero',
  'force-main',
  'catlink-1',
  'shared-rule',
  'shared-profile',
  'cat-1',
  'entry-1',
  'link-1',
  'group-1',
  'profile-1',
  'rule-1',
  'infolink-1',
  'shared-entry',
  'shared-group',
];

describe('walkCatalogueTree', () => {
  it('visits the game system, every catalogue and every nested node exactly once', () => {
    const visitedIds = [...walkCatalogueTree(systemWithEveryNodeType())]
      .map((visit) => visit.node.id)
      .filter(Boolean);

    expect(new Set(visitedIds).size).toBe(visitedIds.length);
    ALL_NODE_IDS.forEach((id) => expect(visitedIds).toContain(id));
  });

  it('attributes nodes to the catalogue they live in', () => {
    const visits = [...walkCatalogueTree(systemWithEveryNodeType())];
    const entryVisit = visits.find((visit) => visit.node.id === 'entry-1');
    const sharedRuleVisit = visits.find((visit) => visit.node.id === 'shared-rule');

    expect(entryVisit.catalogueName).toBe('Testable Catalogue');
    expect(entryVisit.path).toContain('Testable Catalogue -> Testable Entry');
    expect(sharedRuleVisit.catalogueName).toBe('Test System');
  });

  it('labels a nameless link node by its target id', () => {
    const system = {
      name: 'Sys',
      catalogues: [{ id: 'c', name: 'C', infoLinks: [{ id: 'il-1', targetId: 'target-profile' }] }],
    };

    const visit = [...walkCatalogueTree(system)].find((candidate) => candidate.node.id === 'il-1');

    expect(visit.path).toBe('C -> InfoLink: target-profile');
  });

  it('yields nothing for an absent system', () => {
    expect([...walkCatalogueTree(null)]).toEqual([]);
  });
});

describe('searchEditableEntries and findExactEntryById share one node set', () => {
  it('finds every node type that the exact lookup can find', () => {
    const system = systemWithEveryNodeType();

    const searchedIds = searchEditableEntries(system, 'Testable').map((result) => result.id);

    ALL_NODE_IDS.forEach((id) => {
      const exactHit = findExactEntryById(system, id);
      expect(exactHit).not.toBeNull();
      expect(searchedIds).toContain(id);
    });
  });

  it('reports the same type and path for a node found either way', () => {
    const system = systemWithEveryNodeType();

    const searchHit = searchEditableEntries(system, 'Testable Category Link')[0];
    const exactHit = findExactEntryById(system, 'catlink-1');

    expect(searchHit.type).toBe(exactHit.type);
    expect(searchHit.type).toBe('categoryLink');
    expect(searchHit.path).toBe(exactHit.path);
    expect(searchHit.ref).toBe(exactHit.ref);
  });
});

describe('searchEditableEntries', () => {
  it('ignores queries shorter than the minimum length', () => {
    expect(searchEditableEntries(systemWithEveryNodeType(), 'T')).toEqual([]);
    expect(searchEditableEntries(systemWithEveryNodeType(), '')).toEqual([]);
  });

  it('matches on id as well as on name, case-insensitively', () => {
    const results = searchEditableEntries(systemWithEveryNodeType(), 'SHARED-GROUP');

    expect(results.map((result) => result.id)).toEqual(['shared-group']);
  });

  it('caps the number of results', () => {
    const manyEntries = Array.from({ length: 80 }, (_, index) => ({
      id: `entry-${index}`,
      name: `Testable ${index}`,
    }));
    const system = { name: 'Sys', catalogues: [{ id: 'c', name: 'C', selectionEntries: manyEntries }] };

    expect(searchEditableEntries(system, 'Testable')).toHaveLength(50);
  });
});

describe('findExactEntryById', () => {
  it('returns null for an unknown id and for an empty id', () => {
    const system = systemWithEveryNodeType();

    expect(findExactEntryById(system, 'nope')).toBeNull();
    expect(findExactEntryById(system, '')).toBeNull();
  });

  it('falls back to the id when a node carries no name', () => {
    const system = { name: 'Sys', catalogues: [{ id: 'c', name: 'C', infoLinks: [{ id: 'il-1' }] }] };

    expect(findExactEntryById(system, 'il-1').name).toBe('il-1');
  });
});
