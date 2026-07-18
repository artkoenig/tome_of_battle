/**
 * Reine Versionslogik (ohne Git-/Dateisystem-Zugriff, damit sie testbar
 * bleibt). Verwendet von vite.config.js (Build-Zeit-Anzeige) und
 * scripts/release.js (manueller Versions-Workflow).
 *
 * Normales Semantic Versioning: MAJOR.MINOR.PATCH
 * - Die App-Version kommt aus package.json (manuell gesetzt, siehe
 *   scripts/release.js) — nicht mehr aus einer Git-Tag-Prognose.
 * - main-Build      → package.json-Version unverändert angezeigt.
 * - Feature-Branch   → package.json-Version + Commit-Hash als
 *                      Build-Metadaten (z. B. v1.4.0+a1b2c3d).
 * - Major wird ausschließlich manuell gesetzt und hier nie automatisch
 *   verändert.
 */

/** Parst ein Git-Tag "v1.2.3" zu { major, minor, patch } oder null bei Nicht-Übereinstimmung. */
export function parseVersion(tag) {
  const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag);
  return m ? { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) } : null;
}

/** Formatiert { major, minor, patch } zurück zu einem Git-Tag "v1.2.3". */
export function formatVersion(v) {
  return `v${v.major}.${v.minor}.${v.patch}`;
}

/** Parst package.jsons "version"-Feld "1.2.3" (ohne "v") zu { major, minor, patch } oder null. */
export function parseSemver(version) {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  return m ? { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) } : null;
}

/** Formatiert { major, minor, patch } zu einem package.json-Versionsstring "1.2.3" (ohne "v"). */
export function formatSemver(v) {
  return `${v.major}.${v.minor}.${v.patch}`;
}

/** Numerischer Semver-Vergleich (a > b → > 0). */
export function compareVersions(a, b) {
  return (a.major - b.major) || (a.minor - b.minor) || (a.patch - b.patch);
}

/** Höchste vX.Y.Z-Version aus einer Tag-Liste; ohne Treffer { 0, 0, 0 }. */
export function latestVersion(tags) {
  let best = { major: 0, minor: 0, patch: 0 };
  let found = false;
  for (const tag of tags) {
    const v = parseVersion(tag);
    if (!v) continue;
    if (!found || compareVersions(v, best) > 0) {
      best = v;
      found = true;
    }
  }
  return best;
}

/** Nächste Minor-Version: Minor +1, Patch zurück auf 0, Major unverändert. */
export function nextMinorVersion(current) {
  return { major: current.major, minor: current.minor + 1, patch: 0 };
}

/** Nächste Patch-Version: Patch +1, Major/Minor unverändert. */
export function nextPatchVersion(current) {
  return { major: current.major, minor: current.minor, patch: current.patch + 1 };
}

/**
 * Versionsbezeichnung eines Builds: die manuell gepflegte package.json-Version,
 * auf Nicht-main-Branches ergänzt um den Commit-Hash als Build-Metadaten.
 *
 * @param {object}   opts
 * @param {string[]} opts.tags            bestehende vX.Y.Z-Tags (nur zur
 *                                        Ermittlung von "base" für die
 *                                        Release-Notes-Historie)
 * @param {string}   opts.packageVersion  package.jsons "version"-Feld, z. B. "1.5.0"
 * @param {boolean}  opts.isMain          true wenn auf main gebaut wird
 * @param {string}   opts.commitHash      Kurz-Hash von HEAD (für Nicht-main-Builds)
 * @returns {{ version: string, base: string }}
 *   - version: die Versionsbezeichnung, die angezeigt und in changelog.json
 *     geschrieben wird
 *   - base: höchster bestehender Release-Tag, ab dem "was ist neu" berechnet
 *     wird ('' → gesamte Historie, noch kein Release existiert)
 */
export function resolveVersion({ tags, packageVersion, isMain, commitHash }) {
  const releaseTags = tags.filter((t) => parseVersion(t));
  const base = releaseTags.length ? formatVersion(latestVersion(tags)) : '';
  const version = isMain ? `v${packageVersion}` : `v${packageVersion}+${commitHash}`;
  return { version, base };
}
