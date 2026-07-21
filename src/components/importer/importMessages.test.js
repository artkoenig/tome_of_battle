import { describe, it, expect } from 'vitest';
import { buildImportSuccessMessage, buildMissingLibraryDependencyMessage } from './importMessages';

describe('buildMissingLibraryDependencyMessage', () => {
  it('names the missing catalogue together with every catalogue depending on it', () => {
    const message = buildMissingLibraryDependencyMessage([
      { id: 'merc', name: 'Mercenaries', requiredBy: ['Dogs of War', 'Empire'] },
    ]);

    expect(message).toContain('Import abgebrochen');
    expect(message).toContain('Mercenaries');
    expect(message).toContain('benötigt von');
    expect(message).toContain('Dogs of War');
    expect(message).toContain('Empire');
  });

  it('names a missing catalogue without a dependent plainly', () => {
    const message = buildMissingLibraryDependencyMessage([
      { id: 'merc', name: 'Mercenaries', requiredBy: [] },
    ]);

    expect(message).toContain('Mercenaries');
    expect(message).not.toContain('benötigt von');
  });

  it('lists several missing catalogues in one message', () => {
    const message = buildMissingLibraryDependencyMessage([
      { id: 'merc', name: 'Mercenaries', requiredBy: ['Dogs of War'] },
      { id: 'special', name: 'Special Characters', requiredBy: ['Empire'] },
    ]);

    expect(message).toContain('Mercenaries');
    expect(message).toContain('Special Characters');
  });
});

describe('buildImportSuccessMessage', () => {
  it('confirms the stored system with its catalogue count', () => {
    expect(buildImportSuccessMessage({ name: 'System One', catalogues: [{ id: 'a' }, { id: 'b' }] })).toBe(
      'Das System "System One" mit 2 Katalogen wurde erfolgreich importiert!'
    );
  });

  it('counts zero catalogues when the system carries none', () => {
    expect(buildImportSuccessMessage({ name: 'System One' })).toContain('mit 0 Katalogen');
  });
});
