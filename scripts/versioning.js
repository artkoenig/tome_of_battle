/**
 * Reine Versionslogik für das automatische Versionieren beim Bauen (ohne
 * Git-Zugriff, damit sie testbar bleibt). Verwendet von vite.config.js.
 *
 * Normales Semantic Versioning: vMAJOR.MINOR.PATCH
 * - main-Build     → Minor +1, Patch = 0 (sauberer Release, wird getaggt)
 * - Feature-Branch → kein Release; an die aktuelle Version wird der
 *                    Commit-Hash als Build-Metadaten angehängt (v1.4.0+a1b2c3d)
 * - Major wird ausschließlich manuell gesetzt und hier nie verändert.
 */

/** Parst "v1.2.3" zu { major, minor, patch } oder null bei Nicht-Übereinstimmung. */
export function parseVersion(tag) {
  const m = /^v(\d+)\.(\d+)\.(\d+)$/.exec(tag);
  return m ? { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) } : null;
}

/** Formatiert { major, minor, patch } zurück zu "v1.2.3". */
export function formatVersion(v) {
  return `v${v.major}.${v.minor}.${v.patch}`;
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

/** Nächste Release-Version auf main: Minor +1, Patch zurück auf 0. */
export function nextReleaseVersion(current) {
  return { major: current.major, minor: current.minor + 1, patch: 0 };
}

/**
 * Berechnet die Versionsbezeichnung für einen Build.
 * @param {object}   opts
 * @param {{major:number,minor:number,patch:number}} opts.latest  höchste bestehende Version
 * @param {boolean}  opts.isMain      true wenn auf main gebaut wird
 * @param {string}   opts.commitHash  Kurz-Hash von HEAD (für Feature-Branches)
 * @param {string[]} [opts.existingTags]  bestehende Tags (zur Kollisionsvermeidung auf main)
 * @returns {string} z.B. "v1.5.0" (main) oder "v1.4.0+a1b2c3d" (Feature-Branch)
 */
export function buildVersionString({ latest, isMain, commitHash, existingTags = [] }) {
  if (isMain) {
    let candidate = nextReleaseVersion(latest);
    while (existingTags.includes(formatVersion(candidate))) {
      candidate = nextReleaseVersion(candidate);
    }
    return formatVersion(candidate);
  }
  return `${formatVersion(latest)}+${commitHash}`;
}
