import { describe, it, expect } from 'vitest';
import { collectSchemaWarnings, SchemaValidationWarning } from './importSchemaGate';

const CATALOGUE_NAMESPACE = 'http://www.battlescribe.net/schema/catalogueSchema';
const GAME_SYSTEM_NAMESPACE = 'http://www.battlescribe.net/schema/gameSystemSchema';

const validGst = {
  name: 'Rules.gst',
  content: `<?xml version="1.0" encoding="UTF-8"?>
<gameSystem id="sys-1" name="Test Game System" xmlns="${GAME_SYSTEM_NAMESPACE}"/>`,
};

const validCat = {
  name: 'Faction.cat',
  content: `<?xml version="1.0" encoding="UTF-8"?>
<catalogue id="cat-1" name="Test Catalogue" gameSystemId="sys-1" xmlns="${CATALOGUE_NAMESPACE}"/>`,
};

const invalidCat = {
  name: 'Broken.cat',
  content: `<?xml version="1.0" encoding="UTF-8"?>
<catalogue id="cat-1" name="Broken" gameSystemId="sys-1" xmlns="${CATALOGUE_NAMESPACE}">
  <selectionEntries>
    <selectionEntry id="e1" name="Entry Without Type"/>
  </selectionEntries>
</catalogue>`,
};

// A second, distinct non-conforming catalogue. Used to prove that when several files of
// the same kind are validated together, each violation is attributed back to its own
// file rather than merged or lost.
const secondInvalidCat = {
  name: 'AlsoBroken.cat',
  content: `<?xml version="1.0" encoding="UTF-8"?>
<catalogue id="cat-2" name="AlsoBroken" gameSystemId="sys-1" xmlns="${CATALOGUE_NAMESPACE}">
  <selectionEntries>
    <selectionEntry id="e2" name="Another Entry Without Type"/>
  </selectionEntries>
</catalogue>`,
};

// A game system whose bytes carry the catalogue namespace: valid as a catalogue, but
// the advisory validates a .gst as a gameSystem, so it must be flagged.
const gstWithWrongNamespace = {
  name: 'Wrong.gst',
  content: `<?xml version="1.0" encoding="UTF-8"?>
<catalogue id="cat-1" name="Test" gameSystemId="sys-1" xmlns="${CATALOGUE_NAMESPACE}"/>`,
};

describe('collectSchemaWarnings', () => {
  it('returns no warnings when every file is schema-valid', async () => {
    await expect(collectSchemaWarnings([validGst], [validCat])).resolves.toEqual([]);
  });

  it('returns no warnings for empty and missing file lists', async () => {
    await expect(collectSchemaWarnings([], [])).resolves.toEqual([]);
    await expect(collectSchemaWarnings(undefined, undefined)).resolves.toEqual([]);
  });

  it('returns a SchemaValidationWarning carrying the file name and locatable errors, without throwing', async () => {
    const warnings = await collectSchemaWarnings([validGst], [validCat, invalidCat]);

    expect(warnings).toHaveLength(1);
    const [warning] = warnings;
    expect(warning).toBeInstanceOf(SchemaValidationWarning);
    expect(warning.fileName).toBe('Broken.cat');
    expect(warning.errors.length).toBeGreaterThan(0);
    expect(warning.errors[0].line).toBe(4);
  });

  it('produces a locatable, advisory message naming the file, the line, and that the import continued', async () => {
    const [warning] = await collectSchemaWarnings([], [invalidCat]);

    expect(warning.message).toContain('Broken.cat');
    expect(warning.message).toContain('Zeile 4');
    expect(warning.message).toContain('BattleScribe-Schema');
    expect(warning.message).toContain('fortgesetzt');
  });

  it('validates a game system file against the game-system namespace', async () => {
    const warnings = await collectSchemaWarnings([gstWithWrongNamespace], []);

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toBeInstanceOf(SchemaValidationWarning);
    expect(warnings[0].fileName).toBe('Wrong.gst');
  });

  it('collects one warning per non-conforming file across game systems and catalogues', async () => {
    const warnings = await collectSchemaWarnings([gstWithWrongNamespace], [validCat, invalidCat]);

    expect(warnings.map((warning) => warning.fileName)).toEqual(['Wrong.gst', 'Broken.cat']);
  });

  it('attributes violations to the right file when several of the same kind are checked together', async () => {
    const warnings = await collectSchemaWarnings(
      [],
      [invalidCat, validCat, secondInvalidCat]
    );

    expect(warnings.map((warning) => warning.fileName)).toEqual([
      'Broken.cat',
      'AlsoBroken.cat',
    ]);
    for (const warning of warnings) {
      expect(warning.errors[0].line).toBe(4);
      expect(warning.message).toContain(warning.fileName);
      expect(warning.message).toContain('Zeile 4');
    }
  });
});
