/**
 * Codegen for the BattleScribe format's Single Source of Truth (SSOT).
 *
 * Reads the vendored, version-pinned `Catalogue.xsd` (see ADR 0016) and emits a
 * committed JavaScript module that exports the format's closed enum sets and its
 * canonical attribute names. Every value is derived from the XSD's own
 * `xs:enumeration` / `xs:attribute` declarations — nothing is hand-typed — so
 * parser and evaluator can consume these constants instead of drift-prone string
 * literals.
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

const ATTRIBUTE_NAMES_EXPORT = 'AttributeName';
const INDENT = '  ';

const CAMEL_CASE_BOUNDARY = /([a-z0-9])([A-Z])/g;
const HYPHEN = /-/g;

const MODULE_HEADER = `// AUTO-GENERATED FILE — DO NOT EDIT BY HAND.
//
// Generated from the vendored BattleScribe schema at
// src/parser/schema/Catalogue.xsd by \`npm run generate:schema\`.
//
// This module is the single source of truth for the BattleScribe data format's
// closed enum sets and canonical attribute names (see ADR 0016). Parser and
// evaluator consume these constants instead of hand-typed string literals, which
// structurally eliminates the drift class behind the format bugs.
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

function renderFrozenConstantObject(exportName, tokens) {
  const body = tokens
    .map(token => `${INDENT}${toConstantKey(token)}: '${token}',`)
    .join('\n');
  return `export const ${exportName} = Object.freeze({\n${body}\n});`;
}

export function generateSchemaModuleSource(xsdText) {
  const document = parseXsdDocument(xsdText);
  const enumBlocks = extractClosedEnums(document).map(({ name, values }) =>
    renderFrozenConstantObject(name, values),
  );
  const attributeBlock = renderFrozenConstantObject(
    ATTRIBUTE_NAMES_EXPORT,
    extractCanonicalAttributeNames(document),
  );
  return [MODULE_HEADER, ...enumBlocks, attributeBlock].join('\n\n') + '\n';
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
