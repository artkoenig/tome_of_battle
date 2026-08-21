import { describe, it, expect } from 'vitest';
import {
  buildImportSuccessMessage,
  buildFailedCatalogueMessage,
  buildMissingLibraryDependencyMessage,
} from './importerMessages';

/**
 * Issue 0176 — the importer's messages, cut out of `useImporter.js`. The
 * assertions are the ones that used to live in `useImporter.test.jsx`.
 */
describe('importerMessages', () => {
  it('names the failed catalogues and reports an incomplete import as incomplete', () => {
    const failures = [{ fileName: 'emp.cat', message: 'kaputt' }];
    expect(buildFailedCatalogueMessage(failures)).toContain('emp.cat');
    expect(buildFailedCatalogueMessage(failures)).toContain('kaputt');

    const system = { name: 'Warhammer', catalogues: [{ id: 'cat1' }] };
    expect(buildImportSuccessMessage(system, [])).toContain('Warhammer');
    expect(buildImportSuccessMessage(system, failures)).not.toBe(buildImportSuccessMessage(system, []));
  });

  it('names every missing library together with what depends on it', () => {
    const message = buildMissingLibraryDependencyMessage([
      { id: 'lib', name: 'Bibliothek', requiredBy: ['Bretonnia', 'Empire'] },
      { id: 'lib2', name: 'Zweite', requiredBy: [] },
    ]);
    expect(message).toContain('Bibliothek');
    expect(message).toContain('Bretonnia');
    expect(message).toContain('Empire');
    expect(message).toContain('Zweite');
  });

  it('counts a system without catalogues as an import of nothing', () => {
    expect(buildImportSuccessMessage({ name: 'Leer' }, [])).toContain('Leer');
  });
});
