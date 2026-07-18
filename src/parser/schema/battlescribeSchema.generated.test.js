import { describe, it, expect } from 'vitest';
import {
  SelectionEntryKind,
  InfoLinkKind,
  EntryLinkKind,
  CatalogueLinkKind,
  ConstraintKind,
  ModifierKind,
  ConditionKind,
  ConditionGroupKind,
  AttributeName,
} from './battlescribeSchema.generated.js';

const allEnums = {
  SelectionEntryKind,
  InfoLinkKind,
  EntryLinkKind,
  CatalogueLinkKind,
  ConstraintKind,
  ModifierKind,
  ConditionKind,
  ConditionGroupKind,
};

describe('battlescribe schema module public surface', () => {
  it('exports the eight closed enum sets with exactly the values from the XSD', () => {
    expect(Object.values(SelectionEntryKind)).toEqual(['upgrade', 'model', 'unit']);
    expect(Object.values(InfoLinkKind)).toEqual(['infoGroup', 'profile', 'rule']);
    expect(Object.values(EntryLinkKind)).toEqual(['selectionEntry', 'selectionEntryGroup']);
    expect(Object.values(CatalogueLinkKind)).toEqual(['catalogue']);
    expect(Object.values(ConstraintKind)).toEqual(['min', 'max']);
    expect(Object.values(ModifierKind)).toEqual([
      'set',
      'increment',
      'decrement',
      'append',
      'add',
      'remove',
      'set-primary',
      'unset-primary',
    ]);
    expect(Object.values(ConditionKind)).toEqual([
      'lessThan',
      'greaterThan',
      'equalTo',
      'notEqualTo',
      'atLeast',
      'atMost',
      'instanceOf',
      'notInstanceOf',
    ]);
    expect(Object.values(ConditionGroupKind)).toEqual(['and', 'or']);
  });

  it('freezes every exported enum so consumers cannot mutate the closed sets', () => {
    for (const enumObject of Object.values(allEnums)) {
      expect(Object.isFrozen(enumObject)).toBe(true);
    }
  });

  it('exposes named members for the enum values that carry hyphens', () => {
    expect(ModifierKind.SET_PRIMARY).toBe('set-primary');
    expect(ModifierKind.UNSET_PRIMARY).toBe('unset-primary');
  });

  it('exposes the canonical attribute names behind the format bugs', () => {
    expect(AttributeName.TYPE_ID).toBe('typeId');
    expect(AttributeName.TYPE_NAME).toBe('typeName');
    expect(AttributeName.INCLUDE_CHILD_SELECTIONS).toBe('includeChildSelections');
    expect(AttributeName.INCLUDE_CHILD_FORCES).toBe('includeChildForces');
    expect(AttributeName.PERCENT_VALUE).toBe('percentValue');
    expect(AttributeName.IMPORT_ROOT_ENTRIES).toBe('importRootEntries');
    expect(AttributeName.PUBLISHER_URL).toBe('publisherUrl');
    expect(AttributeName.HIDDEN).toBe('hidden');
    expect(AttributeName.TARGET_ID).toBe('targetId');
  });

  it('freezes the canonical attribute-name map', () => {
    expect(Object.isFrozen(AttributeName)).toBe(true);
  });
});
