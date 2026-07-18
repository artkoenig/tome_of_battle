import { describe, it, expect } from 'vitest';
import { validateAgainstSchema, SCHEMA_KIND } from './schemaValidator';

// Synthetic, minimal, schema-valid documents — one per kind — declaring the
// namespace the vendored XSD expects after the kind-driven namespace swap. They are
// deliberately generic (not WHFB6) so conformance is tested against the format, not
// against the app's incidental data.
const CATALOGUE_NAMESPACE = 'http://www.battlescribe.net/schema/catalogueSchema';
const GAME_SYSTEM_NAMESPACE = 'http://www.battlescribe.net/schema/gameSystemSchema';
const ROSTER_NAMESPACE = 'http://www.battlescribe.net/schema/rosterSchema';

const validCatalogue = `<?xml version="1.0" encoding="UTF-8"?>
<catalogue id="cat-1" name="Test Catalogue" gameSystemId="sys-1" xmlns="${CATALOGUE_NAMESPACE}"/>`;

const validGameSystem = `<?xml version="1.0" encoding="UTF-8"?>
<gameSystem id="sys-1" name="Test Game System" xmlns="${GAME_SYSTEM_NAMESPACE}"/>`;

const validRoster = `<?xml version="1.0" encoding="UTF-8"?>
<roster id="ros-1" name="Test Roster" gameSystemId="sys-1" xmlns="${ROSTER_NAMESPACE}"/>`;

// Deliberately invalid: a selectionEntry is missing its required `type` attribute.
// The violation sits on line 4, so the reported location is verifiable.
const invalidCatalogue = `<?xml version="1.0" encoding="UTF-8"?>
<catalogue id="cat-1" name="Broken" gameSystemId="sys-1" xmlns="${CATALOGUE_NAMESPACE}">
  <selectionEntries>
    <selectionEntry id="e1" name="Entry Without Type"/>
  </selectionEntries>
</catalogue>`;

describe('validateAgainstSchema', () => {
  it('accepts a schema-valid catalogue', async () => {
    const result = await validateAgainstSchema(validCatalogue, SCHEMA_KIND.CATALOGUE);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts a schema-valid game system', async () => {
    const result = await validateAgainstSchema(validGameSystem, SCHEMA_KIND.GAME_SYSTEM);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('accepts a schema-valid roster', async () => {
    const result = await validateAgainstSchema(validRoster, SCHEMA_KIND.ROSTER);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects a deliberately invalid catalogue and reports a locatable error', async () => {
    const result = await validateAgainstSchema(invalidCatalogue, SCHEMA_KIND.CATALOGUE);

    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);

    const [firstError] = result.errors;
    expect(firstError.line).toBe(4);
    expect(firstError).toHaveProperty('column');
    expect(typeof firstError.message).toBe('string');
    expect(firstError.message.length).toBeGreaterThan(0);
  });

  it('validates each kind against its own namespace: a catalogue is invalid as a game system', async () => {
    // The catalogue's root namespace is the catalogue namespace; validating it under
    // the game-system namespace must fail, proving the kind switch swaps namespaces.
    const asGameSystem = await validateAgainstSchema(validCatalogue, SCHEMA_KIND.GAME_SYSTEM);
    expect(asGameSystem.valid).toBe(false);

    // The same bytes are valid under the correct kind.
    const asCatalogue = await validateAgainstSchema(validCatalogue, SCHEMA_KIND.CATALOGUE);
    expect(asCatalogue.valid).toBe(true);
  });

  it('validates a game system against its own namespace: a game system is invalid as a catalogue', async () => {
    const asCatalogue = await validateAgainstSchema(validGameSystem, SCHEMA_KIND.CATALOGUE);
    expect(asCatalogue.valid).toBe(false);

    const asGameSystem = await validateAgainstSchema(validGameSystem, SCHEMA_KIND.GAME_SYSTEM);
    expect(asGameSystem.valid).toBe(true);
  });

  it('throws on an unknown kind', async () => {
    await expect(validateAgainstSchema(validCatalogue, 'notAKind')).rejects.toThrow(
      /Unknown schema kind/
    );
  });
});
