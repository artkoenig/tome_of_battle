/**
 * Reine Versionslogik für das automatische Taggen beim Bauen (ohne Git-Zugriff,
 * damit sie testbar bleibt). Verwendet von der auto-tag-Logik in vite.config.js.
 *
 * Schema: vMAJOR.MINOR.PATCH
 * - main-Build      → Minor +1, Patch = 0
 * - anderer Branch  → Patch +1
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

/**
 * Nächste Version für einen Build.
 * @param {{major:number,minor:number,patch:number}} current
 * @param {boolean} isMain  true wenn auf main gebaut wird
 */
export function nextVersion(current, isMain) {
  return isMain
    ? { major: current.major, minor: current.minor + 1, patch: 0 }
    : { major: current.major, minor: current.minor, patch: current.patch + 1 };
}
