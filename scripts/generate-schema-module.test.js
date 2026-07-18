import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  generateSchemaModuleSource,
  VENDORED_XSD_PATH,
  GENERATED_MODULE_PATH,
} from './generate-schema-module.js';

const vendoredXsd = readFileSync(VENDORED_XSD_PATH, 'utf-8');
const committedModule = readFileSync(GENERATED_MODULE_PATH, 'utf-8');

describe('battlescribe schema SSOT guard', () => {
  it('committed module matches the module regenerated from the vendored XSD', () => {
    expect(generateSchemaModuleSource(vendoredXsd)).toBe(committedModule);
  });

  it('goes red when an existing enum value in the vendored XSD is changed (US 7)', () => {
    const mutatedXsd = vendoredXsd.replace(
      '<xs:enumeration value="set-primary" />',
      '<xs:enumeration value="set-primary-renamed" />',
    );
    expect(mutatedXsd).not.toBe(vendoredXsd); // the target line really existed

    const regenerated = generateSchemaModuleSource(mutatedXsd);

    expect(regenerated).not.toBe(committedModule);
    expect(regenerated).toContain("SET_PRIMARY_RENAMED: 'set-primary-renamed'");
  });

  it('goes red when a new valid enum value is added to the vendored XSD (US 7)', () => {
    const mutatedXsd = vendoredXsd.replace(
      '<xs:enumeration value="unit"/>',
      '<xs:enumeration value="unit"/>\n      <xs:enumeration value="formation"/>',
    );
    expect(mutatedXsd).not.toBe(vendoredXsd);

    const regenerated = generateSchemaModuleSource(mutatedXsd);

    expect(regenerated).not.toBe(committedModule);
    expect(regenerated).toContain("FORMATION: 'formation'");
  });

  it('goes red when a canonical attribute name in the vendored XSD is changed', () => {
    const mutatedXsd = vendoredXsd.replace(
      'name="includeChildSelections"',
      'name="includeChildSelectionsRenamed"',
    );
    expect(mutatedXsd).not.toBe(vendoredXsd);

    expect(generateSchemaModuleSource(mutatedXsd)).not.toBe(committedModule);
  });
});
