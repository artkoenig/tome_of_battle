/**
 * Reine Auswertung des lokalen Issue-Trackers (ohne Git-, Datei- oder
 * Netzzugriff, damit sie testbar bleibt). Der Zugriff auf die Refs wird als
 * Funktion injiziert.
 *
 * Offene Vorgaenge werden ueber *mehrere* Refs gesammelt, nicht nur ueber den
 * Standard-Branch: ein Vorgang, der nur auf einem Arbeitsbranch existiert, ist
 * trotzdem offen. Umgekehrt gilt die Gegenregel -- was der Standard-Branch
 * bereits geschlossen hat, ist geschlossen, auch wenn ein aelterer Branch es
 * noch offen fuehrt. Der Standard-Branch ist die Wahrheit ueber den Abschluss,
 * die uebrigen Refs sind nur zusaetzliche Quellen fuer noch nicht gemergte
 * Vorgaenge.
 */

/** Die sechs Zustaende des Trackers. */
export const IssueStatus = Object.freeze({
  NeedsTriage: 'needs-triage',
  NeedsInfo: 'needs-info',
  ReadyForAgent: 'ready-for-agent',
  Claimed: 'claimed',
  Resolved: 'resolved',
  Superseded: 'superseded',
});

/**
 * Die beiden geschlossenen Zustaende. `superseded` zaehlt wie `resolved` als
 * abgeschlossen -- ein nie gebauter Vorgang bleibt nicht ewig offen.
 */
export const CLOSED_ISSUE_STATUSES = Object.freeze([IssueStatus.Resolved, IssueStatus.Superseded]);

const DEFAULT_TRACKER_ROOT = 'docs/issues/';
const ISSUE_FILE_NAME = 'issue.md';
const NO_BLOCKERS = 'None';

const HEADER_FIELD_PATTERN = /^([A-Za-z][A-Za-z ]*):[ \t]*(.*)$/;
const SECTION_HEADING_PATTERN = /^##\s+(.+?)\s*$/;
const ISSUE_NUMBER_PREFIX_PATTERN = /^\d+-/;

/** @param {string|null|undefined} status */
export function isClosedIssueStatus(status) {
  return CLOSED_ISSUE_STATUSES.includes(/** @type {any} */ (status));
}

/**
 * @typedef {object} ParsedIssue
 * @property {string|null} status      Wert aus {@link IssueStatus}, null wenn die Kopfzeile fehlt.
 * @property {string|null} type        feature | fix | refactor | chore
 * @property {string[]} blockedBy      numerische Praefixe der blockierenden Geschwister
 * @property {Record<string, string>} sections  Abschnittsinhalte je `##`-Ueberschrift
 */

/**
 * Zerlegt eine `issue.md` in Kopffelder und Abschnitte.
 *
 * @param {string} text
 * @returns {ParsedIssue}
 */
export function parseIssueMarkdown(text) {
  const lines = (text ?? '').split('\n');
  const header = new Map();
  /** @type {Record<string, string>} */
  const sections = {};

  let currentSection = null;
  /** @type {string[]} */
  let currentLines = [];
  let inHeader = true;

  const flushSection = () => {
    if (currentSection !== null) {
      sections[currentSection] = currentLines.join('\n').trim();
    }
  };

  for (const line of lines) {
    const heading = SECTION_HEADING_PATTERN.exec(line);
    if (heading) {
      flushSection();
      inHeader = false;
      currentSection = heading[1];
      currentLines = [];
      continue;
    }

    if (inHeader) {
      const field = HEADER_FIELD_PATTERN.exec(line);
      if (field) header.set(field[1].trim(), field[2].trim());
      continue;
    }

    currentLines.push(line);
  }
  flushSection();

  return {
    status: header.get('Status') ?? null,
    type: header.get('Type') ?? null,
    blockedBy: parseBlockedBy(header.get('Blocked by')),
    sections,
  };
}

/** `None` -> [], `[01, 03]` -> ['01', '03'] */
function parseBlockedBy(value) {
  const raw = (value ?? '').trim();
  if (raw === '' || raw === NO_BLOCKERS) return [];
  return raw
    .replace(/^\[|\]$/g, '')
    .split(',')
    .map((entry) => entry.trim())
    .filter((entry) => entry !== '');
}

/**
 * Id eines Vorgangs aus dem Pfad seiner `issue.md`, z. B.
 * `docs/issues/54-bericht/01-erhebung/issue.md` -> `54-bericht/01-erhebung`.
 *
 * @param {string} filePath
 * @param {string} [trackerRoot]
 * @returns {string}
 */
export function issueIdFromPath(filePath, trackerRoot = DEFAULT_TRACKER_ROOT) {
  const normalized = filePath.replace(/\\/g, '/');
  const rootIndex = normalized.indexOf(trackerRoot);
  const withoutRoot = rootIndex === -1 ? normalized : normalized.slice(rootIndex + trackerRoot.length);
  return withoutRoot.replace(new RegExp(`/?${ISSUE_FILE_NAME}$`), '').replace(/^\/+|\/+$/g, '');
}

/**
 * Lesbarer Titel aus dem Slug des letzten Pfadsegments. Der Tracker fuehrt
 * keinen eigenen Titel -- der Verzeichnisname ist die einzige Quelle.
 *
 * @param {string} issueId
 * @returns {string}
 */
export function issueTitleFromId(issueId) {
  const slug = issueId.split('/').pop() ?? '';
  return slug.replace(ISSUE_NUMBER_PREFIX_PATTERN, '').replace(/-/g, ' ').trim();
}

/**
 * @typedef {object} IssueRef  Ein erreichbarer Git-Ref samt der dort vorhandenen Issue-Dateien.
 * @property {string} name              Ref-Name, z. B. `origin/main`.
 * @property {string[]} issuePaths      Pfade aller `issue.md` auf diesem Ref.
 * @property {boolean} [isDefaultBranch] true fuer den Ref, der ueber den Abschluss entscheidet.
 */

/**
 * @typedef {object} OpenIssue
 * @property {string} id
 * @property {string} title
 * @property {string} path
 * @property {string} status
 * @property {string|null} type
 * @property {string[]} blockedBy
 * @property {Record<string, string>} sections
 * @property {string[]} refs   Refs, auf denen der Vorgang offen gefunden wurde.
 */

/**
 * @typedef {object} UnreadableIssue
 * @property {string} id
 * @property {string} ref
 * @property {string} reason
 */

/**
 * Sammelt die offenen Vorgaenge ueber alle uebergebenen Refs.
 *
 * @param {ReadonlyArray<IssueRef>} refs
 * @param {(refName: string, filePath: string) => (string|null)} showFile
 *   Injizierter Lesezugriff (in der Anwendung ein `git show`), liefert null,
 *   wenn die Datei auf diesem Ref nicht existiert.
 * @param {{ trackerRoot?: string }} [options]
 * @returns {{ issues: OpenIssue[], unreadable: UnreadableIssue[] }}
 *   `unreadable` sammelt Dateien ohne lesbare Kopfzeile, damit ein Parse-Fehler
 *   nicht als "kein offener Vorgang" verschwindet.
 */
export function collectOpenIssues(refs, showFile, { trackerRoot = DEFAULT_TRACKER_ROOT } = {}) {
  const closedOnDefaultBranch = collectClosedOnDefaultBranch(refs, showFile, trackerRoot);

  /** @type {Map<string, OpenIssue>} */
  const openById = new Map();
  /** @type {UnreadableIssue[]} */
  const unreadable = [];

  for (const ref of refs) {
    for (const filePath of ref.issuePaths) {
      const id = issueIdFromPath(filePath, trackerRoot);
      const text = showFile(ref.name, filePath);
      if (text === null || text === undefined) continue;

      const parsed = parseIssueMarkdown(text);
      if (parsed.status === null) {
        unreadable.push({ id, ref: ref.name, reason: 'missing-status-header' });
        continue;
      }

      if (isClosedIssueStatus(parsed.status)) continue;
      if (closedOnDefaultBranch.has(id)) continue;

      const known = openById.get(id);
      if (known) {
        known.refs.push(ref.name);
        continue;
      }

      openById.set(id, {
        id,
        title: issueTitleFromId(id),
        path: filePath,
        status: parsed.status,
        type: parsed.type,
        blockedBy: parsed.blockedBy,
        sections: parsed.sections,
        refs: [ref.name],
      });
    }
  }

  const issues = [...openById.values()].sort((a, b) => a.id.localeCompare(b.id));
  return { issues, unreadable };
}

/**
 * Ids, die der Standard-Branch bereits geschlossen hat. Ohne diese Menge
 * meldete jeder aeltere Branch laengst erledigte Vorgaenge erneut als offen.
 */
function collectClosedOnDefaultBranch(refs, showFile, trackerRoot) {
  const closed = new Set();
  const defaultBranch = refs.find((ref) => ref.isDefaultBranch === true);
  if (!defaultBranch) return closed;

  for (const filePath of defaultBranch.issuePaths) {
    const text = showFile(defaultBranch.name, filePath);
    if (text === null || text === undefined) continue;
    if (isClosedIssueStatus(parseIssueMarkdown(text).status)) {
      closed.add(issueIdFromPath(filePath, trackerRoot));
    }
  }
  return closed;
}
