/**
 * Ermittelt die Änderungen zwischen der installierten Version und einem
 * bereitgestellten Release. Reines Fachwissen ohne UI-Bezug: Die App-Shell
 * reicht nur die installierte Version und die Release-Information herein.
 */

import { t } from '../i18n/i18nStore.js';

/** Höchstzahl an Einträgen, die in der Änderungsliste angezeigt werden. */
export const MAX_DIFF_ENTRIES = 50;

/** Übersetzungsschlüssel des Hinweises, der eine bei {@link MAX_DIFF_ENTRIES} gekappte Liste abschließt. */
export const TRUNCATION_NOTICE_KEY = 'releaseDiff.truncationNotice';

/** Kürzeste Hash-Länge, ab der ein Präfixvergleich als eindeutig gilt. */
const MIN_ABBREVIATED_HASH_LENGTH = 7;

/** Trennzeichen zwischen Versionsname und Commit-Hash (z. B. `v1.2.0+abc1234`). */
const VERSION_HASH_SEPARATOR = '+';

/**
 * Kappt eine Änderungsliste bei {@link MAX_DIFF_ENTRIES} und hängt in dem Fall
 * den Hinweis auf weitere Einträge an.
 * @param {string[]} entries
 * @returns {string[]}
 */
function capEntries(entries) {
  if (entries.length <= MAX_DIFF_ENTRIES) return entries;
  return [...entries.slice(0, MAX_DIFF_ENTRIES), t(TRUNCATION_NOTICE_KEY)];
}

/**
 * Liest den Commit-Hash der installierten Version — entweder direkt aus dem
 * Versionsstring (`v1.2.0+abc1234`) oder über den passenden Release-Tag.
 * @param {string} installedVersion
 * @param {{name: string, hash: string}[]} tags
 * @returns {string} Der Hash oder ein leerer String, wenn er unbekannt ist.
 */
function resolveInstalledHash(installedVersion, tags) {
  if (!installedVersion) return '';

  if (installedVersion.includes(VERSION_HASH_SEPARATOR)) {
    return installedVersion.split(VERSION_HASH_SEPARATOR)[1];
  }

  const matchedTag = tags.find(
    tag => tag.name.toLowerCase() === installedVersion.toLowerCase()
  );
  return matchedTag ? matchedTag.hash : '';
}

/**
 * Ob zwei Hashes dieselbe Revision bezeichnen. Da Kurz- und Langformen
 * gemischt auftreten, gilt auch ein hinreichend langes gemeinsames Präfix.
 * @param {string} left
 * @param {string} right
 * @returns {boolean}
 */
function isSameCommit(left, right) {
  const a = left.toLowerCase();
  const b = right.toLowerCase();
  if (a === b) return true;
  return (
    (a.length >= MIN_ABBREVIATED_HASH_LENGTH && b.startsWith(a)) ||
    (b.length >= MIN_ABBREVIATED_HASH_LENGTH && a.startsWith(b))
  );
}

/**
 * Die seit der installierten Version hinzugekommenen Änderungen.
 * @param {string|undefined} installedVersion Installierte Version, optional mit `+hash`.
 * @param {{commits?: {hash: string, subject: string}[], tags?: {name: string, hash: string}[], changes?: string[]}|null} release
 * @returns {string[]}
 */
export function getDiffChanges(installedVersion, release) {
  if (!release) return [];
  if (!release.commits || !release.tags) {
    return release.changes || [];
  }

  const installedHash = resolveInstalledHash(installedVersion, release.tags);
  if (installedHash) {
    const installedIndex = release.commits.findIndex(commit =>
      isSameCommit(commit.hash, installedHash)
    );
    if (installedIndex !== -1) {
      return capEntries(release.commits.slice(0, installedIndex).map(c => c.subject));
    }
  }

  // Fallback: Der installierte Commit ist unbekannt (kein Hash ermittelbar oder
  // älter als das vom Release gelieferte Commit-Fenster). Dann werden die
  // neuesten Commits der Liste gezeigt, gekappt bei MAX_DIFF_ENTRIES.
  const allCommits = release.commits.map(c => c.subject);
  if (allCommits.length === 0) return release.changes || [];
  return capEntries(allCommits);
}
