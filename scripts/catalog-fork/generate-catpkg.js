#!/usr/bin/env node
/**
 * Fork-CI entry point (see ADR-0017). Runs inside the Lexicanum catalog fork, not in
 * army_builder. On every upstream sync it:
 *
 *   1. reads all `.cat`/`.gst` files in the target directory (the just-synced state),
 *   2. compares each against its version at a git base ref (the state before the sync),
 *   3. bumps `revision` for files whose content actually changed and writes them back,
 *   4. regenerates `catpkg.json` from the resulting contents.
 *
 * The base ref defaults to the push event's "before" SHA (`CATALOG_SYNC_BASE_REF`,
 * supplied by the workflow from `github.event.before`), falling back to the parent
 * commit. A file with no version at the base is treated as brand new (no bump).
 *
 * Usage: node scripts/catalog-fork/generate-catpkg.js [--dir <path>] [--base <ref>]
 */
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { resolve, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { applyCatalogSync, isCatalogFileName } from './catalogRevision.js';

const CATPKG_FILE_NAME = 'catpkg.json';
const FILE_ENCODING = 'utf8';
const DEFAULT_BASE_REF = 'HEAD^';
const DIR_FLAG = '--dir';
const BASE_FLAG = '--base';

/**
 * `git show` streams a catalog file's entire previous version into memory. Real
 * catalogs exceed execFileSync's 1 MiB default `maxBuffer` (which raises ENOBUFS),
 * so the ceiling is lifted well past any plausible single-file size.
 */
const GIT_SHOW_MAX_BUFFER_BYTES = 256 * 1024 * 1024;

function parseArguments(argv) {
  const options = { dir: process.cwd(), baseRef: process.env.CATALOG_SYNC_BASE_REF || DEFAULT_BASE_REF };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === DIR_FLAG) options.dir = resolve(argv[index + 1]);
    if (argv[index] === BASE_FLAG) options.baseRef = argv[index + 1];
  }
  return options;
}

function listCatalogFileNames(directory) {
  return readdirSync(directory).filter(isCatalogFileName).sort();
}

function readCatalogFiles(directory, fileNames) {
  return fileNames.map((fileName) => ({
    fileName,
    content: readFileSync(join(directory, fileName), FILE_ENCODING),
  }));
}

/**
 * Reads a file's content at a git ref, or returns `null` when it did not exist there
 * (a brand-new file, or an all-zeros base such as a branch's first push). Any other
 * git failure is surfaced, never silently treated as "new".
 */
function readContentAtRef(directory, baseRef, fileName) {
  try {
    return execFileSync('git', ['show', `${baseRef}:./${fileName}`], {
      cwd: directory,
      encoding: FILE_ENCODING,
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: GIT_SHOW_MAX_BUFFER_BYTES,
    });
  } catch (error) {
    const stderr = String(error.stderr ?? '');
    const isMissingAtRef =
      stderr.includes('does not exist') ||
      stderr.includes('exists on disk, but not in') ||
      stderr.includes('unknown revision') ||
      stderr.includes('invalid object name');
    if (isMissingAtRef) return null;
    throw error;
  }
}

function writeCatpkgIndex(directory, catpkgIndex) {
  const target = join(directory, CATPKG_FILE_NAME);
  writeFileSync(target, JSON.stringify(catpkgIndex, null, 2) + '\n', FILE_ENCODING);
  return target;
}

function main() {
  const { dir, baseRef } = parseArguments(process.argv.slice(2));
  const fileNames = listCatalogFileNames(dir);
  if (fileNames.length === 0) {
    throw new Error(`No .cat/.gst files found in ${dir}.`);
  }

  const files = readCatalogFiles(dir, fileNames);
  const { results, catpkgIndex } = applyCatalogSync({
    files,
    resolvePreviousContent: (fileName) => readContentAtRef(dir, baseRef, fileName),
  });

  const bumped = results.filter((result) => result.changed);
  for (const result of results) {
    writeFileSync(join(dir, result.fileName), result.content, FILE_ENCODING);
  }
  const catpkgPath = writeCatpkgIndex(dir, catpkgIndex);

  console.log(`Compared ${results.length} file(s) against ${baseRef}.`);
  for (const result of bumped) {
    console.log(`  bumped ${result.fileName} → revision ${result.revision}`);
  }
  console.log(`Wrote ${catpkgPath} (${bumped.length} revision bump(s)).`);
}

main();
