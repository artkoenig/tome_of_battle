import { describe, test, expect } from 'vitest';
import { importedCatalogueEntryId, selectionIdentityId } from '../../../shared/rostermodel/selectionIds.js';

// The two names exist because `findEntryInSystem` indexes link ids and entry ids in one
// map: either order always resolves to *something*, so the wrong one is silent. What
// separates them is a selection that names both ids — the raw shape a BattleScribe `.ros`
// hands the import path before `reconcileImportedSelectionIds` normalises it.
describe('selectionIds — die zwei Ids einer Auswahl', () => {
  const BOTH_IDS = { entryLinkId: 'link-general', selectionEntryId: 't-general' };

  test('nennt bei beiden Ids die Verweis-Id als Identität', () => {
    expect(selectionIdentityId(BOTH_IDS)).toBe('link-general');
  });

  test('nennt bei beiden Ids die Eintrags-Id als Importziel', () => {
    expect(importedCatalogueEntryId(BOTH_IDS)).toBe('t-general');
  });

  test('unterscheiden sich, wo eine Auswahl beide Ids nennt', () => {
    expect(selectionIdentityId(BOTH_IDS)).not.toBe(importedCatalogueEntryId(BOTH_IDS));
  });

  test('antworten gleich, wo nur eine der beiden Ids gesetzt ist', () => {
    const onlyLink = { entryLinkId: 'link-shield', selectionEntryId: null };
    const onlyEntry = { entryLinkId: null, selectionEntryId: 'se-choppa' };

    expect(selectionIdentityId(onlyLink)).toBe('link-shield');
    expect(importedCatalogueEntryId(onlyLink)).toBe('link-shield');
    expect(selectionIdentityId(onlyEntry)).toBe('se-choppa');
    expect(importedCatalogueEntryId(onlyEntry)).toBe('se-choppa');
  });

  // The `.ros` serializer writes `entryLinkId=""` for a directly set selection, and so does
  // BattleScribe: the empty string counts as a missing attribute, not as an id.
  test('behandeln den leeren String wie ein fehlendes Attribut', () => {
    const directlySet = { entryLinkId: '', selectionEntryId: 'se-choppa' };

    expect(selectionIdentityId(directlySet)).toBe('se-choppa');
    expect(importedCatalogueEntryId(directlySet)).toBe('se-choppa');
  });

  test('antworten null, wo eine Auswahl keine der beiden Ids nennt', () => {
    expect(selectionIdentityId({})).toBe(null);
    expect(importedCatalogueEntryId({})).toBe(null);
  });
});
