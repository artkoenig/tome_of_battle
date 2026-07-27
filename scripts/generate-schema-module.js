/**
 * Codegen for the BattleScribe format's Single Source of Truth (SSOT).
 *
 * Reads the vendored, version-pinned `Catalogue.xsd` (see ADR 0016) and emits a
 * committed JavaScript module that exports the format's closed enum sets, its
 * canonical attribute names and the defaults the schema declares for those
 * attributes. Every value is derived from the XSD's own `xs:enumeration` /
 * `xs:attribute` declarations — nothing is hand-typed — so parser and evaluator
 * can consume these constants instead of drift-prone string literals.
 *
 * Run via `npm run generate:schema`. A guard check
 * (`scripts/generate-schema-module.test.js`) regenerates from the vendored XSD
 * and fails loudly if the committed module has drifted.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';

const currentFilePath = fileURLToPath(import.meta.url);
const repoRoot = resolve(dirname(currentFilePath), '..');

export const VENDORED_XSD_PATH = resolve(repoRoot, 'src', 'parser', 'schema', 'Catalogue.xsd');
export const GENERATED_MODULE_PATH = resolve(
  repoRoot,
  'src',
  'parser',
  'schema',
  'battlescribeSchema.generated.js',
);

const XSD_CONTENT_TYPE = 'application/xml';
const SIMPLE_TYPE_TAG = 'xs:simpleType';
const ENUMERATION_TAG = 'xs:enumeration';
const ATTRIBUTE_TAG = 'xs:attribute';
const NAME_ATTRIBUTE = 'name';
const VALUE_ATTRIBUTE = 'value';
const DEFAULT_ATTRIBUTE = 'default';

const ATTRIBUTE_NAMES_EXPORT = 'AttributeName';
const ATTRIBUTE_DEFAULTS_EXPORT = 'AttributeDefault';
const INDENT = '  ';

const CAMEL_CASE_BOUNDARY = /([a-z0-9])([A-Z])/g;
const HYPHEN = /-/g;

const MODULE_HEADER = `// AUTO-GENERATED FILE — DO NOT EDIT BY HAND.
//
// Generated from the vendored BattleScribe schema at
// src/parser/schema/Catalogue.xsd by \`npm run generate:schema\`.
//
// This module is the single source of truth for the BattleScribe data format's
// closed enum sets, canonical attribute names and declared attribute defaults
// (see ADR 0016). Parser and evaluator consume these constants instead of
// hand-typed string literals, which structurally eliminates the drift class
// behind the format bugs.
//
// A guard check (scripts/generate-schema-module.test.js) regenerates this file
// from the vendored XSD and fails if the committed content has drifted.`;

/**
 * Converts an XSD token (a camelCase or hyphenated enum value / attribute name)
 * into a SCREAMING_SNAKE_CASE constant key, e.g. `set-primary` -> `SET_PRIMARY`,
 * `includeChildSelections` -> `INCLUDE_CHILD_SELECTIONS`.
 */
function toConstantKey(token) {
  return token
    .replace(CAMEL_CASE_BOUNDARY, '$1_$2')
    .replace(HYPHEN, '_')
    .toUpperCase();
}

function parseXsdDocument(xsdText) {
  const { window } = new JSDOM(xsdText, { contentType: XSD_CONTENT_TYPE });
  return window.document;
}

/**
 * Extracts every closed enum set — an `xs:simpleType` carrying `xs:enumeration`
 * children — in the order it is declared in the XSD. Simple types without
 * enumerations (e.g. the free-form `idtype`) are excluded.
 */
function extractClosedEnums(document) {
  return Array.from(document.getElementsByTagName(SIMPLE_TYPE_TAG))
    .map(simpleType => ({
      name: simpleType.getAttribute(NAME_ATTRIBUTE),
      values: Array.from(simpleType.getElementsByTagName(ENUMERATION_TAG)).map(enumeration =>
        enumeration.getAttribute(VALUE_ATTRIBUTE),
      ),
    }))
    .filter(closedEnum => closedEnum.values.length > 0);
}

/**
 * Extracts the format's canonical attribute names — every `xs:attribute name`
 * declared anywhere in the XSD — deduplicated and sorted for a stable output.
 */
function extractCanonicalAttributeNames(document) {
  const declaredNames = Array.from(document.getElementsByTagName(ATTRIBUTE_TAG))
    .map(attribute => attribute.getAttribute(NAME_ATTRIBUTE))
    .filter(name => name !== null);
  return Array.from(new Set(declaredNames)).sort();
}

/**
 * Extracts the defaults the format itself declares — every `xs:attribute`
 * carrying a `default`, as `[attributeName, declaredDefault]` pairs sorted by
 * name for a stable output. An attribute missing from a document is to be read
 * as if that text stood there, so the default belongs to the format and not to
 * any single reader that happens to need it.
 *
 * The same attribute name is declared on several complex types; two differing
 * defaults for one name would make "the default" ambiguous, so that fails loudly
 * here instead of silently resolving to whichever declaration came first.
 */
function extractDeclaredAttributeDefaults(document) {
  const defaultsByAttributeName = new Map();
  for (const attribute of Array.from(document.getElementsByTagName(ATTRIBUTE_TAG))) {
    const name = attribute.getAttribute(NAME_ATTRIBUTE);
    const declaredDefault = attribute.getAttribute(DEFAULT_ATTRIBUTE);
    if (name === null || declaredDefault === null) continue;

    const knownDefault = defaultsByAttributeName.get(name);
    if (knownDefault !== undefined && knownDefault !== declaredDefault) {
      throw new Error(
        `Attribute "${name}" declares conflicting defaults in the XSD: ` +
          `"${knownDefault}" and "${declaredDefault}".`,
      );
    }
    defaultsByAttributeName.set(name, declaredDefault);
  }
  return Array.from(defaultsByAttributeName.entries()).sort(([leftName], [rightName]) =>
    leftName < rightName ? -1 : 1,
  );
}

/**
 * Renders a frozen constant object from `[token, value]` pairs: the token
 * becomes the constant key, the value its literal.
 */
function renderFrozenObject(exportName, entries) {
  const body = entries
    .map(([token, value]) => `${INDENT}${toConstantKey(token)}: '${value}',`)
    .join('\n');
  return `export const ${exportName} = Object.freeze({\n${body}\n});`;
}

/** Renders a frozen constant object whose values are the tokens themselves. */
function renderFrozenConstantObject(exportName, tokens) {
  return renderFrozenObject(exportName, tokens.map(token => [token, token]));
}

export function generateSchemaModuleSource(xsdText) {
  const document = parseXsdDocument(xsdText);
  const enumBlocks = extractClosedEnums(document).map(({ name, values }) =>
    renderFrozenConstantObject(name, values),
  );
  const attributeNameBlock = renderFrozenConstantObject(
    ATTRIBUTE_NAMES_EXPORT,
    extractCanonicalAttributeNames(document),
  );
  const attributeDefaultBlock = renderFrozenObject(
    ATTRIBUTE_DEFAULTS_EXPORT,
    extractDeclaredAttributeDefaults(document),
  );
  return (
    [MODULE_HEADER, ...enumBlocks, attributeNameBlock, attributeDefaultBlock].join('\n\n') + '\n'
  );
}

function writeGeneratedModule() {
  const xsdText = readFileSync(VENDORED_XSD_PATH, 'utf-8');
  writeFileSync(GENERATED_MODULE_PATH, generateSchemaModuleSource(xsdText));
  return relative(repoRoot, GENERATED_MODULE_PATH);
}

const isDirectInvocation = process.argv[1] && resolve(process.argv[1]) === currentFilePath;
if (isDirectInvocation) {
  const writtenPath = writeGeneratedModule();
  console.log(`Generated ${writtenPath} from ${relative(repoRoot, VENDORED_XSD_PATH)}`);
}
