/**
 * Manueller Release-Workflow: berechnet und schreibt die nächste App-Version
 * in package.json. Wird vom Agenten aufgerufen, nachdem der Nutzer eine
 * vorgeschlagene oder eigene Version bestätigt hat (siehe CLAUDE.md,
 * Abschnitt "Version bump after merging a feature/fix main-issue").
 *
 * Reine Versionsberechnung (computeSuggestedVersion) ist von der
 * Datei-I/O (readPackageVersion/writePackageVersion) getrennt, damit die
 * Berechnung isoliert testbar bleibt.
 */
import { readFileSync, writeFileSync } from 'fs';
import { parseSemver, formatSemver, nextMinorVersion, nextPatchVersion } from './versioning.js';

const PACKAGE_JSON_PATH = new URL('../package.json', import.meta.url);

/** Bump-Arten, die dieses Skript vorschlagen kann. */
export const BUMP_TYPES = Object.freeze({ PATCH: 'patch', MINOR: 'minor' });

/**
 * Berechnet die vorgeschlagene Zielversion für einen Bump-Typ.
 * @param {{major:number,minor:number,patch:number}} current
 * @param {'patch'|'minor'} bumpType
 * @returns {{major:number,minor:number,patch:number}}
 */
export function computeSuggestedVersion(current, bumpType) {
  if (bumpType === BUMP_TYPES.PATCH) return nextPatchVersion(current);
  if (bumpType === BUMP_TYPES.MINOR) return nextMinorVersion(current);
  throw new Error(`Unbekannter Bump-Typ: ${bumpType}`);
}

/** Liest die aktuelle package.json-Version als { major, minor, patch }. */
export function readPackageVersion(path = PACKAGE_JSON_PATH) {
  const pkg = JSON.parse(readFileSync(path, 'utf8'));
  const version = parseSemver(pkg.version);
  if (!version) throw new Error(`package.json enthält keine gültige Version: "${pkg.version}"`);
  return version;
}

/**
 * Schreibt die neue Version in package.json und gibt den zu setzenden
 * Git-Tag-Namen zurück. Zeilenumbruch am Dateiende bleibt erhalten.
 * @param {{major:number,minor:number,patch:number}} version
 * @param {string|URL} path
 * @returns {string} z.B. "v1.5.0"
 */
export function writePackageVersion(version, path = PACKAGE_JSON_PATH) {
  const raw = readFileSync(path, 'utf8');
  const pkg = JSON.parse(raw);
  pkg.version = formatSemver(version);
  const trailingNewline = raw.endsWith('\n') ? '\n' : '';
  writeFileSync(path, `${JSON.stringify(pkg, null, 2)}${trailingNewline}`);
  return `v${pkg.version}`;
}

function resolveTargetVersion(current, action) {
  if (action === BUMP_TYPES.PATCH || action === BUMP_TYPES.MINOR) {
    return computeSuggestedVersion(current, action);
  }
  const explicit = parseSemver(action);
  if (!explicit) throw new Error(`Ungültige Version: "${action}" (erwartet "patch", "minor" oder "X.Y.Z")`);
  return explicit;
}

function main() {
  const action = process.argv[2];
  if (!action) {
    console.error('Nutzung: node scripts/release.js <patch|minor|X.Y.Z>');
    process.exitCode = 1;
    return;
  }
  const current = readPackageVersion();
  const target = resolveTargetVersion(current, action);
  const tag = writePackageVersion(target);
  console.log(`${formatSemver(current)} -> ${formatSemver(target)} (Tag: ${tag})`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
