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

/**
 * Single source of truth for what a build's version is, the tag it should
 * caller supplies git state.
 *
 * @param {object}   opts
 * @param {string[]} opts.tags       all vX.Y.Z tags in the repo
 * @param {string[]} [opts.headTags] vX.Y.Z tags pointing at HEAD
 * @param {boolean}  opts.isMain     building main?
 * @param {string}   opts.commitHash short HEAD hash (for feature branches)
 * @returns {{ version: string, base: string, tag: string|null }}
 *   - version: the version string to display / write into changelog.json
 *   - base:    tag to compute "what's new" from ('' → whole history)
 *   - tag:     release tag this build should create, or null (feature branch,
 *              or HEAD is already a released commit)
 */
export function resolveVersion({ tags, headTags = [], isMain, commitHash }) {
  const releaseTags = tags.filter((t) => parseVersion(t));
  const latest = latestVersion(tags);
  const headReleaseTags = headTags.filter((t) => parseVersion(t));

  // HEAD is already tagged as a release (e.g. Vercel rebuilds after the tag was
  // pushed): reuse that tag, never bump again. Diff from the tag just below it.
  if (isMain && headReleaseTags.length) {
    const head = latestVersion(headReleaseTags);
    const below = releaseTags
      .map(parseVersion)
      .filter((v) => compareVersions(v, head) < 0)
      .sort(compareVersions)
      .pop();
    return { version: formatVersion(head), base: below ? formatVersion(below) : '', tag: null };
  }

  const base = releaseTags.length ? formatVersion(latest) : '';

  if (isMain) {
    const version = buildVersionString({ latest, isMain: true, existingTags: tags });
    return { version, base, tag: version };
  }

  return { version: `${formatVersion(latest)}+${commitHash}`, base, tag: null };
}
